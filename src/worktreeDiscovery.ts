import * as fs from 'fs';
import * as path from 'path';
import { WorktreeInfo } from './types';
import { extractBranchPath, getWorktreesDir } from './utils/paths';

/**
 * .claude/worktrees/ 디렉토리를 재귀 스캔하여 실제 worktree 목록을 반환합니다.
 * worktree는 .git **파일**(디렉토리 아님)이 존재하는 디렉토리로 식별합니다.
 */
export async function discoverWorktrees(repoRoot: string): Promise<WorktreeInfo[]> {
  const worktreesDir = getWorktreesDir(repoRoot);
  const results: WorktreeInfo[] = [];

  try {
    await fs.promises.access(worktreesDir);
  } catch {
    return results;
  }

  await scanDir(worktreesDir, worktreesDir, repoRoot, results);
  return results;
}

async function scanDir(
  dir: string,
  worktreesDir: string,
  repoRoot: string,
  results: WorktreeInfo[],
): Promise<void> {
  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  // .git 파일이 있으면 이 디렉토리는 worktree
  const dotGitPath = path.join(dir, '.git');
  try {
    const stat = await fs.promises.stat(dotGitPath);
    if (stat.isFile()) {
      const branchPath = extractBranchPath(dir, worktreesDir);
      results.push({
        absolutePath: dir,
        branchPath,
        displayName: `[WT] ${branchPath}`,
        repoRoot,
        isInWorkspace: false,
      });
      return; // worktree 내부는 더 탐색하지 않음
    }
  } catch {
    // .git 파일 없음 — 중간 디렉토리이므로 하위 탐색 계속
  }

  // 하위 디렉토리 재귀 탐색
  for (const entry of entries) {
    if (entry.isDirectory() && !entry.name.startsWith('.')) {
      await scanDir(path.join(dir, entry.name), worktreesDir, repoRoot, results);
    }
  }
}
