# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-03-08

### Added
- 초기 MVP 구현
- `.claude/worktrees/` 디렉토리 자동 감지 및 workspace 동기화
- `fs.watch` + polling 하이브리드 파일 시스템 감시
- 상태바에 활성 worktree 수 표시
- Windows 경로 정규화 지원

### Fixed
- Worktree 폴더 오인식 버그 수정
- 디버그 로깅 추가로 문제 진단 개선
