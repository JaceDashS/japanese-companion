# 프로젝트 전용 작업 지침

## 프로젝트 범위

- Japanese Companion은 로컬 우선 JLPT 학습 앱이다.
- 공식 커리큘럼 데이터는 `asset/*.json`의 `format: "combined"` 구조다.
- `src.json`, `manifest.json`, `study.json` 구조는 현재 기준으로 사용하지 않는다.
- `item`은 하나의 학습 표현 또는 한자이고, `problem`은 item 안의 퀴즈 데이터다.

## 변경 원칙

- 사용자가 요청한 범위만 변경한다.
- 쓰기 전에 대상 파일을 사용자에게 알린다.
- 기존 작업 트리 변경을 삭제하거나 되돌리지 않는다.
- 에셋을 변경할 때 `id`, `index`, `expression`, `meaningKo`, `readingParts`, 학습 상태, Day 구조와 순서는 보존한다.
- 문제 생성·수정은 현재 `docs/skills/kanji-decomposition-problem/SKILL.md` 규칙을 따른다.
- 유효한 기존 problem은 보존하고, 누락되거나 규칙을 위반하는 problem만 수정한다.
- 대량 삭제·재정렬·데이터 마이그레이션은 사용자가 명시적으로 요청한 경우에만 수행한다.

## 데이터 작업

- 한자가 없는 표현은 한자 학습 커리큘럼에 포함하지 않는다.
- 문제의 정답은 저장된 독음, `readingParts.kanjiToKana`, 수동 검토 독음 순서로 결정한다.
- 표현 안의 연속 가나 구간은 정답과 모든 보기에서 동일하게 유지한다.
- 문제는 4개의 서로 다른 보기와 그중 하나인 정답을 가진다.
- 읽기 문제는 `target`이 item의 `expression`과 같고 문장에 표현이 포함되어야 한다.
- `similar_expression`은 별도 유형으로 취급하되, 문장·보기·정답이 비어 있지 않고 구조적으로 유효해야 한다.
- 데이터 수정 전후에 JSON 파싱, 불변 필드, item 수·순서·ID·index, 문제 규칙을 검사한다.

## 코드 작성

- 기존 모듈과 코딩 스타일을 우선 재사용한다.
- 새 의존성을 추가하지 않는다. 필요하면 먼저 사용자 승인을 받는다.
- 주석은 프로젝트 루트 `AGENTS.md`의 언어 규칙을 따른다.
- 임시 로그와 디버그 코드를 남기지 않는다.
- 파일 수정은 `apply_patch`를 사용한다.

## 검증 명령

- 문제·에셋 감사: 관련 `node scripts/*.cjs` 스크립트
- 저장 큐 테스트: `node scripts/test-source-write-queue.cjs`
- Day 저장 테스트: `npm run test:save-day-result`
- 단계 진행 테스트: `npm run test:stage-progression`
- 타입 검사: `npm run typecheck`
- 변경 후 `git diff --check`를 실행한다.
- 빌드는 사용자가 명시적으로 요청한 경우에만 실행한다.
- 검증 실패는 이번 변경, 기존 기준선, 환경 문제를 구분해 보고한다.

## 보안과 Git

- `.env`, 토큰, 비밀번호, 개인 데이터와 `server-data/`의 private runtime 데이터를 출력·커밋하지 않는다.
- `git reset --hard`, `git clean`, force push, amend, rebase, 기존 커밋 수정은 명시적 요청 없이는 수행하지 않는다.
- 커밋이 요청되면 영어 type-prefixed 메시지를 사용하고 논리적으로 하나의 작업만 포함한다.
- 사용자가 요청하지 않으면 커밋·푸시·PR·배포를 수행하지 않는다.

## 보고

- 사용자에게 한국어 존댓말로 결과를 먼저 보고한다.
- 수정한 파일, 실행한 검증, 실패와 미확인 범위를 구분한다.
- 검증하지 않은 동작을 정상이라고 단정하지 않는다.
