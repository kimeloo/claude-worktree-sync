import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { ConfigManager } from './config';
import { WorktreeWatcher } from './worktreeWatcher';
import { addToWorkspace, removeFromWorkspace, isInWorkspace } from './workspaceSync';
import { StatusBar } from './statusBar';
import { WorktreeInfo } from './types';
import { log } from './logger';

export class SyncEngine implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private readonly watchers: WorktreeWatcher[] = [];
  private readonly statusBar = new StatusBar();

  constructor(private readonly config: ConfigManager) {
    this.disposables.push(this.statusBar);
  }

  async initialize(): Promise<void> {
    log('[SyncEngine] initialize() called');

    const repoRoots = this.findRepoRoots();
    log(`[SyncEngine] Found ${repoRoots.length} repo root(s): ${JSON.stringify(repoRoots)}`);

    for (const root of repoRoots) {
      await this.watchRepo(root);
    }

    this.disposables.push(
      this.config.onDidChange((cfg) => {
        log(`[SyncEngine] Config changed: ${JSON.stringify(cfg)}`);
        for (const w of this.watchers) {
          w.updatePollingInterval(cfg.pollingInterval);
        }
      }),
    );

    this.disposables.push(
      vscode.commands.registerCommand('claudeWorktreeSync.refreshWorktrees', () => {
        log('[SyncEngine] refreshWorktrees command invoked');
        this.refreshAll();
      }),
    );

    this.updateStatusBar();
    log('[SyncEngine] initialize() done');
  }

  private async watchRepo(repoRoot: string): Promise<void> {
    log(`[SyncEngine] watchRepo(${repoRoot})`);
    const cfg = this.config.get();
    const watcher = new WorktreeWatcher(repoRoot, cfg.pollingInterval);

    watcher.onDidChange((change) => {
      log(`[SyncEngine] onDidChange event: added=${change.added.length}, removed=${change.removed.length}`);
      const currentCfg = this.config.get();

      if (currentCfg.autoAdd) {
        for (const wt of change.added) {
          log(`[SyncEngine] Auto-adding worktree: ${wt.displayName} (${wt.absolutePath})`);
          const result = addToWorkspace(wt);
          log(`[SyncEngine] addToWorkspace result: ${result}`);
        }
      } else {
        log(`[SyncEngine] autoAdd is disabled, skipping ${change.added.length} additions`);
      }

      if (currentCfg.autoRemove) {
        for (const wt of change.removed) {
          log(`[SyncEngine] Auto-removing worktree: ${wt.displayName} (${wt.absolutePath})`);
          const result = removeFromWorkspace(wt.absolutePath);
          log(`[SyncEngine] removeFromWorkspace result: ${result}`);
        }
      } else {
        log(`[SyncEngine] autoRemove is disabled, skipping ${change.removed.length} removals`);
      }

      this.updateStatusBar();
    });

    await watcher.start();

    // 초기 동기화
    const initialWorktrees = watcher.getWorktrees();
    log(`[SyncEngine] Initial worktrees found: ${initialWorktrees.length}`);
    if (cfg.autoAdd) {
      for (const wt of initialWorktrees) {
        log(`[SyncEngine] Initial sync — adding: ${wt.displayName}`);
        const result = addToWorkspace(wt);
        log(`[SyncEngine] Initial addToWorkspace result: ${result}`);
      }
    }

    this.watchers.push(watcher);
    this.disposables.push(watcher);

    this.updateStatusBar();
  }

  private async refreshAll(): Promise<void> {
    log('[SyncEngine] refreshAll()');
    for (const w of this.watchers) {
      await w.refresh();
    }
    this.updateStatusBar();
  }

  private updateStatusBar(): void {
    const allWorktrees = this.getAllWorktrees();
    const folders = vscode.workspace.workspaceFolders ?? [];

    for (const wt of allWorktrees) {
      wt.isInWorkspace = isInWorkspace(wt.absolutePath, folders);
    }

    log(`[SyncEngine] StatusBar update: ${allWorktrees.length} total, ${allWorktrees.filter(w => w.isInWorkspace).length} in workspace`);
    this.statusBar.update(allWorktrees);
  }

  private getAllWorktrees(): WorktreeInfo[] {
    return this.watchers.flatMap((w) => w.getWorktrees());
  }

  /** .claude 디렉토리가 존재하는 workspace folder의 경로를 반환 (worktree 폴더 자체는 제외) */
  private findRepoRoots(): string[] {
    const folders = vscode.workspace.workspaceFolders ?? [];
    log(`[SyncEngine] findRepoRoots — checking ${folders.length} workspace folder(s)`);
    const roots: string[] = [];

    for (const folder of folders) {
      const fsPath = folder.uri.fsPath;
      const claudeDir = path.join(fsPath, '.claude');
      const exists = fs.existsSync(claudeDir);

      // worktree 폴더 자체를 repo root로 오인하지 않도록 필터링
      // worktree 경로에는 .claude/worktrees/ 세그먼트가 포함됨
      const normalized = fsPath.replace(/\\/g, '/');
      const isWorktreeFolder = /\/\.claude\/worktrees\//.test(normalized);

      log(`[SyncEngine]   folder "${folder.name}" (${fsPath}) → .claude exists: ${exists}, isWorktreeFolder: ${isWorktreeFolder}`);
      if (exists && !isWorktreeFolder) {
        roots.push(fsPath);
      }
    }

    return roots;
  }

  dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
