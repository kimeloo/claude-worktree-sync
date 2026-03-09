import * as vscode from 'vscode';
import { WorktreeInfo } from './types';

export class StatusBar implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
    this.item.command = 'claudeWorktreeSync.refreshWorktrees';
    this.item.tooltip = 'Claude Worktrees — click to refresh';
  }

  update(worktrees: WorktreeInfo[]): void {
    if (worktrees.length === 0) {
      this.item.hide();
      return;
    }

    const inWorkspace = worktrees.filter((wt) => wt.isInWorkspace).length;
    this.item.text = `$(git-branch) WT: ${inWorkspace}/${worktrees.length}`;
    this.item.show();
  }

  dispose(): void {
    this.item.dispose();
  }
}
