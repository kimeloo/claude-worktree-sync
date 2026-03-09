import * as vscode from 'vscode';
import { WorktreeInfo } from './types';
import { pathsEqual } from './utils/paths';
import { log } from './logger';

export function addToWorkspace(worktree: WorktreeInfo): boolean {
  const folders = vscode.workspace.workspaceFolders ?? [];
  log(`[WorkspaceSync] addToWorkspace: "${worktree.displayName}" (${worktree.absolutePath})`);
  log(`[WorkspaceSync]   Current folders: [${folders.map(f => `"${f.name}" (${f.uri.fsPath})`).join(', ')}]`);

  if (isInWorkspace(worktree.absolutePath, folders)) {
    log(`[WorkspaceSync]   Already in workspace, skipping`);
    return false;
  }

  const insertAt = folders.length;
  log(`[WorkspaceSync]   Inserting at index ${insertAt}`);
  const result = vscode.workspace.updateWorkspaceFolders(
    insertAt,
    0,
    { uri: vscode.Uri.file(worktree.absolutePath), name: worktree.displayName },
  );
  log(`[WorkspaceSync]   updateWorkspaceFolders result: ${result}`);
  return result;
}

export function removeFromWorkspace(absolutePath: string): boolean {
  const folders = vscode.workspace.workspaceFolders ?? [];
  const index = findFolderIndex(absolutePath, folders);
  log(`[WorkspaceSync] removeFromWorkspace: ${absolutePath}, index=${index}`);
  if (index < 0) {
    return false;
  }
  return vscode.workspace.updateWorkspaceFolders(index, 1);
}

export function batchSync(
  toAdd: WorktreeInfo[],
  toRemove: string[],
): void {
  const folders = vscode.workspace.workspaceFolders ?? [];
  const removeIndices = toRemove
    .map((p) => findFolderIndex(p, folders))
    .filter((i) => i >= 0)
    .sort((a, b) => b - a);

  for (const idx of removeIndices) {
    vscode.workspace.updateWorkspaceFolders(idx, 1);
  }

  const foldersToAdd = toAdd
    .filter((wt) => !isInWorkspace(wt.absolutePath, vscode.workspace.workspaceFolders ?? []))
    .map((wt) => ({
      uri: vscode.Uri.file(wt.absolutePath),
      name: wt.displayName,
    }));

  if (foldersToAdd.length > 0) {
    const currentLength = (vscode.workspace.workspaceFolders ?? []).length;
    vscode.workspace.updateWorkspaceFolders(currentLength, 0, ...foldersToAdd);
  }
}

export function isInWorkspace(
  absolutePath: string,
  folders: readonly vscode.WorkspaceFolder[],
): boolean {
  return findFolderIndex(absolutePath, folders) >= 0;
}

function findFolderIndex(
  absolutePath: string,
  folders: readonly vscode.WorkspaceFolder[],
): number {
  return folders.findIndex((f) => pathsEqual(f.uri.fsPath, absolutePath));
}
