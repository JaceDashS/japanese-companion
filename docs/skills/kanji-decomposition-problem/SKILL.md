---
name: kanji-decomposition-problem
description: Audit and repair Japanese kanji decomposition Markdown and kana-reading multiple-choice problems in combined curriculum JSON while preserving every unrelated field.
metadata:
  short-description: 한자 분해와 독음 문제 검증
---

# 한자 분해·독음 문제 정비 스킬

combined 형식의 `asset/*.json`에서 일본어 표현의 한자 분해 메모와 독음 객관식 문제를 감사하고 필요한 부분만 고친다. 외부 사이트를 조회하지 않으며, 모델의 사전형 지식과 명시적인 추정을 사용한다.

## 변경 경계

각 item에서 수정할 수 있는 필드는 다음뿐이다.

- `memoDecomposition`
- `problem` 전체(단, 유효한 기존 problem은 그대로 보존)

`problem.choices`는 problem을 재생성할 때 함께 수정할 수 있다. 다음 값은 어떠한 경우에도 수정하지 않는다.

- `id`, `index`, `expression`, `meaningKo`, `readingParts`
- `memoPersonal`, `lastResult`, `lastAttemptDate`
- Day의 SRS 필드와 root/group 구조
- 위에 열거하지 않은 모든 키

항목을 삭제·추가하거나 순서와 배열 길이를 바꾸지 않는다. 원본이 root/day/items 구조라면 같은 구조로 저장한다.

## 작업 순서

1. `asset/*.json`의 `format: "combined"` 파일을 읽고 모든 item을 Day 순서대로 감사한다.
2. 쓰기 전에 파일별 위반 수와 변경 대상을 계산한다.
3. `memoDecomposition`은 규칙에 맞게 채우거나 갱신한다.
4. 기존 `problem`은 아래 검증을 모두 통과할 때만 byte 단위 의미를 보존한다. 하나라도 실패하면 문제 전체를 새로 생성한다.
5. 저장 후 JSON 파싱, 불변 필드 동일성, item 순서·개수·ID 동일성, 문제와 메모의 내부 규칙을 다시 검사한다.

## memoDecomposition 규칙

값은 Markdown 테이블 문자열 하나여야 하며, 테이블 행은 정확히 다음 5개만 둔다.

`音読`, `訓読`, `뜻`, `예시`, `분해`

테이블 열은 `expression`에서 왼쪽부터 추출한 Han 문자만 사용한다. 같은 한자가 반복되면 등장 횟수만큼 열을 반복한다. 한자가 없으면 열 이름은 `N/A` 하나로 하고 모든 셀을 `Wiktionary에 명시적 설명 없음`으로 둔다.

테이블 머리글은 다음 형태를 따른다.

```text
| 항목 | 한자1 | 한자2 |
|---|---|---|
```

행 사이 줄바꿈은 JSON 문자열에서 `\n`으로 저장하고, 셀 내부 줄바꿈은 `<br>`만 사용한다. 테이블 밖의 설명은 넣지 않는다.

### 독음과 뜻

- `音読`: 대표 음독을 가타카타로 쓰고 여러 개는 `・`로 구분한다.
- `訓読`: 대표 훈독을 히라가나로 쓰고 여러 개는 `・`로 구분한다.
- `readingParts.kanjiToKana`가 있으면 그 값을 정답 기준으로 포함한다. 입력값은 교정하지 않는다.
- 오쿠리가나가 있으면 `stem-restKana` 앵커를 포함한다. 예: `覆す` → `くつがえ-す`.
- `restKana`가 비어 있으면 첫 한자 열의 훈독에 `（全体）truthAnswer`를 1회 포함한다.
- `뜻`은 expression 문맥에 맞는 한국어 뜻을 1~4개로 간결하게 쓴다. 불확실한 내용은 `(추정)`을 붙인다.
- 모르는 값은 금지 문구인 `Wiktionary 확인 불가` 대신 `Wiktionary에 명시적 설명 없음`을 사용한다.

### 예시

각 한자 열의 예시는 2개 이상이며, 예시 단어마다 해당 한자를 포함해야 한다. 전체 item의 `expression`을 BAN_LIST로 삼고 expression과 완전히 같은 예시는 쓰지 않는다. 예시 형식은 다음과 같다.

`単語（よみ）: 뜻<br>単語（よみ）: 뜻`

예시가 있으면 해당 열의 `音読` 또는 `訓読`도 최소 하나는 채운다.

### 분해

`분해` 한 행에 단계별 분해와 최종 최소 단위를 함께 쓴다.

```text
1단계: 대상한자 → 부품[뜻] + 부품[뜻]<br>2단계: 부품 → 하위부품[뜻] + 하위부품[뜻]<br>최종: 부품, 부품（常用外）
```

- 부품마다 `[뜻]`을 붙인다.
- 더 의미 있는 부품으로 나눌 수 있을 때만 단계적으로 나누며, 단순 획까지는 내려가지 않는다.
- 常用 부품에는 표시하지 않고, 常用外 부품에만 `（常用外）`를 붙인다.
- 부품 형태가 불확실하면 `（常用外・推定）`을 사용한다.
- `常用`, `構成(IDS)`, `부수/부품`, `부품 역할`, `재귀 구조`, `최종 최소 단위` 같은 별도 행은 만들지 않는다.
- 분해를 확정할 수 없는 셀만 `Wiktionary에 명시적 설명 없음`으로 둔다.

## problem 규칙

한자 학습 커리큘럼의 item은 `expression`에 한자(Han 문자)가 하나 이상 포함되어야 한다. 히라가나·가타카나·영문·숫자·기호만으로 이루어진 표현은 독음 정비 전에 item 전체를 에셋에서 제거하고, 남은 item을 Day 안에서 다시 연속 번호로 정렬한다.

### truth 계산

`truthAnswer`는 기존 problem의 `answer`를 무조건 신뢰하지 않고 다음 우선순위로 고정한다.

1. 명시된 `reading` 또는 검토된 수동 독음
2. `readingParts.kanjiToKana`와 expression을 스캔해 만든 expectedAnswer
3. 합리적으로 만든 독음
4. 위 근거가 모두 없을 때만 기존 `answer`를 임시 보존하고 수동검토로 표시한다.

`truthKanjiToKana`는 입력 `readingParts.kanjiToKana`를 최우선으로 사용한다. expression을 왼쪽에서 오른쪽으로 스캔할 때 한자는 매핑값을, 비한자는 원문 문자를 그대로 붙인다. 불일치해도 readingParts나 expression을 교정하지 않는다.

### 기존 problem 보존 또는 재생성

기존 problem이 아래를 모두 만족하면 `sentence`, `target`, `choices`, `answer`와 기존의 기타 키를 그대로 보존한다.

- `sentence`, `target`, `answer`가 비어 있지 않다.
- `target === expression`이고 sentence가 target을 포함한다.
- choices가 문자열 4개이고 중복이 없다.
- answer가 choices 중 하나이며 `truthAnswer`와 같다.
- 후리가나·독음 힌트·`読みは〜` 같은 메타 힌트가 없다.
- 숫자·번호 표식·반복 치트 패턴이 없다.
- expression에 포함된 모든 연속 가나 구간(히라가나·가타카나를 정규화한 형태)은 정답과 모든 choice에서 같은 순서와 문자열로 고정한다. 오답은 한자 독음에 해당하는 가나 위치만 바꾼다. `restKana`는 매핑되지 않은 잔여 읽기를 복원할 때 참고하며, 표현 스캔 결과에 무조건 뒤에 붙이지 않는다.
- `restKana`가 truthAnswer의 실제 끝부분인 경우에만 모든 choice에서 그 접미를 고정하고, 오답 생성은 그 앞의 stem에서만 수행한다. `restKana`가 한자 독음 사이에 삽입되는 잔여 읽기라면 expression의 가나 구간 위치를 기준으로 고정한다.
- choice 길이가 restKana가 있으면 truthAnswer와 같고, 없으면 truthAnswer와의 길이 차이가 2 이하이다.

하나라도 실패하거나 problem이 null/undefined/빈 객체이면 problem 전체를 새로 만든다. 새 problem의 `target`은 expression과 같고, sentence에는 target 원문이 들어가야 한다.

### 새 choices

새 problem은 `sentence`, `target`, `choices`, `answer`만 사용한다. choices는 중복 없는 문자열 4개로 만들고 answer는 truthAnswer와 같아야 한다. 오답 3개는 truthAnswer의 1~2곳을 모라 단위로 교체·전치·삭제·삽입해 만든다.

`restKana`가 truthAnswer의 끝부분으로 확인되는 경우 오답 변형은 그 앞의 stemKana에서만 만들고 모든 choice 길이는 truthAnswer와 같게 한다. 그 외에는 expression의 고정 가나 구간을 기준으로만 변형 위치를 정한다. 정답 stem 안에 restKana와 같은 가나가 다시 나타나더라도 정답을 임의로 바꾸지 않는다. 탁점과 반탁점은 서로 다른 문자로 취급한다. 영문, 숫자, 기호, `(1)`, `1.`, `①` 같은 표식은 사용하지 않는다.

한자가 포함된 표현에서만 한자 독음 위치를 변형한다. 표현에 한자가 없으면 가나가 일부라도 변형 가능한 것처럼 보이더라도 오답을 만들지 않으며, 해당 item은 커리큘럼에서 제거한다.

## 최종 검증

쓰기 전후를 비교하여 다음을 확인한다.

- root 구조, Day 수, item 수, item 순서, `id`, `index`가 같다.
- `expression`, `meaningKo`, `readingParts`, `memoPersonal`, 학습상태·메타와 미지정 키가 같다.
- 허용된 변경은 `memoDecomposition`과 필요 시 `problem`뿐이다.
- 모든 memoDecomposition이 정확히 5행 Markdown 테이블이고 열이 expression의 Han 문자와 일치한다.
- 모든 problem이 target·sentence·answer·choices·표현 내 고정 가나·restKana 규칙을 통과한다.
- 한자가 없는 표현의 item은 커리큘럼에 남아 있지 않다.
- 유효했던 기존 problem은 변경되지 않았다.
- JSON이 다시 파싱되고 `git diff --check`가 통과한다.

빌드나 외부 사이트 조회는 이 스킬의 검증에 포함하지 않는다.
