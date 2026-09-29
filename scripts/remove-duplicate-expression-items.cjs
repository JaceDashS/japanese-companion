#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_FILES = ["asset/jlpt-short-term.json"];

function getDays(group) {
  return Array.isArray(group?.day) ? group.day : [];
}

function collectEntries(data, file) {
  const entries = [];
  (data.days ?? []).forEach((group, groupIndex) => {
    getDays(group).forEach((day, dayIndex) => {
      (day.items ?? []).forEach((item, itemIndex) => {
        entries.push({ item, file, group, groupIndex, dayIndex, itemIndex });
      });
    });
  });
  return entries;
}

function dayNumber(group, groupIndex, dayIndex) {
  const firstId = group?.day?.[dayIndex]?.items?.[0]?.id;
  const match = typeof firstId === "string" ? /^d(\d+)-i\d+$/u.exec(firstId) : null;
  if (match) return match[1];
  return group?.day?.length === 1 ? String(groupIndex + 1) : String(dayIndex + 1);
}

function entryKey(entry) {
  return `${entry.groupIndex}:${entry.dayIndex}:${entry.itemIndex}`;
}

function itemRef(entry) {
  const item = entry.item;
  return `${path.relative(ROOT, entry.file)} group=${entry.groupIndex + 1} day=${dayNumber(entry.group, entry.groupIndex, entry.dayIndex)} item=${item.index ?? entry.itemIndex + 1} id=${String(item.id ?? "-")}`;
}

function duplicateKey(item) {
  return JSON.stringify([String(item?.expression ?? ""), String(item?.meaningKo ?? "")]);
}

function snapshotWithoutIdentity(item) {
  const copy = JSON.parse(JSON.stringify(item));
  delete copy.id;
  delete copy.index;
  return JSON.stringify(copy);
}

function transform(data, file) {
  const seen = new Map();
  const removed = [];
  const renamed = [];
  let originalItems = 0;
  let keptItems = 0;

  for (const [groupIndex, group] of (data.days ?? []).entries()) {
    for (const [dayIndex, day] of getDays(group).entries()) {
      const items = Array.isArray(day.items) ? day.items : [];
      originalItems += items.length;
      const kept = [];
      for (const [itemIndex, item] of items.entries()) {
        const key = duplicateKey(item);
        const first = seen.get(key);
        if (first) {
          removed.push({
            ref: `${path.relative(ROOT, file)} group=${groupIndex + 1} day=${dayNumber(group, groupIndex, dayIndex)} item=${item.index ?? itemIndex + 1} id=${String(item.id ?? "-")}`,
            key: `${groupIndex}:${dayIndex}:${itemIndex}`,
            id: item.id,
            expression: item.expression,
            meaningKo: item.meaningKo,
            kept: first,
          });
          continue;
        }
        seen.set(key, String(item.id ?? `${groupIndex + 1}-${dayIndex + 1}-${itemIndex + 1}`));
        kept.push(item);
      }

      const nextItems = kept.map((item, itemIndex) => {
        const nextIndex = itemIndex + 1;
        const nextId = `d${dayNumber(group, groupIndex, dayIndex)}-i${nextIndex}`;
        if (item.id !== nextId || item.index !== nextIndex) {
          renamed.push({ from: item.id, to: nextId, expression: item.expression });
          item.id = nextId;
          item.index = nextIndex;
        }
        return item;
      });
      day.items = nextItems;
      keptItems += nextItems.length;
    }
  }

  return {
    file: path.relative(ROOT, file),
    originalItems,
    removedItems: removed.length,
    remainingItems: keptItems,
    renamedItems: renamed.length,
    removed,
    renamed,
  };
}

function assertResult(data, file, stats) {
  const seen = new Set();
  let itemCount = 0;
  for (const [groupIndex, group] of (data.days ?? []).entries()) {
    const days = getDays(group);
    if (!days.length) throw new Error(`${path.relative(ROOT, file)}: empty group remained`);
    for (const [dayIndex, day] of days.entries()) {
      const items = Array.isArray(day.items) ? day.items : [];
      if (!items.length) throw new Error(`${path.relative(ROOT, file)}: empty day remained`);
      for (const [itemIndex, item] of items.entries()) {
        const expectedId = `d${dayNumber(group, groupIndex, dayIndex)}-i${itemIndex + 1}`;
        if (item.id !== expectedId || item.index !== itemIndex + 1) {
          throw new Error(`${path.relative(ROOT, file)}: invalid compact identity ${item.id}; expected ${expectedId}`);
        }
        const key = duplicateKey(item);
        if (seen.has(key)) throw new Error(`${path.relative(ROOT, file)}: duplicate expression/meaning remained: ${item.expression}`);
        seen.add(key);
        itemCount += 1;
      }
    }
  }
  if (itemCount !== stats.remainingItems) throw new Error(`${path.relative(ROOT, file)}: item count mismatch`);
}

function parseArgs(argv) {
  const apply = argv.includes("--apply");
  const files = argv.filter((value) => value !== "--apply");
  return {
    apply,
    files: (files.length ? files : DEFAULT_FILES).map((file) => path.resolve(ROOT, file)),
  };
}

function verifyWrite(file, beforeEntries, expectedRemovedKeys) {
  const data = JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/u, ""));
  const afterEntries = collectEntries(data, file);
  if (afterEntries.length !== beforeEntries.length - expectedRemovedKeys.size) {
    throw new Error(`${path.relative(ROOT, file)}: post-write item count mismatch`);
  }

  const afterByKey = new Map(afterEntries.map((entry) => [duplicateKey(entry.item), entry.item]));
  for (const before of beforeEntries) {
    if (expectedRemovedKeys.has(before.entryKey)) continue;
    const after = afterByKey.get(before.duplicateKey);
    if (!after) throw new Error(`${path.relative(ROOT, file)}: kept item disappeared: ${before.item.id}`);
    if (before.withoutIdentity !== snapshotWithoutIdentity(after)) {
      throw new Error(`${path.relative(ROOT, file)}: kept item content changed: ${before.item.id}`);
    }
  }
}

function main() {
  const { apply, files } = parseArgs(process.argv.slice(2));
  const staged = [];

  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/u, ""));
    const beforeEntries = collectEntries(data, file).map((entry) => ({
      entryKey: entryKey(entry),
      item: { id: entry.item.id, expression: entry.item.expression },
      duplicateKey: duplicateKey(entry.item),
      withoutIdentity: snapshotWithoutIdentity(entry.item),
    }));
    const stats = transform(data, file);
    assertResult(data, file, stats);
    staged.push({ file, data, beforeEntries, stats, expectedRemovedKeys: new Set(stats.removed.map((row) => row.key)) });
  }

  if (apply) {
    for (const { file, data } of staged) fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    for (const { file, beforeEntries, expectedRemovedKeys } of staged) verifyWrite(file, beforeEntries, expectedRemovedKeys);
  }

  console.log(`mode=${apply ? "APPLY" : "DRY-RUN"}`);
  for (const { stats } of staged) {
    console.log(JSON.stringify({
      file: stats.file,
      originalItems: stats.originalItems,
      removedItems: stats.removedItems,
      remainingItems: stats.remainingItems,
      renamedItems: stats.renamedItems,
    }));
    console.log(`removedSample=${JSON.stringify(stats.removed.slice(0, 30))}`);
    console.log(`renamedSample=${JSON.stringify(stats.renamed.slice(0, 30))}`);
  }
}

main();
