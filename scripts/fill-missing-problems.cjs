#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require("node:fs");
const path = require("node:path");

const { MANUAL_READINGS } = require("./repair-kanji-decomposition-problems.cjs");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_FILES = ["asset/jlpt-short-term.json"];
const HAN = /\p{Script=Han}/u;
const KANA = /[ぁ-ゖァ-ヺー]/u;
const KANA_ONLY = /^[ぁ-ゖー]+$/u;
const IGNORABLE = new Set([..." \t\n・･/／()（）［］【】「」『』、，。,.・…〜～~-_"]);
const HIRAGANA_ROWS = [
  "あいうえお",
  "かきくけこ",
  "さしすせそ",
  "たちつてと",
  "なにぬねの",
  "はひふへほ",
  "まみむめも",
  "やゆよ",
  "らりるれろ",
  "わをん",
].join("");

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

function collectEntries(data, file) {
  const entries = [];
  (data.days ?? []).forEach((group, groupIndex) => {
    (group.day ?? []).forEach((day, dayIndex) => {
      (day.items ?? []).forEach((item, itemIndex) => {
        entries.push({ item, file, groupIndex, dayIndex, itemIndex });
      });
    });
  });
  return entries;
}

function itemRef(entry) {
  return `${path.relative(ROOT, entry.file)} group=${entry.groupIndex + 1} day=${entry.dayIndex + 1} item=${entry.item.index ?? entry.itemIndex + 1} id=${String(entry.item.id ?? "-")}`;
}

function entryKey(entry) {
  return `${entry.groupIndex}:${entry.dayIndex}:${entry.itemIndex}`;
}

function mapReading(item) {
  const map = item.readingParts?.kanjiToKana;
  if (!map || typeof map !== "object") return { reading: "", unresolvedHan: [], invalidChars: [] };

  const keys = Object.keys(map).sort((left, right) => [...right].length - [...left].length);
  const chars = [...String(item.expression ?? "")];
  const unresolvedHan = [];
  const invalidChars = [];
  let reading = "";

  for (let index = 0; index < chars.length;) {
    const key = keys.find((candidate) => chars.slice(index, index + [...candidate].length).join("") === candidate);
    if (key) {
      reading += normalizeKana(map[key]);
      index += [...key].length;
      continue;
    }

    const char = chars[index];
    if (KANA.test(char)) reading += normalizeKana(char);
    else if (HAN.test(char)) unresolvedHan.push(char);
    else if (!IGNORABLE.has(char)) invalidChars.push(char);
    index += 1;
  }

  return { reading, unresolvedHan, invalidChars };
}

function buildTruthAnswer(item) {
  const explicit = normalizeKana(item.reading);
  if (explicit && KANA_ONLY.test(explicit)) return { answer: explicit, source: "reading" };

  const manual = normalizeKana(MANUAL_READINGS.get(item.expression));
  if (manual && KANA_ONLY.test(manual)) return { answer: manual, source: "manual" };

  const mapped = mapReading(item);
  if (!mapped.unresolvedHan.length && !mapped.invalidChars.length && KANA_ONLY.test(mapped.reading)) {
    return { answer: mapped.reading, source: "readingParts" };
  }

  return {
    answer: "",
    source: "blocked",
    unresolvedHan: mapped.unresolvedHan,
    invalidChars: mapped.invalidChars,
    mappedReading: mapped.reading,
  };
}

function fixedKanaRuns(expression) {
  return (String(expression ?? "").match(/[ぁ-ゖァ-ヺー]+/gu) ?? [])
    .map(normalizeKana)
    .filter(Boolean);
}

function fixedKanaMask(answer, expression) {
  const chars = [...answer];
  const mask = Array(chars.length).fill(false);
  let cursor = 0;

  for (const run of fixedKanaRuns(expression)) {
    const position = answer.indexOf(run, cursor);
    if (position < 0) return null;
    for (let index = position; index < position + [...run].length; index += 1) mask[index] = true;
    cursor = position + [...run].length;
  }

  return mask;
}

function preservesFixedKanaRuns(expression, value) {
  return fixedKanaMask(value, expression) !== null;
}

function addChoice(choices, chars, mask, index, replacement, expression) {
  if (mask[index] || !replacement || replacement === chars[index]) return;
  const next = chars.slice();
  next[index] = replacement;
  const choice = next.join("");
  if (!choices.includes(choice) && preservesFixedKanaRuns(expression, choice)) choices.push(choice);
}

function makeChoices(answer, expression) {
  if (!KANA_ONLY.test(answer)) return null;
  const chars = [...answer];
  const mask = fixedKanaMask(answer, expression);
  if (!mask) return null;

  const mutableIndexes = chars.map((_, index) => index).filter((index) => !mask[index]);
  if (!mutableIndexes.length) return null;

  const choices = [answer];
  for (const index of mutableIndexes) {
    const original = chars[index];
    const rowIndex = HIRAGANA_ROWS.indexOf(original);
    const replacements = rowIndex < 0
      ? ["あ", "か", "さ", "た", "な", "ま"]
      : [
        HIRAGANA_ROWS[(rowIndex + 1) % HIRAGANA_ROWS.length],
        HIRAGANA_ROWS[(rowIndex + 2) % HIRAGANA_ROWS.length],
        HIRAGANA_ROWS[(rowIndex + 5) % HIRAGANA_ROWS.length],
        HIRAGANA_ROWS[(rowIndex + 8) % HIRAGANA_ROWS.length],
      ];
    for (const replacement of replacements) {
      addChoice(choices, chars, mask, index, replacement, expression);
      if (choices.length === 4) return choices;
    }
  }

  for (const firstIndex of mutableIndexes) {
    for (const secondIndex of mutableIndexes) {
      if (firstIndex === secondIndex) continue;
      for (const firstReplacement of ["あ", "か", "さ", "た", "な", "ま"]) {
        for (const secondReplacement of ["い", "き", "し", "ち", "に", "み"]) {
          const next = chars.slice();
          next[firstIndex] = firstReplacement;
          next[secondIndex] = secondReplacement;
          const choice = next.join("");
          if (!choices.includes(choice) && preservesFixedKanaRuns(expression, choice)) choices.push(choice);
          if (choices.length === 4) return choices;
        }
      }
    }
  }

  return null;
}

function makeProblem(item, answer) {
  const choices = makeChoices(answer, item.expression);
  if (!choices) return null;
  return {
    sentence: `会話の中で「${item.expression}」という表現を使った。`,
    target: item.expression,
    choices,
    answer,
  };
}

function problemIsValid(item, problem, expectedAnswer) {
  if (!problem || typeof problem !== "object") return false;
  if (problem.target !== item.expression) return false;
  if (typeof problem.sentence !== "string" || !problem.sentence.includes(item.expression)) return false;
  if (!Array.isArray(problem.choices) || problem.choices.length !== 4) return false;
  if (problem.choices.some((choice) => !KANA_ONLY.test(choice))) return false;
  if (new Set(problem.choices).size !== 4) return false;
  if (problem.answer !== expectedAnswer || !problem.choices.includes(problem.answer)) return false;
  return problem.choices.every((choice) => preservesFixedKanaRuns(item.expression, choice));
}

function immutableSnapshot(item) {
  const copy = JSON.parse(JSON.stringify(item));
  delete copy.problem;
  return JSON.stringify(copy);
}

function parseArgs(argv) {
  const apply = argv.includes("--apply");
  const allowBlocked = argv.includes("--allow-blocked");
  const files = argv.filter((value) => value !== "--apply" && value !== "--allow-blocked");
  return {
    apply,
    allowBlocked,
    files: (files.length ? files : DEFAULT_FILES).map((file) => path.resolve(ROOT, file)),
  };
}

function verifyAfterWrite(file, beforeEntries, expectedMissing, allowedBlocked) {
  const data = JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/u, ""));
  const afterEntries = collectEntries(data, file);
  if (afterEntries.length !== beforeEntries.length) throw new Error(`${path.relative(ROOT, file)}: item count changed`);

  for (let index = 0; index < beforeEntries.length; index += 1) {
    const before = beforeEntries[index];
    const after = afterEntries[index].item;
    if (before.item.id !== after.id || before.item.index !== after.index) throw new Error(`${path.relative(ROOT, file)}: item order or identity changed at ${index}`);
    if (before.immutable !== immutableSnapshot(after)) throw new Error(`${path.relative(ROOT, file)}: immutable item field changed at ${before.item.id}`);
    if (before.problem !== null && JSON.stringify(after.problem) !== before.problem) throw new Error(`${path.relative(ROOT, file)}: existing problem changed at ${before.item.id}`);
    if (before.problem === null && !expectedMissing.has(before.key) && !allowedBlocked.has(before.key)) throw new Error(`${path.relative(ROOT, file)}: unexpected missing problem at ${before.item.id}`);
  }

  for (const entry of afterEntries) {
    if (!expectedMissing.has(entryKey(entry))) continue;
    const expected = buildTruthAnswer(entry.item);
    if (!expected.answer || !problemIsValid(entry.item, entry.item.problem, expected.answer)) {
      throw new Error(`${path.relative(ROOT, file)}: generated problem failed validation at ${entry.item.id}`);
    }
  }
}

function main() {
  const { apply, allowBlocked, files } = parseArgs(process.argv.slice(2));
  const loaded = files.map((file) => ({
    file,
    data: JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/u, "")),
  }));
  const summaries = [];
  const staged = [];
  let blocked = 0;

  for (const { file, data } of loaded) {
    const entries = collectEntries(data, file);
    const missingBefore = entries.filter((entry) => entry.item.problem == null).length;
    const beforeEntries = entries.map((entry) => ({
      key: entryKey(entry),
      item: { id: entry.item.id, index: entry.item.index },
      immutable: immutableSnapshot(entry.item),
      problem: entry.item.problem == null ? null : JSON.stringify(entry.item.problem),
    }));
    const expectedMissing = new Set();
    const changes = [];
    const blockedItems = [];

    for (const entry of entries) {
      if (entry.item.problem != null) continue;
      const truth = buildTruthAnswer(entry.item);
      if (!truth.answer) {
        blockedItems.push({
          key: entryKey(entry),
          ref: itemRef(entry),
          id: entry.item.id,
          expression: entry.item.expression,
          unresolvedHan: truth.unresolvedHan ?? [],
          invalidChars: truth.invalidChars ?? [],
          mappedReading: truth.mappedReading ?? "",
        });
        continue;
      }
      const problem = makeProblem(entry.item, truth.answer);
      if (!problem || !problemIsValid(entry.item, problem, truth.answer)) {
        blockedItems.push({
          key: entryKey(entry),
          ref: itemRef(entry),
          id: entry.item.id,
          expression: entry.item.expression,
          answer: truth.answer,
          reason: "could-not-create-four-valid-choices",
        });
        continue;
      }
      entry.item.problem = problem;
      expectedMissing.add(entryKey(entry));
      changes.push({ id: entry.item.id, expression: entry.item.expression, answer: truth.answer, source: truth.source });
    }

    blocked += blockedItems.length;
    summaries.push({
      file: path.relative(ROOT, file),
      items: entries.length,
      missingBefore,
      filled: changes.length,
      blocked: blockedItems.length,
      samples: changes.slice(0, 12),
    });
    staged.push({ file, data, beforeEntries, expectedMissing, blockedItems });
  }

  if (apply && (blocked === 0 || allowBlocked)) {
    for (const { file, data } of staged) fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    for (const { file, beforeEntries, expectedMissing, blockedItems } of staged) {
      verifyAfterWrite(file, beforeEntries, expectedMissing, new Set(blockedItems.map((item) => item.key)));
    }
  }

  console.log(`mode=${apply && blocked === 0 ? "APPLY" : apply && allowBlocked ? "APPLY-PARTIAL" : "DRY-RUN"}`);
  for (const summary of summaries) console.log(JSON.stringify(summary));
  console.log(`blocked=${blocked}`);
  for (const { blockedItems } of staged) for (const item of blockedItems) console.log(JSON.stringify(item));
  if (apply && blocked > 0 && !allowBlocked) console.log("apply_skipped=blocked-items-present");
}

main();
