#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_FILES = [
  "asset/dev.json",
  "asset/jlpt-one-book-n1.json",
  "asset/jlpt-short-term.json",
];

function collectItems(data, file) {
  const entries = [];
  const groups = Array.isArray(data?.days) ? data.days : [];

  groups.forEach((group, groupIndex) => {
    const days = Array.isArray(group?.day) ? group.day : [];
    days.forEach((day, dayIndex) => {
      const items = Array.isArray(day?.items) ? day.items : [];
      items.forEach((item, itemIndex) => {
        entries.push({
          item,
          file,
          groupIndex,
          dayIndex,
          itemIndex,
        });
      });
    });
  });

  return entries;
}

function itemRef(entry) {
  const item = entry.item;
  return `${path.relative(ROOT, entry.file)} group=${entry.groupIndex + 1} day=${entry.dayIndex + 1} item=${item.index ?? entry.itemIndex + 1} id=${String(item.id ?? "-")}`;
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function inspectProblem(entry) {
  const item = entry.item;
  if (!hasOwn(item, "problem") || item.problem === null || item.problem === undefined) {
    return {
      type: "MISSING_PROBLEM",
      reason: "problem is absent or null",
    };
  }

  const problem = item.problem;
  if (typeof problem !== "object" || Array.isArray(problem)) {
    return {
      type: "MALFORMED_PROBLEM",
      reason: "problem is not an object",
    };
  }

  const issues = [];
  const problemType = problem.problemType ?? "default";
  const sentence = typeof problem.sentence === "string" ? problem.sentence : "";
  const choices = Array.isArray(problem.choices) ? problem.choices : null;
  const answer = typeof problem.answer === "string" ? problem.answer : "";

  if (Object.keys(problem).length === 0) issues.push("empty-problem-object");
  if (!sentence.trim()) issues.push("empty-sentence");
  if (!choices || choices.length !== 4) {
    issues.push("choices-must-have-four-items");
  } else {
    if (choices.some((choice) => typeof choice !== "string" || !choice.trim())) {
      issues.push("choice-is-empty-or-not-string");
    }
    if (new Set(choices).size !== choices.length) issues.push("duplicate-choice");
  }
  if (!answer.trim()) issues.push("empty-answer");
  if (choices && choices.filter((choice) => choice === answer).length !== 1) {
    issues.push("answer-is-not-exactly-one-choice");
  }
  if (hasOwn(problem, "answerText") && problem.answerText !== problem.answer) {
    issues.push("answerText-mismatch");
  }

  if (problemType === "similar_expression") {
    if (problem.target !== null && typeof problem.target !== "string") {
      issues.push("similar-target-is-not-string-or-null");
    }
  } else {
    if (problem.target !== item.expression) issues.push("target-does-not-match-expression");
    if (!sentence.includes(String(item.expression ?? ""))) {
      issues.push("sentence-does-not-contain-expression");
    }
  }

  if (!issues.length) return null;
  return {
    type: "MALFORMED_PROBLEM",
    problemType,
    issues,
  };
}

function parseArgs(argv) {
  const all = argv.includes("--all");
  const files = argv.filter((value) => value !== "--all");
  return {
    all,
    files: (files.length ? files : DEFAULT_FILES).map((file) => path.resolve(ROOT, file)),
  };
}

function main() {
  const { all, files } = parseArgs(process.argv.slice(2));
  const findings = [];
  const stats = [];

  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/u, ""));
    const entries = collectItems(data, file);
    const fileFindings = entries
      .map((entry) => {
        const finding = inspectProblem(entry);
        return finding ? { ...finding, ref: itemRef(entry), expression: entry.item.expression } : null;
      })
      .filter(Boolean);

    findings.push(...fileFindings);
    stats.push({
      file: path.relative(ROOT, file),
      items: entries.length,
      problemPresent: entries.length - fileFindings.filter((finding) => finding.type === "MISSING_PROBLEM").length,
      missingProblems: fileFindings.filter((finding) => finding.type === "MISSING_PROBLEM").length,
      malformedProblems: fileFindings.filter((finding) => finding.type === "MALFORMED_PROBLEM").length,
    });
  }

  console.log("mode=REPORT-ONLY");
  for (const stat of stats) console.log(JSON.stringify(stat));
  console.log(`totalFindings=${findings.length}`);
  console.log(`missingProblems=${findings.filter((finding) => finding.type === "MISSING_PROBLEM").length}`);
  console.log(`malformedProblems=${findings.filter((finding) => finding.type === "MALFORMED_PROBLEM").length}`);

  const output = all ? findings : findings.slice(0, 20);
  for (const finding of output) console.log(JSON.stringify(finding));
  if (!all && findings.length > output.length) console.log(`details_omitted=${findings.length - output.length} (use --all)`);
}

main();
