# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-03-24

### Added
- Explorer TreeView 패널 (`Claude Worktrees`) 추가
- TreeView 툴바에 새로고침 버튼 추가
- Worktree 수동 명령어 지원 (추가/제거, 터미널 열기, diff 보기)
- Claude GitHub Actions 워크플로우 추가 (PR Assistant, Code Review)

### Fixed
- GitHub Actions 워크플로우 권한 설정 수정

### CI/CD
- `claude.yml`, `claude-code-review.yml` 워크플로우 구성

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
