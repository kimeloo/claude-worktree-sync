# Claude Worktree Sync — 구현 계획

## MVP (현재 구현)
- [x] 프로젝트 스캐폴딩
- [x] 타입 & 유틸리티 (types.ts, paths.ts, debounce.ts)
- [x] 설정 관리 (config.ts)
- [x] Worktree 감지 (worktreeDiscovery.ts)
- [x] 파일시스템 감시 (worktreeWatcher.ts)
- [x] Workspace 동기화 (workspaceSync.ts)
- [x] 오케스트레이터 (syncEngine.ts)
- [x] 상태바 (statusBar.ts)
- [x] 진입점 (extension.ts)

## Post-MVP
- [ ] Explorer TreeView: 사이드바에 Claude Worktrees 패널
- [ ] 커맨드 확장: 수동 추가/제거, 터미널 열기, diff 보기
- [ ] Claude Code 훅 연동: WorktreeCreate/WorktreeRemove 이벤트 IPC 수신
- [ ] 다중 저장소 지원 강화: multi-root workspace에서 여러 repo 독립 감시
- [ ] 설정 확장: namingFormat 옵션, 알림 설정
