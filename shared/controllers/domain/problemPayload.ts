import type { ProblemDraft } from "./sessionViewTypes.ts";

type ProblemPayloadInput = {
  answer: string;
  choices: string[];
  sentence: string;
  target: string;
};

export function normalizeJsonBlock(text: string) {
  const trimmed = String(text ?? "").trim();
  const codeBlockMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return codeBlockMatch ? codeBlockMatch[1].trim() : trimmed;
}

export function readProblemPayloadFromDraft(draft: ProblemDraft): ProblemPayloadInput | { error: string } {
  if (draft.mode === "json") {
    return readProblemPayloadFromJson(draft.jsonText);
  }

  return {
    sentence: draft.sentence.trim(),
    target: draft.target.trim(),
    choices: draft.choicesText
      .split(/\r?\n/)
      .map((choice) => choice.trim())
      .filter((choice) => choice.length > 0),
    answer: draft.answer.trim(),
  };
}

export function validateProblemPayload(payload: ProblemPayloadInput, mode: ProblemDraft["mode"]) {
  if (!payload.sentence) {
    return mode === "json" ? "JSON의 sentence가 비어 있습니다." : "문제를 입력하세요.";
  }

  if (payload.choices.length < 2) {
    return mode === "json" ? "JSON의 choices는 2개 이상이어야 합니다." : "보기는 2개 이상 입력하세요. (한 줄에 하나)";
  }

  if (payload.answer && !payload.choices.includes(payload.answer)) {
    return mode === "json" ? "JSON의 answer는 choices 중 하나여야 합니다." : "정답은 보기 중 하나여야 합니다.";
  }

  return "";
}

export function mergeProblemPayload(payload: ProblemPayloadInput, previousProblem: unknown) {
  const previous = typeof previousProblem === "object" && previousProblem ? (previousProblem as Record<string, unknown>) : {};
  return {
    ...previous,
    sentence: payload.sentence,
    target: payload.target,
    choices: payload.choices,
    answer: payload.answer,
    exampleSentence: previous.exampleSentence ?? null,
  };
}

function readProblemPayloadFromJson(jsonText: string): ProblemPayloadInput | { error: string } {
  try {
    const parsed = JSON.parse(String(jsonText ?? "").trim());
    return {
      sentence: String(parsed?.sentence ?? "").trim(),
      target: String(parsed?.target ?? "").trim(),
      choices: Array.isArray(parsed?.choices)
        ? parsed.choices.map((choice) => String(choice).trim()).filter((choice) => choice.length > 0)
        : [],
      answer: String(parsed?.answer ?? "").trim(),
    };
  } catch (error) {
    return {
      error: "유효한 JSON 형식이 아닙니다.",
    };
  }
}
