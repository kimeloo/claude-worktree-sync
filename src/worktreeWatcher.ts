import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { WorktreeInfo } from './types';
import { discoverWorktrees } from './worktreeDiscovery';
import { getWorktreesDir, pathsEqual } from './utils/paths';
import { debounce } from './utils/debounce';
import { log } from './logger';

export interface WorktreeChange {
  added: WorktreeInfo[];
  removed: WorktreeInfo[];
}

export class WorktreeWatcher implements vscode.Disposable {
  private readonly _onDidChange = new vscode.EventEmitter<WorktreeChange>();
  readonly onDidChange = this._onDidChange.event;

  private fsWatcher: fs.FSWatcher | undefined;
  private gitWatcher: fs.FSWatcher | undefined;
  private pollingTimer: ReturnType<typeof setInterval> | undefined;
  private parentWatcher: fs.FSWatcher | undefined;
  private previousWorktrees: WorktreeInfo[] = [];
  private readonly debouncedReconcile: () => void;
  private disposed = false;

  constructor(
    private readonly repoRoot: string,
    private pollingInterval: number,
  ) {
    this.debouncedReconcile = debounce(() => {
      log('[Watcher] Debounced reconcile triggered');
      this.reconcile();
    }, 300);
  }

  async start(): Promise<void> {
    log(`[Watcher] start() — repoRoot: ${this.repoRoot}`);
    this.previousWorktrees = await discoverWorktrees(this.repoRoot);
    log(`[Watcher] Initial scan found ${this.previousWorktrees.length} worktree(s)`);

    const worktreesDir = getWorktreesDir(this.repoRoot);
    log(`[Watcher] worktreesDir: ${worktreesDir}`);
    log(`[Watcher] worktreesDir exists: ${fs.existsSync(worktreesDir)}`);

    this.tryStartFsWatch(worktreesDir);
    this.tryStartGitWatch();
    this.startPolling();
  }

  updatePollingInterval(interval: number): void {
    log(`[Watcher] updatePollingInterval: ${interval}ms`);
    this.pollingInterval = interval;
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.startPolling();
    }
  }

  getWorktrees(): WorktreeInfo[] {
    return [...this.previousWorktrees];
  }

  async refresh(): Promise<WorktreeChange> {
    log('[Watcher] Manual refresh');
    return this.reconcile();
  }

  private tryStartGitWatch(): void {
    const gitWorktreesDir = path.join(this.repoRoot, '.git', 'worktrees');
    if (!fs.existsSync(gitWorktreesDir)) {
      log('[Watcher] .git/worktrees/ not found, skipping git watch');
      return;
    }
    try {
      this.gitWatcher = fs.watch(gitWorktreesDir, { recursive: true }, (eventType, filename) => {
        log(`[Watcher] git worktrees watch event: type=${eventType}, file=${filename}`);
        this.debouncedReconcile();
      });
      this.gitWatcher.on('error', (err) => {
        log(`[Watcher] git watch ERROR: ${err}`);
        this.gitWatcher?.close();
        this.gitWatcher = undefined;
      });
      log(`[Watcher] fs.watch started on ${gitWorktreesDir} (git worktrees)`);
    } catch (err) {
      log(`[Watcher] git watch FAILED to start: ${err}`);
    }
  }

  private tryStartFsWatch(worktreesDir: string): void {
    try {
      if (fs.existsSync(worktreesDir)) {
        log('[Watcher] worktreesDir exists, watching directly');
        this.watchWorktreesDir(worktreesDir);
      } else {
        log('[Watcher] worktreesDir does NOT exist, watching for creation');
        this.watchForWorktreesDirCreation();
      }
    } catch (err) {
      log(`[Watcher] tryStartFsWatch FAILED: ${err}`);
    }
  }

  private watchWorktreesDir(worktreesDir: string): void {
    this.cleanupFsWatcher();
    try {
      this.fsWatcher = fs.watch(worktreesDir, { recursive: true }, (eventType, filename) => {
        log(`[Watcher] fs.watch event: type=${eventType}, file=${filename}`);
        this.debouncedReconcile();
      });
      this.fsWatcher.on('error', (err) => {
        log(`[Watcher] fs.watch ERROR: ${err}`);
        this.cleanupFsWatcher();
      });
      log(`[Watcher] fs.watch started on ${worktreesDir} (recursive)`);
    } catch (err) {
      log(`[Watcher] fs.watch FAILED to start: ${err}`);
    }
  }

  private watchForWorktreesDirCreation(): void {
    const claudeDir = path.join(this.repoRoot, '.claude');
    const worktreesDir = getWorktreesDir(this.repoRoot);
    const claudeDirExists = fs.existsSync(claudeDir);

    const watchTarget = claudeDirExists ? claudeDir : this.repoRoot;
    log(`[Watcher] Watching parent for worktrees/ creation: ${watchTarget} (claudeDir exists: ${claudeDirExists})`);

    try {
      this.parentWatcher = fs.watch(watchTarget, (eventType, filename) => {
        log(`[Watcher] Parent watch event: type=${eventType}, file=${filename}, target=${watchTarget}`);
        if (!filename) {
          log('[Watcher] Parent watch: filename is null, ignoring');
          return;
        }
        const relevant =
          (watchTarget === claudeDir && filename === 'worktrees') ||
          (watchTarget === this.repoRoot && filename === '.claude');

        log(`[Watcher] Parent watch: relevant=${relevant}, worktreesDir exists=${fs.existsSync(worktreesDir)}`);

        if (relevant && fs.existsSync(worktreesDir)) {
          log('[Watcher] worktrees/ directory appeared! Switching to direct watch');
          this.cleanupParentWatcher();
          this.watchWorktreesDir(worktreesDir);
          this.debouncedReconcile();
        }
      });
      this.parentWatcher.on('error', (err) => {
        log(`[Watcher] Parent watch ERROR: ${err}`);
        this.cleanupParentWatcher();
      });
      log(`[Watcher] Parent watcher started on ${watchTarget}`);
    } catch (err) {
      log(`[Watcher] Parent watch FAILED to start: ${err}`);
    }
  }

  private startPolling(): void {
    log(`[Watcher] Polling started (interval: ${this.pollingInterval}ms)`);
    this.pollingTimer = setInterval(() => {
      if (!this.disposed) {
        this.debouncedReconcile();
      }
    }, this.pollingInterval);
  }

  private async reconcile(): Promise<WorktreeChange> {
    if (this.disposed) {
      log('[Watcher] reconcile() skipped — disposed');
      return { added: [], removed: [] };
    }

    log(`[Watcher] reconcile() — scanning ${this.repoRoot}`);
    const current = await discoverWorktrees(this.repoRoot);
    log(`[Watcher] reconcile() — found ${current.length} worktree(s), previous had ${this.previousWorktrees.length}`);

    if (current.length > 0) {
      log(`[Watcher] Current worktrees: ${JSON.stringify(current.map(w => w.branchPath))}`);
    }
    if (this.previousWorktrees.length > 0) {
      log(`[Watcher] Previous worktrees: ${JSON.stringify(this.previousWorktrees.map(w => w.branchPath))}`);
    }

    const change = diffWorktrees(this.previousWorktrees, current);
    this.previousWorktrees = current;

    log(`[Watcher] Diff result: +${change.added.length} added, -${change.removed.length} removed`);
    if (change.added.length > 0) {
      log(`[Watcher] Added: ${JSON.stringify(change.added.map(w => w.branchPath))}`);
    }
    if (change.removed.length > 0) {
      log(`[Watcher] Removed: ${JSON.stringify(change.removed.map(w => w.branchPath))}`);
    }

    // worktreesDir이 새로 생겼을 수 있으므로 watcher 확인
    if (!this.fsWatcher) {
      const worktreesDir = getWorktreesDir(this.repoRoot);
      if (fs.existsSync(worktreesDir)) {
        log('[Watcher] reconcile: worktreesDir appeared, starting direct watch');
        this.cleanupParentWatcher();
        this.watchWorktreesDir(worktreesDir);
      }
    }

    if (change.added.length > 0 || change.removed.length > 0) {
      log('[Watcher] Firing onDidChange event');
      this._onDidChange.fire(change);
    }

    return change;
  }

  private cleanupFsWatcher(): void {
    if (this.fsWatcher) {
      log('[Watcher] Cleaning up fs.watch');
    }
    this.fsWatcher?.close();
    this.fsWatcher = undefined;
  }

  private cleanupParentWatcher(): void {
    if (this.parentWatcher) {
      log('[Watcher] Cleaning up parent watcher');
    }
    this.parentWatcher?.close();
    this.parentWatcher = undefined;
  }

  dispose(): void {
    log('[Watcher] dispose()');
    this.disposed = true;
    this.cleanupFsWatcher();
    this.cleanupParentWatcher();
    this.gitWatcher?.close();
    this.gitWatcher = undefined;
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
    }
    this._onDidChange.dispose();
  }
}

function diffWorktrees(
  previous: WorktreeInfo[],
  current: WorktreeInfo[],
): WorktreeChange {
  const added = current.filter(
    (c) => !previous.some((p) => pathsEqual(p.absolutePath, c.absolutePath)),
  );
  const removed = previous.filter(
    (p) => !current.some((c) => pathsEqual(p.absolutePath, c.absolutePath)),
  );
  return { added, removed };
}
