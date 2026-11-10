#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_FILES = [
  "asset/jlpt-one-book-n1.json",
  "asset/jlpt-short-term.json",
];

function normalizeText(value) {
  if (typeof value !== "string") return "";

  return [...value]
    .map((char) => {
      const code = char.codePointAt(0);
      return code >= 0x30a1 && code <= 0x30f6
        ? String.fromCodePoint(code - 0x60)
        : char;
    })
    .join("");
}

function collectItems(data, file) {
  const result = [];
  const groups = Array.isArray(data?.days) ? data.days : [];

  groups.forEach((group, groupIndex) => {
    const days = Array.isArray(group?.day) ? group.day : [];
    days.forEach((day, dayIndex) => {
      const items = Array.isArray(day?.items) ? day.items : [];
      items.forEach((item, itemIndex) => {
        result.push({
          item,
          file,
          groupIndex,
          dayIndex,
          dayLabel: day?.day ?? day?.dayIndex ?? day?.title ?? dayIndex + 1,
          itemIndex,
        });
      });
    });
  });

  return result;
}

function itemRef(entry) {
  const relative = path.relative(ROOT, entry.file);
  const item = entry.item;
  return `${relative} group=${entry.groupIndex + 1} day=${String(entry.dayLabel)} item=${item.index ?? entry.itemIndex + 1} id=${String(item.id ?? "-")}`;
}

function parseArgs(argv) {
  const files = argv.filter((value) => value !== "--all");
  return (files.length ? files : DEFAULT_FILES).map((file) => path.resolve(ROOT, file));
}

function main() {
  const files = parseArgs(process.argv.slice(2));
  const globalAnswers = new Map();
  const fileStats = [];
  const internalIssues = [];

  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/u, ""));
    const entries = collectItems(data, file);
    let problemCount = 0;
    let internalDuplicateCount = 0;
    let answerMultiplicityCount = 0;

    for (const entry of entries) {
      const problem = entry.item?.problem;
      if (!problem || typeof problem !== "object" || Array.isArray(problem)) continue;
      problemCount += 1;

      const choices = Array.isArray(problem.choices) ? problem.choices.map((choice) => String(choice)) : [];
      const byNormalizedChoice = new Map();
      choices.forEach((choice, index) => {
        const key = normalizeText(choice) || choice;
        const indexes = byNormalizedChoice.get(key) ?? [];
        indexes.push(index + 1);
        byNormalizedChoice.set(key, indexes);
      });
      const duplicates = [...byNormalizedChoice.entries()]
        .filter(([, indexes]) => indexes.length > 1)
        .map(([value, indexes]) => ({ value, indexes }));

      const answer = typeof problem.answer === "string" ? problem.answer : "";
      const answerKey = normalizeText(answer) || answer;
      const answerIndexes = choices
        .map((choice, index) => ({ choice, index: index + 1 }))
        .filter(({ choice }) => (normalizeText(choice) || choice) === answerKey)
        .map(({ index }) => index);

      if (duplicates.length > 0) {
        internalDuplicateCount += 1;
        internalIssues.push({
          type: "DUPLICATE_CHOICES",
          ref: itemRef(entry),
          expression: entry.item.expression,
          answer,
          duplicates,
          choices,
        });
      }

      if (!answer || answerIndexes.length !== 1) {
        answerMultiplicityCount += 1;
        internalIssues.push({
          type: "ANSWER_OCCURRENCE",
          ref: itemRef(entry),
          expression: entry.item.expression,
          answer,
          answerIndexes,
          choices,
        });
      }

      if (answerKey) {
        const group = globalAnswers.get(answerKey) ?? {
          answer: answerKey,
          occurrences: [],
        };
        group.occurrences.push({
          ref: itemRef(entry),
          expression: entry.item.expression,
          meaningKo: entry.item.meaningKo ?? "",
          answer,
          choices,
        });
        globalAnswers.set(answerKey, group);
      }
    }

    fileStats.push({
      file: path.relative(ROOT, file),
      items: entries.length,
      problems: problemCount,
      internalDuplicateProblems: internalDuplicateCount,
      answerOccurrenceProblems: answerMultiplicityCount,
    });
  }

  const globalDuplicateGroups = [...globalAnswers.values()]
    .filter((group) => group.occurrences.length > 1)
    .sort((left, right) => left.answer.localeCompare(right.answer));
  const sameExpressionGroups = globalDuplicateGroups.filter(
    (group) => new Set(group.occurrences.map((occurrence) => occurrence.expression)).size === 1,
  ).length;
  const differentExpressionGroups = globalDuplicateGroups.length - sameExpressionGroups;

  console.log("mode=REPORT-ONLY");
  for (const row of fileStats) console.log(JSON.stringify(row));
  console.log(`internalIssues=${internalIssues.length}`);
  console.log(`globalDuplicateAnswerGroups=${globalDuplicateGroups.length}`);
  console.log(`sameExpressionDuplicateGroups=${sameExpressionGroups}`);
  console.log(`differentExpressionDuplicateGroups=${differentExpressionGroups}`);
  for (const row of internalIssues) console.log(JSON.stringify(row));
  for (const row of globalDuplicateGroups) console.log(JSON.stringify({ type: "GLOBAL_DUPLICATE_ANSWER", ...row }));
}

main();
