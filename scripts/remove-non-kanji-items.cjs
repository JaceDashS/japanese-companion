#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_FILES = [
  "asset/jlpt-one-book-n1.json",
  "asset/jlpt-short-term.json",
];
const HAN = /\p{Script=Han}/u;

function hasHanExpression(expression) {
  return HAN.test(String(expression ?? ""));
}

function getDays(group) {
  return Array.isArray(group?.day) ? group.day : [];
}

function transform(data, file) {
  const groups = Array.isArray(data?.days) ? data.days : [];
  const globalDaySequence = groups.length > 1 && groups.every((group) => getDays(group).length === 1);
  const stats = {
    file: path.relative(ROOT, file),
    globalDaySequence,
    originalGroups: groups.length,
    originalDays: groups.reduce((sum, group) => sum + getDays(group).length, 0),
    originalItems: 0,
    removedItems: 0,
    removedDays: 0,
    removedGroups: 0,
    renumberedItems: 0,
    remainingGroups: 0,
    remainingDays: 0,
    remainingItems: 0,
    removed: [],
    renamed: [],
  };

  const nextGroups = [];
  for (const group of groups) {
    const nextDays = [];
    for (const day of getDays(group)) {
      const items = Array.isArray(day.items) ? day.items : [];
      stats.originalItems += items.length;
      const keptItems = [];

      for (const item of items) {
        if (!hasHanExpression(item?.expression)) {
          if (typeof item?.expression !== "string" || !item.expression.trim()) {
            throw new Error(`${stats.file}: cannot classify item without expression: ${String(item?.id ?? "-")}`);
          }
          stats.removedItems += 1;
          stats.removed.push({ id: item.id, expression: item.expression });
        } else {
          keptItems.push(item);
        }
      }

      if (keptItems.length === 0) {
        stats.removedDays += 1;
        continue;
      }
      nextDays.push({ day, keptItems });
    }

    if (nextDays.length === 0) {
      stats.removedGroups += 1;
      continue;
    }

    const newGroupNumber = nextGroups.length + 1;
    const newDayBlocks = nextDays.map(({ day, keptItems }, dayIndex) => {
      const newDayNumber = globalDaySequence ? newGroupNumber : dayIndex + 1;
      const nextItems = keptItems.map((item, itemIndex) => {
        const nextIndex = itemIndex + 1;
        const nextId = `d${newDayNumber}-i${nextIndex}`;
        if (item.id !== nextId || item.index !== nextIndex) {
          stats.renumberedItems += 1;
          if (stats.renamed.length < 30) {
            stats.renamed.push({ from: item.id, to: nextId, expression: item.expression });
          }
        }
        return { ...item, id: nextId, index: nextIndex };
      });
      return { ...day, items: nextItems };
    });

    nextGroups.push({ ...group, day: newDayBlocks });
  }

  data.days = nextGroups;
  stats.remainingGroups = nextGroups.length;
  stats.remainingDays = nextGroups.reduce((sum, group) => sum + getDays(group).length, 0);
  stats.remainingItems = nextGroups.reduce(
    (sum, group) => sum + getDays(group).reduce((daySum, day) => daySum + (Array.isArray(day.items) ? day.items.length : 0), 0),
    0,
  );
  return stats;
}

function assertResult(data, file, stats) {
  const groups = Array.isArray(data?.days) ? data.days : [];
  const globalDaySequence = groups.length > 1 && groups.every((group) => getDays(group).length === 1);
  let itemCount = 0;
  for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
    const days = getDays(groups[groupIndex]);
    if (days.length === 0) throw new Error(`${path.relative(ROOT, file)}: empty group remained`);
    for (let dayIndex = 0; dayIndex < days.length; dayIndex += 1) {
      const expectedDayNumber = globalDaySequence ? groupIndex + 1 : dayIndex + 1;
      const items = Array.isArray(days[dayIndex].items) ? days[dayIndex].items : [];
      if (items.length === 0) throw new Error(`${path.relative(ROOT, file)}: empty day remained`);
      for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
        const item = items[itemIndex];
        const expectedId = `d${expectedDayNumber}-i${itemIndex + 1}`;
        if (!hasHanExpression(item.expression)) throw new Error(`${path.relative(ROOT, file)}: no-Han item remained: ${item.id}`);
        if (item.id !== expectedId || item.index !== itemIndex + 1) {
          throw new Error(`${path.relative(ROOT, file)}: invalid compact ID ${item.id}; expected ${expectedId}`);
        }
        itemCount += 1;
      }
    }
  }
  if (itemCount !== stats.remainingItems) throw new Error(`${path.relative(ROOT, file)}: remaining item count mismatch`);
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
  const results = [];
  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/u, ""));
    const stats = transform(data, file);
    assertResult(data, file, stats);
    if (apply) fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    results.push(stats);
  }

  console.log(`mode=${apply ? "APPLY" : "DRY-RUN"}`);
  for (const stats of results) {
    console.log(JSON.stringify({ ...stats, removed: undefined, renamed: undefined }));
    console.log(`removedSample=${JSON.stringify(stats.removed.slice(0, 8))}`);
    console.log(`renamedSample=${JSON.stringify(stats.renamed.slice(0, 8))}`);
  }
  console.log(`removedTotal=${results.reduce((sum, stats) => sum + stats.removedItems, 0)}`);
}

main();
