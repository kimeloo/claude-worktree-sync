import * as vscode from 'vscode';
import { WorktreeInfo } from './types';
import { pathsEqual } from './utils/paths';

/** Workspace folder에 worktree를 추가합니다 (이미 존재하면 무시) */
export function addToWorkspace(worktree: WorktreeInfo): boolean {
  const folders = vscode.workspace.workspaceFolders ?? [];
  if (isInWorkspace(worktree.absolutePath, folders)) {
    return false;
  }

  return vscode.workspace.updateWorkspaceFolders(
    folders.length, // 항상 맨 뒤에 삽입
    0,
    { uri: vscode.Uri.file(worktree.absolutePath), name: worktree.displayName },
  );
}

/** Workspace folder에서 worktree를 제거합니다 */
export function removeFromWorkspace(absolutePath: string): boolean {
  const folders = vscode.workspace.workspaceFolders ?? [];
  const index = findFolderIndex(absolutePath, folders);
  if (index < 0) {
    return false;
  }
  return vscode.workspace.updateWorkspaceFolders(index, 1);
}

/**
 * 추가/제거를 단일 배치 호출로 처리합니다.
 *
 * 여기서 핵심 과제는 동시 추가/제거 시 인덱스를 올바르게 계산하는 것입니다.
 * updateWorkspaceFolders의 시그니처는 (start, deleteCount, ...foldersToAdd)이므로,
 * 제거할 폴더들이 연속적이지 않을 경우 단일 호출로 처리하기 어렵습니다.
 *
 * 전략: 제거를 먼저, 추가를 나중에 순차 처리합니다.
 * updateWorkspaceFolders 자체가 동기적으로 인덱스를 갱신하므로 안전합니다.
 */
export function batchSync(
  toAdd: WorktreeInfo[],
  toRemove: string[],
): void {
  // 제거: 인덱스가 큰 것부터 제거해야 앞쪽 인덱스가 안 밀림
  const folders = vscode.workspace.workspaceFolders ?? [];
  const removeIndices = toRemove
    .map((p) => findFolderIndex(p, folders))
    .filter((i) => i >= 0)
    .sort((a, b) => b - a); // 역순 정렬

  for (const idx of removeIndices) {
    vscode.workspace.updateWorkspaceFolders(idx, 1);
  }

  // 추가: 현재 폴더 목록 뒤에 삽입
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

/** 경로가 현재 workspace에 존재하는지 확인 */
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
