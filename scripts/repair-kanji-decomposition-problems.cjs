#!/usr/bin/env node
/**
 * Repair decomposition tables and kana-reading problems without changing
 * curriculum structure or learning metadata.
 *
 * The script is intentionally conservative: it preserves valid problems,
 * derives readings from local asset data, and reports items for which the
 * stored restKana makes distractor generation impossible.
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_FILES = [
  "asset/dev.json",
  "asset/jlpt-one-book-n1.json",
  "asset/jlpt-short-term.json",
];
const UNKNOWN = "Wiktionary에 명시적 설명 없음";
const HAN = /\p{Script=Han}/u;
const KANA = /[ぁ-ゖァ-ヺー]/u;
const KANA_ONLY = /^[ぁ-ゖァ-ヺー]+$/u;
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

const MANUAL_READINGS = new Map(Object.entries({
  粘膜: "ねんまく",
  措置: "そち",
  債務: "さいむ",
  顕著に: "けんちょに",
  廃れる: "すたれる",
  蓄える: "たくわえる",
  多岐にわたる: "たきにわたる",
  健やか: "すこやか",
  愚かな: "おろかな",
  憩い: "いこい",
  心地よい: "ここちよい",
  踏襲する: "とうしゅうする",
  円滑: "えんかつ",
  沈黙: "ちんもく",
  柔軟: "じゅうなん",
  償い: "つぐない",
  滞: "とどこおって",
  憤って: "いきどおって",
  費やして: "ついやして",
  潤って: "うるおって",
  慕われて: "したわれて",
  貫いて: "つらぬいて",
  迫って: "せまって",
  脱して: "だっして",
  賄って: "まかなって",
  澄んだ: "すんだ",
  倣って: "したがって",
  促した: "うながした",
  委託する: "いたくする",
  任せる: "まかせる",
  爽やかな: "さわやかな",
  自分の尺度: "じぶんのしゃくど",
  肝心な話: "かんじんなはなし",
  この地方のしきたり: "このちほうのしきたり",
  友人に触発される: "ゆうじんにしょくはつされる",
  彼の言動に閉口した: "かれのげんどうにへいこうした",
  気ままな生活: "きままなせいかつ",
  手分け: "てわけ",
  てきぱきと処理する: "てきぱきとしょりする",
  必要な資金を調達した: "ひつようなしきんをちょうたつした",
  温和な性格: "おんわなせいかく",
  実力は拮抗する: "じつりょくはきっこうする",
  あどけない表情: "あどけないひょうじょう",
  リスクが伴う: "りすくがともなう",
  アイデアを絶賛する: "あいであをぜっさんする",
  出馬する: "しゅつばする",
  "寡黙な(人)": "かもくなひと",
  "(会議が)紛糾した": "かいぎがふんきゅうした",
  "不審な(点)": "ふしんなてん",
  "（社会の）風潮": "しゃかいのふうちょう",
  "（別の事業の収益で）補填する": "べつのじぎょうのしゅうえきでほてんする",
  "（研究に）没頭": "けんきゅうにぼっとう",
  "（海外の支社に）赴任": "かいがいのししゃにふにん",
  一括: "いっかつ",
  高尚: "こうしょう",
  脈絡: "みゃくらく",
  方法: "ほうほう",
  難点: "なんてん",
  決意: "けつい",
  突然: "とつぜん",
  皮肉: "ひにく",
  発言を撤回する: "はつげんをてっかいする",
  断じて: "だんじて",
  "絶大な(人気)": "ぜつだいなにんき",
  "（工場を）誘致する": "こうじょうをゆうちする",
  "（商品の）出荷": "しょうひんのしゅっか",
  "（大事な場面での）底力": "だいじなばめんでのそこぢから",
  巧みな技術: "たくみなぎじゅつ",
  調査に乗り出す: "ちょうさにのりだす",
  "（一部分を）抜粋": "いちぶぶんをばっすい",
  "（安全装置が）作動": "あんぜんそうちがさどう",
  "（研究に）没頭": "けんきゅうにぼっとう",
  今更: "いまさら",
  責任をとって辞任: "せきにんをとってじにん",
  現実味を帯びる: "げんじつみをおびる",
  "思い詰めた(表情)": "おもいつめたひょうじょう",
  破損がはなはだしい: "はそんがはなはだしい",
  Tシャツ: "てぃーしゃつ",
  Eメール: "いーめーる",
  "アクセス（する）": "あくせすする",
  "アップ（する）": "あっぷする",
  "アドバイス（する）": "あどばいする",
}));

function normalizeKana(value) {
  if (typeof value !== "string") return "";
  return [...value]
    .map((char) => {
      const code = char.codePointAt(0);
      return code >= 0x30a1 && code <= 0x30f6
        ? String.fromCodePoint(code - 0x60)
        : char;
    })
    .join("")
    .replace(/[\s・･/／()（）［］【】「」『』、，。,.・…〜～~'"`]/gu, "")
    .replace(/-/gu, "")
    .replace(/[^ぁ-ゖー]/gu, "");
}

function tableCells(line) {
  if (!line.startsWith("|") || !line.endsWith("|")) return null;
  return line.slice(1, -1).split("|").map((cell) => cell.trim());
}

function parseTable(value) {
  if (typeof value !== "string") return null;
  const rows = new Map();
  const lines = value.split("\n");
  for (const line of lines) {
    const cells = tableCells(line);
    if (cells && cells.length > 1) rows.set(cells[0].replace(/\s*\(.+$/u, "").trim(), cells.slice(1));
  }
  return rows;
}

function collectItems(data) {
  const items = [];
  const visit = (value) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== "object") return;
    if (typeof value.expression === "string") {
      items.push(value);
      return;
    }
    Object.values(value).forEach((child) => {
      if (Array.isArray(child) || (child && typeof child === "object")) visit(child);
    });
  };
  for (const group of data.days ?? []) visit(group.day);
  return items;
}

function expressionHanChars(expression) {
  return [...expression].filter((char) => HAN.test(char));
}

function mapReading(item, map) {
  if (!map || typeof map !== "object") return "";
  if (typeof map[item.expression] === "string") return normalizeKana(map[item.expression]);
  const chars = [...item.expression];
  let output = "";
  for (let index = 0; index < chars.length;) {
    let bestKey = "";
    for (const key of Object.keys(map)) {
      if ([...key].length <= [...bestKey].length) continue;
      if (chars.slice(index, index + [...key].length).join("") === key) bestKey = key;
    }
    if (bestKey) {
      output += normalizeKana(map[bestKey]);
      index += [...bestKey].length;
      continue;
    }
    const char = chars[index];
    if (KANA.test(char)) output += normalizeKana(char);
    index += 1;
  }
  return output;
}

function surfaceKana(expression) {
  return normalizeKana([...expression].filter((char) => KANA.test(char)).join(""));
}

function isKanaAnswer(value) {
  return typeof value === "string" && value.length > 0 && KANA_ONLY.test(value);
}

function addCandidate(map, expression, value, score) {
  const normalized = normalizeKana(value);
  if (!normalized) return;
  if (!map.has(expression)) map.set(expression, []);
  map.get(expression).push({ value: normalized, score });
}

function kanaGroups(value) {
  return (String(value ?? "").match(/[ぁ-ゖァ-ヺー]+/gu) ?? []).map(normalizeKana).filter(Boolean);
}

function oldReadingCandidates(item, charCandidates) {
  const rows = parseTable(item.memoDecomposition);
  const chars = expressionHanChars(item.expression);
  const suffix = surfaceKana(item.expression);
  const candidates = [];
  const problemAnswer = isKanaAnswer(item.problem?.answer) ? normalizeKana(item.problem.answer) : "";
  if (problemAnswer && (!suffix || problemAnswer.endsWith(suffix))) candidates.push({ value: problemAnswer, score: 145 });
  if (problemAnswer && suffix && problemAnswer.length < 24) candidates.push({ value: problemAnswer + suffix, score: 125 });

  const stems = [];
  const sounds = [];
  for (let index = 0; index < chars.length; index += 1) {
    const kun = rows?.get("訓読")?.[index] ?? "";
    const on = rows?.get("音読")?.[index] ?? "";
    const hyphenPart = kun.split("-")[0];
    const stem = normalizeKana(hyphenPart);
    const kunGroup = kanaGroups(kun)[0] ?? "";
    const onGroup = kanaGroups(on)[0] ?? "";
    if (stem) stems.push(stem);
    else if (kunGroup) stems.push(kunGroup);
    else stems.push("");
    if (onGroup) sounds.push(onGroup);
    else if (charCandidates.get(chars[index])) sounds.push(charCandidates.get(chars[index]));
    else sounds.push("");
  }
  if (stems.every(Boolean)) candidates.push({ value: stems.join("") + suffix, score: 155 });
  if (sounds.every(Boolean)) candidates.push({ value: sounds.join("") + suffix, score: 105 });
  return candidates;
}

function chooseBest(candidates) {
  const unique = new Map();
  for (const candidate of candidates) {
    if (!candidate?.value) continue;
    const previous = unique.get(candidate.value);
    if (!previous || previous.score < candidate.score) unique.set(candidate.value, candidate);
  }
  return [...unique.values()].sort((a, b) => b.score - a.score)[0]?.value ?? "";
}

function makeKanaChoices(answer, restKana) {
  const rest = normalizeKana(restKana);
  if (!answer || (rest && !answer.endsWith(rest))) return null;
  const stem = rest ? answer.slice(0, -rest.length) : answer;
  if (!stem) return null;
  const choices = [answer];
  for (let index = 0; index < stem.length && choices.length < 4; index += 1) {
    const original = stem[index];
    const replacements = [
      HIRAGANA_ROWS[(HIRAGANA_ROWS.indexOf(original) + 1) % HIRAGANA_ROWS.length],
      HIRAGANA_ROWS[(HIRAGANA_ROWS.indexOf(original) + 2) % HIRAGANA_ROWS.length],
      HIRAGANA_ROWS[(HIRAGANA_ROWS.indexOf(original) + 5) % HIRAGANA_ROWS.length],
    ];
    for (const replacement of replacements) {
      if (!replacement || replacement === original) continue;
      const choice = stem.slice(0, index) + replacement + stem.slice(index + 1) + rest;
      if (!choices.includes(choice)) choices.push(choice);
      if (choices.length === 4) break;
    }
  }
  if (choices.length < 4) {
    for (let index = 0; index < stem.length && choices.length < 4; index += 1) {
      for (const replacement of ["あ", "か", "さ", "た", "な", "ま"]) {
        const choice = stem.slice(0, index) + replacement + stem.slice(index + 1) + rest;
        if (!choices.includes(choice)) choices.push(choice);
        if (choices.length === 4) break;
      }
    }
  }
  return choices.length === 4 ? choices : null;
}

function problemIsValid(item, expectedReading) {
  const problem = item.problem;
  if (!problem || typeof problem !== "object") return false;
  if (typeof problem.sentence !== "string" || !problem.sentence) return false;
  if (problem.target !== item.expression || !problem.sentence.includes(item.expression)) return false;
  if (typeof problem.answer !== "string" || !problem.answer) return false;
  if (!Array.isArray(problem.choices) || problem.choices.length !== 4) return false;
  if (problem.choices.some((choice) => typeof choice !== "string" || !choice || !isKanaAnswer(choice))) return false;
  if (new Set(problem.choices).size !== 4 || !problem.choices.includes(problem.answer)) return false;
  if (expectedReading && problem.answer !== expectedReading) return false;
  const rest = normalizeKana(item.readingParts?.restKana);
  if (rest) {
    if (problem.choices.some((choice) => !choice.endsWith(rest) || [...choice].length !== [...problem.answer].length)) return false;
  } else if (problem.choices.some((choice) => Math.abs([...choice].length - [...problem.answer].length) > 2)) {
    return false;
  }
  const text = JSON.stringify({ choices: problem.choices, answer: problem.answer });
  if (/[0-9０-９①②③④⑤⑥⑦⑧⑨⑩]|読みは|読み方|正解|答え|選択肢/.test(text)) return false;
  return true;
}

function memoIsValid(item) {
  const value = item.memoDecomposition;
  if (typeof value !== "string") return false;
  const lines = value.split("\n");
  const chars = expressionHanChars(item.expression);
  if (lines.length !== 7) return false;
  const header = tableCells(lines[0]);
  const separator = tableCells(lines[1]);
  const expectedHeader = chars.length ? chars.join("") : "N/A";
  if (!header || !separator || header[0] !== "항목" || header.slice(1).join("") !== expectedHeader) return false;
  if (separator.length !== header.length || separator.some((cell) => cell !== "---")) return false;
  const labels = ["音読", "訓読", "뜻", "예시", "분해"];
  const rows = labels.map((label, index) => {
    const cells = tableCells(lines[index + 2]);
    return cells && cells[0] === label && cells.length === header.length ? cells.slice(1) : null;
  });
  if (rows.some((row) => !row || row.some((cell) => !cell))) return false;
  if (!chars.length) return rows.every((row) => row.every((cell) => cell === UNKNOWN));
  for (let index = 0; index < chars.length; index += 1) {
    const examples = rows[3][index];
    if ((examples.match(new RegExp(chars[index], "gu")) ?? []).length < 2) return false;
  }
  return true;
}

function collectKnowledge(allItems, candidateMap) {
  const charCandidates = new Map();
  const charMeta = new Map();
  const examplePool = new Map();
  const addChar = (char, category, value) => {
    if (!value || value === UNKNOWN) return;
    if (!charMeta.has(char)) charMeta.set(char, { on: [], kun: [], meaning: [], decomp: [], examples: [] });
    const list = charMeta.get(char)[category];
    if (!list.includes(value)) list.push(value);
  };
  for (const item of allItems) {
    const map = item.readingParts?.kanjiToKana;
    if (map && typeof map === "object") {
      for (const [key, value] of Object.entries(map)) {
        if ([...key].length === 1 && HAN.test(key)) {
          const reading = normalizeKana(value);
          if (reading) {
            if (!charCandidates.has(key)) charCandidates.set(key, new Map());
            const counts = charCandidates.get(key);
            counts.set(reading, (counts.get(reading) ?? 0) + 10);
            addChar(key, "on", reading.toUpperCase());
          }
        }
      }
    }
    const rows = parseTable(item.memoDecomposition);
    const chars = expressionHanChars(item.expression);
    for (let index = 0; index < chars.length; index += 1) {
      const char = chars[index];
      const on = rows?.get("音読")?.[index];
      const kun = rows?.get("訓読")?.[index];
      const meaning = rows?.get("뜻")?.[index];
      const examples = rows?.get("예시")?.[index];
      const decomposition = rows?.get("분해")?.[index] ?? rows?.get("최종 최소 단위")?.[index];
      for (const value of kanaGroups(on)) {
        if (!charCandidates.has(char)) charCandidates.set(char, new Map());
        const counts = charCandidates.get(char);
        counts.set(value, (counts.get(value) ?? 0) + 2);
      }
      if (on) addChar(char, "on", on);
      if (kun) addChar(char, "kun", kun);
      if (meaning) addChar(char, "meaning", meaning);
      if (decomposition) addChar(char, "decomp", decomposition);
      if (examples) addChar(char, "examples", examples);
    }
  }
  for (const item of allItems) {
    const reading = chooseBest(candidateMap.get(item.expression) ?? []);
    const chars = new Set(expressionHanChars(item.expression));
    for (const char of chars) {
      if (!examplePool.has(char)) examplePool.set(char, []);
      if (item.expression === char || item.expression === "") continue;
      const example = `${item.expression}（${reading || surfaceKana(item.expression) || "?"}）: ${item.meaningKo || "예시"}`;
      if (!examplePool.get(char).includes(example)) examplePool.get(char).push(example);
    }
  }
  const bestChar = new Map();
  for (const [char, counts] of charCandidates) {
    bestChar.set(char, [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]);
  }
  return { charCandidates: bestChar, charMeta, examplePool };
}

function buildReading(item, candidateMap, charCandidates) {
  const candidates = [...(candidateMap.get(item.expression) ?? [])];
  const manual = MANUAL_READINGS.get(item.expression);
  if (manual) candidates.push({ value: manual, score: 250 });
  candidates.push(...oldReadingCandidates(item, charCandidates).map((candidate) => ({ ...candidate, score: candidate.score + 10 })));
  const map = item.readingParts?.kanjiToKana;
  const mapped = mapReading(item, map);
  if (mapped) candidates.push({ value: mapped, score: 300 });
  const chars = expressionHanChars(item.expression);
  if (!chars.length) candidates.push({ value: surfaceKana(item.expression), score: 80 });
  else {
    const pieces = chars.map((char) => charCandidates.get(char) ?? "");
    if (pieces.every(Boolean)) candidates.push({ value: pieces.join("") + surfaceKana(item.expression), score: 70 });
  }
  const best = chooseBest(candidates);
  return best;
}

function buildMemo(item, knowledge, reading) {
  const chars = expressionHanChars(item.expression);
  const header = chars.length ? chars : ["N/A"];
  const row = (label, values) => `| ${label} | ${values.join(" | ")} |`;
  if (!chars.length) {
    return [
      row("항목", header),
      row("---", header.map(() => "---")),
      row("音読", header.map(() => UNKNOWN)),
      row("訓読", header.map(() => UNKNOWN)),
      row("뜻", header.map(() => UNKNOWN)),
      row("예시", header.map(() => UNKNOWN)),
      row("분해", header.map(() => UNKNOWN)),
    ].join("\n");
  }
  const on = [];
  const kun = [];
  const meaning = [];
  const examples = [];
  const decomposition = [];
  const itemRows = parseTable(item.memoDecomposition);
  for (let index = 0; index < chars.length; index += 1) {
    const char = chars[index];
    const meta = knowledge.charMeta.get(char) ?? { on: [], kun: [], meaning: [], decomp: [] };
    const charReading = knowledge.charCandidates.get(char) ?? "";
    const oldOn = itemRows?.get("音読")?.[index];
    const oldKun = itemRows?.get("訓読")?.[index];
    const oldMeaning = itemRows?.get("뜻")?.[index];
    const oldDecomp = itemRows?.get("분해")?.[index] ?? itemRows?.get("최종 최소 단위")?.[index];
    on.push(oldOn || meta.on[0] || (charReading ? charReading.replace(/[ぁ-ゖー]/gu, (c) => String.fromCodePoint(c.codePointAt(0) + 0x60)).toUpperCase() : UNKNOWN));
    const rest = normalizeKana(item.readingParts?.restKana);
    const kunValue = oldKun || meta.kun[0] || (rest && index === 0 && reading.endsWith(rest)
      ? `${reading.slice(0, -rest.length)}-${rest}`
      : UNKNOWN);
    kun.push(kunValue);
    meaning.push(oldMeaning || meta.meaning[0] || item.meaningKo || UNKNOWN);
    const pool = (knowledge.examplePool.get(char) ?? []).filter((value) => !value.startsWith(`${item.expression}（`));
    while (pool.length < 2) pool.push(`${char}例${pool.length + 1}（${charReading || "よみ"}）: ${UNKNOWN}`);
    examples.push(pool.slice(0, 2).join("<br>"));
    decomposition.push(oldDecomp || meta.decomp[0] || UNKNOWN);
  }
  return [
    row("항목", header),
    row("---", header.map(() => "---")),
    row("音読", on),
    row("訓読", kun),
    row("뜻", meaning),
    row("예시", examples),
    row("분해", decomposition),
  ].join("\n");
}

function makeProblem(item, reading) {
  const rest = normalizeKana(item.readingParts?.restKana);
  const choices = makeKanaChoices(reading, rest);
  if (!choices) return null;
  const existingSentence = item.problem?.sentence;
  const sentence = typeof existingSentence === "string" && existingSentence.includes(item.expression)
    ? existingSentence
    : `会話の中で「${item.expression}」という表現を使った。`;
  return { sentence, target: item.expression, choices, answer: reading };
}

function parseArgs(argv) {
  const apply = argv.includes("--apply");
  const files = argv.filter((value) => value !== "--apply");
  return { apply, files: files.length ? files.map((file) => path.resolve(ROOT, file)) : DEFAULT_FILES.map((file) => path.resolve(ROOT, file)) };
}

function main() {
  const { apply, files } = parseArgs(process.argv.slice(2));
  const loaded = files.map((file) => ({ file, data: JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/u, "")) }));
  const allItems = loaded.flatMap(({ data }) => collectItems(data));
  const candidateMap = new Map();
  for (const item of allItems) {
    const manual = MANUAL_READINGS.get(item.expression);
    if (manual) addCandidate(candidateMap, item.expression, manual, 250);
    const mapped = mapReading(item, item.readingParts?.kanjiToKana);
    if (mapped) addCandidate(candidateMap, item.expression, mapped, 220);
    if (isKanaAnswer(item.problem?.answer)) addCandidate(candidateMap, item.expression, item.problem.answer, 60);
  }
  const firstKnowledge = collectKnowledge(allItems, candidateMap);
  for (const item of allItems) {
    for (const candidate of oldReadingCandidates(item, firstKnowledge.charCandidates)) {
      addCandidate(candidateMap, item.expression, candidate.value, candidate.score);
    }
  }
  const knowledge = collectKnowledge(allItems, candidateMap);
  const blocked = [];
  const stats = [];
  for (const { file, data } of loaded) {
    const items = collectItems(data);
    let memoChanged = 0;
    let problemChanged = 0;
    let preservedProblems = 0;
    let blockedProblems = 0;
    for (const item of items) {
      const reading = buildReading(item, candidateMap, knowledge.charCandidates);
      if (!memoIsValid(item)) {
        item.memoDecomposition = buildMemo(item, knowledge, reading);
        memoChanged += 1;
      }
      const expected = reading || (isKanaAnswer(item.problem?.answer) ? normalizeKana(item.problem.answer) : "");
      if (problemIsValid(item, expected)) {
        preservedProblems += 1;
        continue;
      }
      const problem = makeProblem(item, expected);
      if (!problem) {
        blockedProblems += 1;
        blocked.push({ file: path.relative(ROOT, file), id: item.id, expression: item.expression, restKana: item.readingParts?.restKana || "", reading: expected });
        continue;
      }
      item.problem = problem;
      problemChanged += 1;
    }
    stats.push({ file: path.relative(ROOT, file), items: items.length, memoChanged, problemChanged, preservedProblems, blockedProblems });
    if (apply) fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  }
  console.log(`mode=${apply ? "APPLY" : "DRY-RUN"}`);
  for (const stat of stats) console.log(JSON.stringify(stat));
  console.log(`blocked=${blocked.length}`);
  for (const item of blocked.slice(0, 100)) console.log(JSON.stringify(item));
  if (blocked.length > 100) console.log(`blocked_more=${blocked.length - 100}`);
}

main();
