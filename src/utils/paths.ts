import * as path from 'path';

/** 백슬래시→슬래시, 드라이브 문자 소문자화, 후행 구분자 제거 */
export function normalizePath(p: string): string {
  let normalized = p.replace(/\\/g, '/');
  // 드라이브 문자 소문자화 (예: C:/ → c:/)
  if (/^[A-Z]:\//.test(normalized)) {
    normalized = normalized[0].toLowerCase() + normalized.slice(1);
  }
  // 후행 슬래시 제거 (루트 드라이브 제외)
  if (normalized.length > 3 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

/** 정규화 후 비교 (Windows: case-insensitive) */
export function pathsEqual(a: string, b: string): boolean {
  const na = normalizePath(a);
  const nb = normalizePath(b);
  if (process.platform === 'win32') {
    return na.toLowerCase() === nb.toLowerCase();
  }
  return na === nb;
}

/** .claude/worktrees 디렉토리 경로 반환 */
export function getWorktreesDir(repoRoot: string): string {
  return path.join(repoRoot, '.claude', 'worktrees');
}

/** worktreesDir 기준으로 상대 브랜치 경로 추출 */
export function extractBranchPath(absPath: string, worktreesDir: string): string {
  const rel = path.relative(worktreesDir, absPath);
  return rel.replace(/\\/g, '/');
}
