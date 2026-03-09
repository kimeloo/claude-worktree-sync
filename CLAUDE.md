# Claude Worktree Sync — VSCode Extension

## 개발 원칙
- **KISS**: 최대한 단순하게 구현
- **YAGNI**: 당장 필요 없는 기능은 만들지 않음. 단, plan.md에 명시된 추후 기능에 대해서는 확장 가능한 구조 유지
- **DRY**: 중복 코드 방지

## 커밋 컨벤션
- Conventional Commits (feat:, fix:, chore:, docs: 등)
- Co-Author 헤더 제외
- 간결한 커밋 메시지

## 브랜치 전략
- `main`: 안정 브랜치
- 기능 구현은 새 브랜치에서 작업 (예: `feat/scaffolding`, `feat/core-engine`)

## 프로젝트 구조
```
src/
├── extension.ts             # 진입점
├── types.ts                 # WorktreeInfo 인터페이스
├── config.ts                # 설정 관리
├── worktreeDiscovery.ts     # .claude/worktrees/ 스캔
├── worktreeWatcher.ts       # fs.watch + polling 하이브리드 감시
├── workspaceSync.ts         # workspace folder 추가/제거
├── syncEngine.ts            # 오케스트레이터
├── statusBar.ts             # 상태바 아이템
└── utils/
    ├── paths.ts             # Windows 경로 정규화
    └── debounce.ts          # 디바운스 유틸
```

## 핵심 설계 결정
- **FS 감시**: `fs.watch` + polling (VSCode watcher는 `.gitignore`된 `.claude/` 무시 가능)
- **Worktree 식별**: `.git` 파일 존재 확인 (디렉토리가 아닌 파일)
- **Workspace 업데이트**: 단일 배치 호출 (race condition 방지)
- **삽입 위치**: 항상 맨 뒤 (첫 번째 폴더 변경 → extension host 재시작 방지)
- **상태 저장**: 없음 (FS가 source of truth)

## 빌드 & 디버그
- `npm run compile`: TypeScript 빌드
- `npm run watch`: 파일 감시 모드 빌드
- `F5`: Extension Development Host 실행
