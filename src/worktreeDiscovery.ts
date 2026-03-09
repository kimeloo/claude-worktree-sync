import * as fs from 'fs';
import * as path from 'path';
import { WorktreeInfo } from './types';
import { extractBranchPath, getWorktreesDir } from './utils/paths';
import { log } from './logger';

export async function discoverWorktrees(repoRoot: string): Promise<WorktreeInfo[]> {
  const worktreesDir = getWorktreesDir(repoRoot);
  const results: WorktreeInfo[] = [];

  try {
    await fs.promises.access(worktreesDir);
  } catch {
    log(`[Discovery] worktreesDir not accessible: ${worktreesDir}`);
    return results;
  }

  log(`[Discovery] Scanning: ${worktreesDir}`);
  await scanDir(worktreesDir, worktreesDir, repoRoot, results);
  log(`[Discovery] Scan complete: found ${results.length} worktree(s)`);
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
  } catch (err) {
    log(`[Discovery] Failed to readdir ${dir}: ${err}`);
    return;
  }

  log(`[Discovery] scanDir: ${dir} — entries: [${entries.map(e => `${e.name}(${e.isDirectory() ? 'dir' : e.isFile() ? 'file' : 'other'})`).join(', ')}]`);

  // .git 파일이 있으면 이 디렉토리는 worktree
  const dotGitPath = path.join(dir, '.git');
  try {
    const stat = await fs.promises.stat(dotGitPath);
    const isFile = stat.isFile();
    const isDir = stat.isDirectory();
    log(`[Discovery] Found .git at ${dotGitPath} — isFile: ${isFile}, isDir: ${isDir}`);

    if (isFile) {
      const content = await fs.promises.readFile(dotGitPath, 'utf-8');
      log(`[Discovery] .git file content: "${content.trim()}"`);

      const branchPath = extractBranchPath(dir, worktreesDir);
      log(`[Discovery] Identified worktree: branchPath="${branchPath}", absolutePath="${dir}"`);
      results.push({
        absolutePath: dir,
        branchPath,
        displayName: `[WT] ${branchPath}`,
        repoRoot,
        isInWorkspace: false,
      });
      return;
    }
    log(`[Discovery] .git is a directory, not a worktree indicator — skipping`);
  } catch {
    log(`[Discovery] No .git at ${dotGitPath}`);
  }

  // 하위 디렉토리 재귀 탐색
  for (const entry of entries) {
    if (entry.isDirectory() && !entry.name.startsWith('.')) {
      await scanDir(path.join(dir, entry.name), worktreesDir, repoRoot, results);
    } else if (entry.isDirectory() && entry.name.startsWith('.')) {
      log(`[Discovery] Skipping dot-directory: ${entry.name}`);
    }
  }
}
