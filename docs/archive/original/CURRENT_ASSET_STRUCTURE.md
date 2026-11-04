> Archived 2026-11-04: Preserved before product repository integration. See the active documentation index.

# Current Asset Structure

현재 앱의 공식 에셋 구조는 루트 `asset/*.json` 파일의 combined JSON 구조이다.

폐기된 기준:
- `asset/**/src.json`
- `asset/**/manifest.json`
- `asset/**/study.json`
- 레벨/챕터/유닛 폴더로 나누는 마이그레이션 계획
- 기존 문제 검증 스크립트 계약

## 대상 파일

현재 앱은 `asset` 루트의 JSON 파일을 커리큘럼 후보로 읽는다.

```text
asset/
  jlpt-one-book-n1.json
  jlpt-short-term.json
  dev.json
```

`format`이 `"combined"`인 파일만 학습 커리큘럼으로 사용한다.

## Root

```json
{
  "format": "combined",
  "meta": {
    "level": "jlpt-n1",
    "title": "JLPT N1"
  },
  "days": []
}
```

- `format`: `"combined"`
- `meta.level`: JLPT 레벨 또는 내부 분류
- `meta.title`: 앱에 표시할 커리큘럼 이름
- `days`: 단원 그룹 배열

## Unit Group

`days[]`의 각 원소는 하나의 단원 그룹이다.

```json
{
  "day": []
}
```

- `day`: 실제 학습 Day 배열

## Day

```json
{
  "day": 1,
  "stage": 1,
  "stageCompleteDate": null,
  "nextReviewDate": null,
  "lastAttemptDate": "",
  "lastCompletedDate": "",
  "items": []
}
```

- `day`: 표시용 Day 번호
- `stage`: Day 단위 SRS 단계
- `stageCompleteDate`: 현재 stage를 완료한 날짜, 없으면 `null`
- `nextReviewDate`: 다음 복습 예정일, 없으면 `null`
- `lastAttemptDate`: 마지막 시도일, 없으면 `""`
- `lastCompletedDate`: 마지막 완료일, 없으면 `""`
- `items`: 학습 항목 배열

## Item

`item`은 하나의 표현 또는 한자를 학습하기 위한 최소 학습 단위다. Day의 `items` 배열에 여러 item이 들어가며, 각 item은 학습 내용·독음·메모·학습 상태와 그 item을 위한 퀴즈를 함께 가진다.

`problem`은 item 자체가 아니라 item 안에 포함되는 퀴즈 데이터다. 따라서 item은 존재하지만 `problem`이 `null`이거나 누락된 상태가 있을 수 있으며, 이 경우 학습 항목은 있지만 퀴즈가 아직 없는 상태를 뜻한다.

```json
{
  "id": "u1-i1",
  "index": 1,
  "expression": "語彙",
  "reading": "ごい",
  "meaningKo": "어휘",
  "readingParts": {
    "kanjiToKana": {
      "語": "ご",
      "彙": "い"
    },
    "restKana": ""
  },
  "problem": null,
  "lastResult": "NEUTRAL",
  "lastAttemptDate": "",
  "memoDecomposition": "",
  "memoPersonal": ""
}
```

앱 동작에 필요한 핵심 필드:
- `id`: 항목 식별자
- `index`: Day 내부 순서
- `expression`: 학습 대상 표현
- `reading` 또는 `readingParts`: 읽기 정보
- `meaningKo`: 한국어 의미
- `problem`: 이 item의 퀴즈 문제 객체, 없으면 `null`
- `lastResult`: `"NEUTRAL"`, `"PASS"`, `"FAIL"`
- `lastAttemptDate`: 마지막 시도일
- `memoDecomposition`: 한자/표현 분석 메모
- `memoPersonal`: 개인 메모

### Item과 Problem 감사 기준

- item의 `problem`이 누락되거나 `null`이면 문제 없는 item으로 분류한다.
- `problem`이 빈 객체이거나 객체가 아니면 잘못된 문제로 분류한다.
- 문제 객체는 비어 있지 않은 `sentence`, 4개의 서로 다른 `choices`, 보기 중 하나인 `answer`를 가져야 한다.
- 일반 독음 문제는 `target`이 item의 `expression`과 같고 `sentence`에 해당 표현이 들어 있어야 한다.
- `similar_expression` 문제는 별도 문제 유형이므로 `target`이 `null`일 수 있지만, 문장과 보기·정답은 유효해야 한다.
- 이 기준은 item을 삭제하거나 수정하지 않고 감사 결과만 보고한다. 현재 감사 스크립트는 `scripts/audit-missing-problems.cjs`다.

## Problem

```json
{
  "sentence": "문제 문장",
  "target": "語彙",
  "choices": ["ごい", "ごうい", "かたり", "げんご"],
  "answer": "ごい",
  "answerText": "ごい",
  "problemType": "hiragana"
}
```

- `sentence`: 문제 문장
- `target`: 문제 대상 표현
- `choices`: 선택지 배열
- `answer`: 정답
- `answerText`: 표시용 정답 텍스트
- `problemType`: 문제 유형

## Persistence

앱은 API를 통해 combined JSON 파일 안의 일부 필드를 직접 갱신한다.

저장 대상:
- Day: `stage`, `stageCompleteDate`, `nextReviewDate`, `lastAttemptDate`
- Item: `memoDecomposition`, `memoPersonal`, `problem`, `lastResult`, `lastAttemptDate`

## Future Work

검증 로직은 현재 구조 기준으로 처음부터 다시 설계한다. 기존 `src.json`, `study.json`, `manifest.json` 기반 검증 계약은 더 이상 기준으로 사용하지 않는다.
