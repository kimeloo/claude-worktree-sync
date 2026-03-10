# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Claude Worktree Sync — VSCode Extension

## 프로젝트 개요

Claude Code가 생성하는 git worktree를 자동 감지하여 VSCode workspace에 동기화하는 확장. `.claude/worktrees/` 디렉토리를 감시하고, 새 worktree가 생기면 workspace folder로 추가하며, 삭제되면 제거한다.

**진입점:** `src/extension.ts` → `out/extension.js` (컴파일 후)

## 개발 환경

```bash
# 의존성 설치
npm install

# TypeScript 빌드
npm run compile

# 파일 감시 모드 빌드
npm run watch

# 린트
npm run lint

# Extension Development Host 실행
# VSCode에서 F5
```

## 아키텍처

VSCode Extension API 기반으로, FS 감시 → worktree 발견 → workspace 동기화 파이프라인 구조.

```
src/
├── extension.ts             # 진입점 (activate/deactivate)
├── types.ts                 # WorktreeInfo 인터페이스
├── config.ts                # 설정 관리
├── worktreeDiscovery.ts     # .claude/worktrees/ 스캔
├── worktreeWatcher.ts       # fs.watch + polling 하이브리드 감시
├── workspaceSync.ts         # workspace folder 추가/제거
├── syncEngine.ts            # 오케스트레이터
├── statusBar.ts             # 상태바 아이템
├── treeView.ts              # Explorer TreeView 패널 (Claude Worktrees)
├── logger.ts                # 디버그 로깅 (OutputChannel)
└── utils/
    ├── paths.ts             # Windows 경로 정규화
    └── debounce.ts          # 디바운스 유틸
```

| 모듈 | 역할 |
|------|------|
| `extension.ts` | 확장 활성화/비활성화, SyncEngine 초기화 |
| `types.ts` | `WorktreeInfo` 인터페이스 정의 |
| `config.ts` | `claudeWorktreeSync.*` 설정 읽기 |
| `worktreeDiscovery.ts` | `.claude/worktrees/` 디렉토리 스캔, `.git` 파일로 worktree 식별 |
| `worktreeWatcher.ts` | `fs.watch` + polling 하이브리드로 파일 시스템 변경 감시 |
| `workspaceSync.ts` | `vscode.workspace.updateWorkspaceFolders()` 호출 |
| `syncEngine.ts` | 발견 → 감시 → 동기화 파이프라인 오케스트레이션 |
| `statusBar.ts` | 상태바에 worktree 수 표시 |
| `treeView.ts` | Explorer 패널에 worktree 목록 TreeView 제공 |
| `logger.ts` | `OutputChannel` 기반 디버그 로깅 |
| `utils/paths.ts` | Windows 경로 정규화 (`\` → `/`, 드라이브 문자 통일) |
| `utils/debounce.ts` | FS 이벤트 디바운스 |

## 핵심 설계 결정

- **FS 감시**: `fs.watch` + polling (VSCode watcher는 `.gitignore`된 `.claude/` 무시 가능)
- **Worktree 식별**: `.git` 파일 존재 확인 (디렉토리가 아닌 파일)
- **Workspace 업데이트**: 단일 배치 호출 (race condition 방지)
- **삽입 위치**: 항상 맨 뒤 (첫 번째 폴더 변경 → extension host 재시작 방지)
- **상태 저장**: 없음 (FS가 source of truth)
- **KISS**: 최대한 단순하게 구현
- **YAGNI**: 당장 필요 없는 기능은 만들지 않음. 단, plan.md에 명시된 추후 기능에 대해서는 확장 가능한 구조 유지
- **DRY**: 중복 코드 방지

## 브랜치 구조

| 브랜치 | 설명 |
|--------|------|
| `main` | 안정 릴리즈 |
| `dev` | 개발 브랜치 |
| `release/v{버전}` | 릴리즈 브랜치 |

## Git Workflow

### 브랜치 전략

- 새 작업을 시작할 때 사용자가 브랜치를 별도로 지정하지 않으면 **`dev` 브랜치를 기반**으로 `feat/{기능명}` 브랜치를 만들어 작업한다.
- 브랜치 생성 순서: `git checkout dev` → `git checkout -b feat/{기능명}`
- 작업 완료 후 push: `git push -u origin feat/{기능명}`

### 커밋 컨벤션

| type | 용도 |
|---|---|
| `feat` | 새 기능 추가 |
| `refactor` | 동작 변경 없는 코드 구조 개선 |
| `fix` | 버그 수정 |
| `docs` | 주석·문서만 변경 |
| `test` | 테스트 추가·수정 |
| `chore` | 빌드, 설정, 의존성 등 기타 변경 |

**메시지 형식:**

```
type: short description in English

본문은 한국어로 작성 (필요 시)
```

**메시지 스타일:**
- 제목은 영어로 작성, 소문자 시작, 동사원형으로 시작 (`add`, `fix`, `update`, `remove` 등)
- 제목은 50자 이내 권장
- 본문은 한국어로 작성, 필요 시만 추가

**커밋 규칙:**
- `Co-Authored-By:` 트레일러 절대 추가 금지
- 사용자 확인 없이 커밋 실행 금지 (`/commit` 스킬 사용 시)
- `--no-verify` 사용 금지

### Issue 컨벤션

**제목 형식:** `[타입] 설명`

| 타입 | 용도 |
|------|------|
| `bug` | 버그 리포트 |
| `feature` | 새 기능 제안 |
| `docs` | 문서 개선 |
| `question` | 질문·문의 |
| `chore` | 빌드, 설정, 의존성 등 |

**Bug Report 필수 항목:** 재현 단계, 예상 동작, 실제 동작, 환경 정보 (OS, Node.js 버전, VSCode 버전)

### PR 컨벤션

**제목 형식:** 커밋 컨벤션과 동일 (`type: description in English`)

**본문 항목:**
- 변경사항: 무엇을 바꿨는지
- 이유: 왜 바꿨는지
- 테스트 방법: 어떻게 검증했는지
- 관련 이슈: `Fixes #번호` 또는 `Closes #번호`

**체크리스트:**
- [ ] 커밋 컨벤션 준수
- [ ] 관련 이슈 링크 포함
- [ ] 로컬에서 테스트 완료

### CHANGELOG

- 기능 추가, 버그 수정, 리팩토링 등 사용자에게 의미 있는 변경이 있을 때 `CHANGELOG.md`를 업데이트한다.
- [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/) 형식을 따른다.
- 카테고리: `Added`, `Changed`, `Fixed`, `Removed`, `CI/CD`, `Chore`
- 새 릴리즈 시 `## [버전] - YYYY-MM-DD` 섹션을 추가한다.
