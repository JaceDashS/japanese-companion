#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const { MANUAL_READINGS } = require("./repair-kanji-decomposition-problems.cjs");
const DEFAULT_FILES = [
  "asset/jlpt-one-book-n1.json",
  "asset/jlpt-short-term.json",
];

function normalizeKana(value) {
  if (typeof value !== "string") return "";

  return [...value]
    .map((char) => {
      const code = char.codePointAt(0);
      return code >= 0x30a1 && code <= 0x30f6
        ? String.fromCodePoint(code - 0x60)
        : char;
    })
    .filter((char) => /[ぁ-ゖー]/u.test(char))
    .join("");
}

function isHan(char) {
  const code = char.codePointAt(0);
  return (code >= 0x3400 && code <= 0x4dbf) || (code >= 0x4e00 && code <= 0x9fff);
}

function isKanaChoice(value) {
  return typeof value === "string" && /^[ぁ-ゖァ-ヺー]+$/u.test(value);
}

function storedReading(item) {
  const value = typeof item?.reading === "string" ? item.reading : "";
  if (!value || /\p{Script=Han}/u.test(value)) return "";
  return normalizeKana(value);
}

function isKanaProblem(item) {
  const problem = item?.problem;
  if (!hasHanExpression(item?.expression)) return false;
  if (problem?.problemType === "hiragana") return true;
  return Array.isArray(problem?.choices) && problem.choices.length > 0 && problem.choices.every(isKanaChoice);
}

function hasHanExpression(expression) {
  return [...String(expression ?? "")].some(isHan);
}

function hasMutableKanaPosition(expression, answer) {
  const frozen = Array([...answer].length).fill(false);
  let cursor = 0;
  const runs = (String(expression ?? "").match(/[ぁ-ゖァ-ヺー]+/gu) ?? []).map(normalizeKana).filter(Boolean);
  for (const run of runs) {
    const position = answer.indexOf(run, cursor);
    if (position < 0) return false;
    for (let index = position; index < position + [...run].length; index += 1) frozen[index] = true;
    cursor = position + [...run].length;
  }
  return frozen.some((value) => !value);
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

function getReadingMap(item) {
  const value = item?.readingParts?.kanjiToKana;
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function deriveExpectedAnswer(item) {
  const reading = storedReading(item);
  if (reading) {
    return {
      expected: reading,
      unresolved: [],
      source: "reading",
    };
  }
  const manual = MANUAL_READINGS.get(item?.expression);
  if (manual) {
    return {
      expected: manual,
      unresolved: [],
      source: "manual-reading",
    };
  }
  const expression = String(item?.expression ?? "");
  if (/[A-Za-z]/u.test(expression) && isKanaChoice(item?.problem?.answer)) {
    return {
      expected: normalizeKana(item.problem.answer),
      unresolved: [],
      source: "existing-latin-reading",
    };
  }
  const map = getReadingMap(item);
  const keys = map
    ? Object.keys(map).sort((left, right) => [...right].length - [...left].length)
    : [];
  const unresolved = [];
  let answer = "";

  for (const chars = [...expression]; chars.length;) {
    const key = keys.find((candidate) => chars.slice(0, [...candidate].length).join("") === candidate);
    if (key) {
      const reading = normalizeKana(map[key]);
      if (!reading) unresolved.push(key);
      else answer += reading;
      chars.splice(0, [...key].length);
      continue;
    }

    const char = chars.shift();
    if (/[ぁ-ゖァ-ヺー]/u.test(char)) {
      answer += normalizeKana(char);
    } else if (isHan(char)) {
      unresolved.push(char);
    }
  }

  if (answer && unresolved.length === 0) {
    return {
      expected: answer,
      unresolved: [],
      source: "readingParts",
    };
  }

  return {
    expected: "",
    unresolved,
  };
}

function parseArgs(argv) {
  const apply = argv.includes("--apply");
  const files = argv.filter((value) => value !== "--apply");
  return {
    apply,
    files: (files.length ? files : DEFAULT_FILES).map((file) => path.resolve(ROOT, file)),
  };
}

function main() {
  const { apply, files } = parseArgs(process.argv.slice(2));
  const loaded = files.map((file) => ({
    file,
    data: JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/u, "")),
  }));

  const stats = loaded.map(({ file, data }) => ({
    file: path.relative(ROOT, file),
    checked: 0,
    fixable: 0,
    manual: 0,
    items: collectItems(data, file).length,
  }));
  const statByFile = new Map(stats.map((row) => [row.file, row]));
  const fixable = [];
  const manual = [];

  for (const entry of loaded.flatMap(({ file, data }) => collectItems(data, file))) {
    const problem = entry.item?.problem;
    if (!problem || typeof problem !== "object" || Array.isArray(problem)) continue;
    if (!isKanaProblem(entry.item)) continue;

    const { expected, unresolved } = deriveExpectedAnswer(entry.item);
    const current = typeof problem.answer === "string" ? problem.answer : "";
    const isMatch = expected && normalizeKana(current) === expected;
    if (isMatch && current === expected) {
      continue;
    }

    const fileStats = statByFile.get(path.relative(ROOT, entry.file));
    if (fileStats) fileStats.checked += 1;

    if (!expected) {
      manual.push({
        ref: itemRef(entry),
        expression: entry.item.expression,
        currentAnswer: current,
        reason: "canonical reading is unresolved",
        unresolved,
      });
      if (fileStats) fileStats.manual += 1;
      continue;
    }

    if (!hasMutableKanaPosition(entry.item.expression, expected)) {
      manual.push({
        ref: itemRef(entry),
        expression: entry.item.expression,
        currentAnswer: current,
        reason: "all expression kana is fixed; four distinct choices cannot be generated",
        expectedAnswer: expected,
      });
      if (fileStats) fileStats.manual += 1;
      continue;
    }

    const choices = Array.isArray(problem.choices) ? problem.choices : [];
    const change = {
      ref: itemRef(entry),
      expression: entry.item.expression,
      currentAnswer: current,
      expectedAnswer: expected,
      expectedInChoices: choices.some((choice) => normalizeKana(choice) === expected),
    };
    fixable.push(change);
      if (fileStats) fileStats.fixable += 1;
    if (apply) problem.answer = expected;
  }

  stats.sort((left, right) => left.file.localeCompare(right.file));

  if (apply) {
    for (const { file, data } of loaded) {
      const fileName = path.relative(ROOT, file);
      const changed = fixable.some((change) => change.ref.startsWith(`${fileName} group=`));
      if (changed) fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    }
  }

  console.log(`mode=${apply ? "APPLY" : "DRY-RUN"}`);
  console.log(`fixable=${fixable.length}`);
  console.log(`manual=${manual.length}`);
  for (const row of stats) console.log(JSON.stringify(row));
  for (const row of fixable) console.log(JSON.stringify({ type: "FIXABLE", ...row }));
  for (const row of manual) console.log(JSON.stringify({ type: "MANUAL", ...row }));
}

main();
