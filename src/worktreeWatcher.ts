import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { WorktreeInfo } from './types';
import { discoverWorktrees } from './worktreeDiscovery';
import { getWorktreesDir, pathsEqual } from './utils/paths';
import { debounce } from './utils/debounce';

export interface WorktreeChange {
  added: WorktreeInfo[];
  removed: WorktreeInfo[];
}

export class WorktreeWatcher implements vscode.Disposable {
  private readonly _onDidChange = new vscode.EventEmitter<WorktreeChange>();
  readonly onDidChange = this._onDidChange.event;

  private fsWatcher: fs.FSWatcher | undefined;
  private pollingTimer: ReturnType<typeof setInterval> | undefined;
  private parentWatcher: fs.FSWatcher | undefined;
  private previousWorktrees: WorktreeInfo[] = [];
  private readonly debouncedReconcile: () => void;
  private disposed = false;

  constructor(
    private readonly repoRoot: string,
    private pollingInterval: number,
  ) {
    this.debouncedReconcile = debounce(() => this.reconcile(), 300);
  }

  async start(): Promise<void> {
    // 초기 스캔
    this.previousWorktrees = await discoverWorktrees(this.repoRoot);

    const worktreesDir = getWorktreesDir(this.repoRoot);
    this.tryStartFsWatch(worktreesDir);
    this.startPolling();
  }

  /** 설정 변경 시 polling 간격 업데이트 */
  updatePollingInterval(interval: number): void {
    this.pollingInterval = interval;
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.startPolling();
    }
  }

  /** 현재 감지된 worktree 목록 반환 */
  getWorktrees(): WorktreeInfo[] {
    return [...this.previousWorktrees];
  }

  /** 수동 새로고침 */
  async refresh(): Promise<WorktreeChange> {
    return this.reconcile();
  }

  private tryStartFsWatch(worktreesDir: string): void {
    try {
      // worktreesDir이 존재하면 직접 감시
      if (fs.existsSync(worktreesDir)) {
        this.watchWorktreesDir(worktreesDir);
      } else {
        // .claude/ 또는 repo root를 감시하여 worktrees/ 생성 감지
        this.watchForWorktreesDirCreation();
      }
    } catch {
      // fs.watch 실패 시 polling만 사용
    }
  }

  private watchWorktreesDir(worktreesDir: string): void {
    this.cleanupFsWatcher();
    try {
      this.fsWatcher = fs.watch(worktreesDir, { recursive: true }, () => {
        this.debouncedReconcile();
      });
      this.fsWatcher.on('error', () => {
        this.cleanupFsWatcher();
        // polling이 fallback으로 동작
      });
    } catch {
      // recursive watch 미지원 시 polling만 사용
    }
  }

  private watchForWorktreesDirCreation(): void {
    const claudeDir = path.join(this.repoRoot, '.claude');
    const worktreesDir = getWorktreesDir(this.repoRoot);

    const watchTarget = fs.existsSync(claudeDir) ? claudeDir : this.repoRoot;

    try {
      this.parentWatcher = fs.watch(watchTarget, (_, filename) => {
        if (!filename) { return; }
        const relevant =
          (watchTarget === claudeDir && filename === 'worktrees') ||
          (watchTarget === this.repoRoot && filename === '.claude');

        if (relevant && fs.existsSync(worktreesDir)) {
          this.cleanupParentWatcher();
          this.watchWorktreesDir(worktreesDir);
          this.debouncedReconcile();
        }
      });
      this.parentWatcher.on('error', () => {
        this.cleanupParentWatcher();
      });
    } catch {
      // 실패 시 polling만 사용
    }
  }

  private startPolling(): void {
    this.pollingTimer = setInterval(() => {
      if (!this.disposed) {
        this.debouncedReconcile();
      }
    }, this.pollingInterval);
  }

  private async reconcile(): Promise<WorktreeChange> {
    if (this.disposed) {
      return { added: [], removed: [] };
    }

    const current = await discoverWorktrees(this.repoRoot);
    const change = diffWorktrees(this.previousWorktrees, current);
    this.previousWorktrees = current;

    // worktreesDir이 새로 생겼을 수 있으므로 watcher 확인
    if (!this.fsWatcher) {
      const worktreesDir = getWorktreesDir(this.repoRoot);
      if (fs.existsSync(worktreesDir)) {
        this.cleanupParentWatcher();
        this.watchWorktreesDir(worktreesDir);
      }
    }

    if (change.added.length > 0 || change.removed.length > 0) {
      this._onDidChange.fire(change);
    }

    return change;
  }

  private cleanupFsWatcher(): void {
    this.fsWatcher?.close();
    this.fsWatcher = undefined;
  }

  private cleanupParentWatcher(): void {
    this.parentWatcher?.close();
    this.parentWatcher = undefined;
  }

  dispose(): void {
    this.disposed = true;
    this.cleanupFsWatcher();
    this.cleanupParentWatcher();
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
