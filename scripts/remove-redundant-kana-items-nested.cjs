#!/usr/bin/env node
/**
 * Repack nested combined assets such as jlpt-one-book-n1.json.
 * Each top-level group is treated as its own Day namespace because these
 * assets intentionally restart IDs at d1-i1 for every group.
 */

const fs = require("node:fs");
const path = require("node:path");

const ITEMS_PER_DAY = 20;
const DEFAULT_TARGET = path.resolve(__dirname, "..", "asset", "jlpt-one-book-n1.json");
const HIRAGANA_ONLY = /^[\u3041-\u3096]+$/u;
const KATAKANA = /\p{Script=Katakana}/u;
const KATAKANA_MARK = /[\p{P}\p{Z}\u30FC]/u;

function isRemovalTarget(item) {
  const expression = item?.expression;
  if (typeof expression !== "string") return false;
  if (HIRAGANA_ONLY.test(expression)) return true;
  const chars = [...expression];
  return chars.some((char) => KATAKANA.test(char))
    && chars.every((char) => KATAKANA.test(char) || KATAKANA_MARK.test(char));
}

function repackGroup(group, groupIndex) {
  if (!group || !Array.isArray(group.day) || group.day.length < 1) {
    throw new Error(`Group ${groupIndex + 1} has no day objects.`);
  }
  const retained = [];
  let removed = 0;
  group.day.forEach((day, sourceDayIndex) => {
    if (!day || !Array.isArray(day.items)) throw new Error(`Group ${groupIndex + 1} day ${sourceDayIndex + 1} has no items.`);
    day.items.forEach((item) => {
      if (isRemovalTarget(item)) removed += 1;
      else retained.push({ item, sourceDayIndex });
    });
  });

  const packedDays = [];
  for (let offset = 0; offset < retained.length; offset += ITEMS_PER_DAY) {
    const chunk = retained.slice(offset, offset + ITEMS_PER_DAY);
    const dayNumber = Math.floor(offset / ITEMS_PER_DAY) + 1;
    const metadataSource = group.day[chunk.at(-1).sourceDayIndex];
    const { items: _discardedItems, ...metadata } = metadataSource;
    packedDays.push({
      items: chunk.map(({ item }, itemOffset) => ({
        ...item,
        index: itemOffset + 1,
        id: `d${dayNumber}-i${itemOffset + 1}`,
      })),
      ...metadata,
    });
  }
  return { group: { ...group, day: packedDays }, removed, beforeItems: retained.length + removed };
}

function validateGroup(group, groupIndex) {
  const items = group.day.flatMap((day) => day.items);
  group.day.forEach((day, dayIndex) => {
    const expectedSize = dayIndex < group.day.length - 1
      ? ITEMS_PER_DAY
      : (items.length % ITEMS_PER_DAY || ITEMS_PER_DAY);
    if (day.items.length !== expectedSize) throw new Error(`Group ${groupIndex + 1} day ${dayIndex + 1} has invalid size.`);
    day.items.forEach((item, itemIndex) => {
      const index = itemIndex + 1;
      if (item.index !== index || item.id !== `d${dayIndex + 1}-i${index}`) throw new Error(`Group ${groupIndex + 1} has invalid ID/index.`);
      if (isRemovalTarget(item)) throw new Error(`Group ${groupIndex + 1} retains ${item.expression}.`);
    });
  });
}

function main() {
  const apply = process.argv.includes("--apply");
  const targetArg = process.argv.slice(2).find((arg) => arg !== "--apply");
  const target = path.resolve(targetArg ?? DEFAULT_TARGET);
  const data = JSON.parse(fs.readFileSync(target, "utf8").replace(/^\uFEFF/u, ""));
  if (!data || data.format !== "combined" || !Array.isArray(data.days)) throw new Error("Target must be a combined asset.");

  let beforeItems = 0;
  let afterItems = 0;
  let removedItems = 0;
  const transformed = {
    ...data,
    days: data.days.map((group, groupIndex) => {
      const result = repackGroup(group, groupIndex);
      beforeItems += result.beforeItems;
      afterItems += result.group.day.reduce((sum, day) => sum + day.items.length, 0);
      removedItems += result.removed;
      return result.group;
    }),
  };
  transformed.days.forEach(validateGroup);
  console.log(`mode=${apply ? "APPLY" : "DRY-RUN"}`);
  console.log(`groups=${transformed.days.length}`);
  console.log(`before_items=${beforeItems}`);
  console.log(`after_items=${afterItems}`);
  console.log(`removed_items=${removedItems}`);
  console.log(`day_counts=${transformed.days.map((group) => group.day.length).join(",")}`);
  if (apply) {
    fs.writeFileSync(target, `${JSON.stringify(transformed, null, 2)}\n`, "utf8");
    console.log(`written=${target}`);
  }
}

main();
