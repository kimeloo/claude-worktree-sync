import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { WorktreeInfo } from './types';
import { extractBranchPath, getWorktreesDir, normalizePath, pathsEqual } from './utils/paths';
import { log } from './logger';

const execAsync = promisify(exec);

export async function discoverWorktrees(repoRoot: string): Promise<WorktreeInfo[]> {
  const [claudeWorktrees, gitWorktrees] = await Promise.all([
    discoverClaudeWorktrees(repoRoot),
    discoverGitWorktrees(repoRoot),
  ]);

  // Deduplicate: prefer claude worktrees if same path
  const seen = new Set<string>(claudeWorktrees.map(w => normalizePath(w.absolutePath)));
  const uniqueGitWorktrees = gitWorktrees.filter(w => !seen.has(normalizePath(w.absolutePath)));

  const results = [...claudeWorktrees, ...uniqueGitWorktrees];
  log(`[Discovery] Total worktrees: ${results.length} (claude: ${claudeWorktrees.length}, git: ${uniqueGitWorktrees.length})`);
  return results;
}

async function discoverClaudeWorktrees(repoRoot: string): Promise<WorktreeInfo[]> {
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
  log(`[Discovery] Claude scan complete: found ${results.length} worktree(s)`);
  return results;
}

export async function discoverGitWorktrees(repoRoot: string): Promise<WorktreeInfo[]> {
  try {
    const { stdout } = await execAsync('git worktree list --porcelain', { cwd: repoRoot });
    const results = parseGitWorktreeList(stdout, repoRoot);
    log(`[Discovery] Git worktrees found: ${results.length}`);
    return results;
  } catch (err) {
    log(`[Discovery] git worktree list failed: ${err}`);
    return [];
  }
}

function parseGitWorktreeList(output: string, repoRoot: string): WorktreeInfo[] {
  const results: WorktreeInfo[] = [];
  const blocks = output.trim().split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    const worktreeLine = lines.find(l => l.startsWith('worktree '));
    const branchLine = lines.find(l => l.startsWith('branch '));

    if (!worktreeLine) { continue; }

    const worktreePath = worktreeLine.slice('worktree '.length).trim();

    // Skip the main worktree (same as repoRoot)
    if (pathsEqual(worktreePath, repoRoot)) { continue; }

    let branchPath = path.basename(worktreePath);
    if (branchLine) {
      // "branch refs/heads/feat/my-feature" → "feat/my-feature"
      const ref = branchLine.slice('branch '.length).trim();
      const headsPrefix = 'refs/heads/';
      branchPath = ref.startsWith(headsPrefix) ? ref.slice(headsPrefix.length) : ref;
    }

    log(`[Discovery] Git worktree found: path="${worktreePath}", branch="${branchPath}"`);
    results.push({
      absolutePath: worktreePath,
      branchPath,
      displayName: `[WT] ${branchPath}`,
      repoRoot,
      isInWorkspace: false,
    });
  }

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
