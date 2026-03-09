import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { ConfigManager } from './config';
import { WorktreeWatcher } from './worktreeWatcher';
import { addToWorkspace, removeFromWorkspace, isInWorkspace } from './workspaceSync';
import { StatusBar } from './statusBar';
import { WorktreeInfo } from './types';

export class SyncEngine implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private readonly watchers: WorktreeWatcher[] = [];
  private readonly statusBar = new StatusBar();
  private readonly outputChannel = vscode.window.createOutputChannel('Claude Worktree Sync');

  constructor(private readonly config: ConfigManager) {
    this.disposables.push(this.statusBar, this.outputChannel);
  }

  async initialize(): Promise<void> {
    const repoRoots = this.findRepoRoots();
    this.log(`Found ${repoRoots.length} repo(s) with .claude directory`);

    for (const root of repoRoots) {
      await this.watchRepo(root);
    }

    // 설정 변경 리스닝
    this.disposables.push(
      this.config.onDidChange((cfg) => {
        for (const w of this.watchers) {
          w.updatePollingInterval(cfg.pollingInterval);
        }
      }),
    );

    // refreshWorktrees 커맨드 등록
    this.disposables.push(
      vscode.commands.registerCommand('claudeWorktreeSync.refreshWorktrees', () => {
        this.refreshAll();
      }),
    );

    this.updateStatusBar();
  }

  private async watchRepo(repoRoot: string): Promise<void> {
    const cfg = this.config.get();
    const watcher = new WorktreeWatcher(repoRoot, cfg.pollingInterval);

    watcher.onDidChange((change) => {
      const currentCfg = this.config.get();

      if (currentCfg.autoAdd) {
        for (const wt of change.added) {
          this.log(`Worktree added: ${wt.displayName}`);
          addToWorkspace(wt);
        }
      }

      if (currentCfg.autoRemove) {
        for (const wt of change.removed) {
          this.log(`Worktree removed: ${wt.displayName}`);
          removeFromWorkspace(wt.absolutePath);
        }
      }

      this.updateStatusBar();
    });

    await watcher.start();

    // 초기 동기화: 이미 존재하는 worktree를 workspace에 추가
    if (cfg.autoAdd) {
      for (const wt of watcher.getWorktrees()) {
        addToWorkspace(wt);
      }
    }

    this.watchers.push(watcher);
    this.disposables.push(watcher);

    this.updateStatusBar();
  }

  private async refreshAll(): Promise<void> {
    this.log('Manual refresh triggered');
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

    this.statusBar.update(allWorktrees);
  }

  private getAllWorktrees(): WorktreeInfo[] {
    return this.watchers.flatMap((w) => w.getWorktrees());
  }

  /** .claude 디렉토리가 존재하는 workspace folder의 경로를 반환 */
  private findRepoRoots(): string[] {
    const folders = vscode.workspace.workspaceFolders ?? [];
    const roots: string[] = [];

    for (const folder of folders) {
      const claudeDir = path.join(folder.uri.fsPath, '.claude');
      if (fs.existsSync(claudeDir)) {
        roots.push(folder.uri.fsPath);
      }
    }

    return roots;
  }

  private log(message: string): void {
    this.outputChannel.appendLine(`[${new Date().toISOString()}] ${message}`);
  }

  dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
