import * as vscode from 'vscode';
import { WorktreeInfo } from './types';

export class WorktreeItem extends vscode.TreeItem {
  constructor(readonly worktree: WorktreeInfo) {
    super(worktree.branchPath, vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon(worktree.isInWorkspace ? 'check' : 'circle-slash');
    this.description = worktree.isInWorkspace ? 'in workspace' : '';
    this.tooltip = worktree.absolutePath;
    this.contextValue = worktree.isInWorkspace ? 'worktreeInWorkspace' : 'worktreeNotInWorkspace';
  }
}

export class WorktreeTreeDataProvider implements vscode.TreeDataProvider<WorktreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private worktrees: WorktreeInfo[] = [];

  refresh(worktrees: WorktreeInfo[]): void {
    this.worktrees = worktrees;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: WorktreeItem): vscode.TreeItem { return element; }
  getChildren(): WorktreeItem[] {
    return this.worktrees.map(wt => new WorktreeItem(wt));
  }
}
