export interface WorktreeInfo {
  /** Worktree 절대 경로 */
  absolutePath: string;
  /** 브랜치 경로 (예: "feat/infra/database") */
  branchPath: string;
  /** Workspace에 표시될 이름 (예: "[WT] feat/infra/database") */
  displayName: string;
  /** 소속 저장소 루트 경로 */
  repoRoot: string;
  /** 현재 workspace에 추가되어 있는지 여부 */
  isInWorkspace: boolean;
}
