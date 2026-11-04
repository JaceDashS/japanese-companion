#!/usr/bin/env node
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const ts = require("typescript");

function transpileTo(relativeSource, outputPath) {
  const sourcePath = path.join(process.cwd(), "client", "src", relativeSource);
  const raw = fs.readFileSync(sourcePath, "utf8");
  const out = ts.transpileModule(raw, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2019,
    },
    fileName: sourcePath,
  });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, out.outputText, "utf8");
}

function compileQueue() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "jpc-source-queue-test-"));
  // 대기열이 import하는 "../data/storageScope.ts" 경로를 그대로 찾을 수 있게 같은 폴더 구조로 둔다.
  transpileTo(path.join("data", "storageScope.ts"), path.join(tempDir, "data", "storageScope.ts"));
  const outputPath = path.join(tempDir, "domain", "sourceWriteQueue.cjs");
  transpileTo(path.join("domain", "sourceWriteQueue.ts"), outputPath);
  return { Queue: require(outputPath).SourceWriteQueue, tempDir };
}

function quietLogger() {
  return { error() {}, warn() {} };
}

function response(status) {
  return new Response("", { status });
}

async function testSerializesRequests(Queue) {
  const calls = [];
  const queue = new Queue(async (input) => {
    calls.push(input);
    await new Promise((resolve) => setTimeout(resolve, 5));
    return response(200);
  }, { logger: quietLogger() });

  const results = await Promise.all([
    queue.enqueue({ input: "first" }),
    queue.enqueue({ input: "second" }),
  ]);

  assert.deepEqual(results, [true, true]);
  assert.deepEqual(calls, ["first", "second"]);
}

async function testSharesRetryBeforeAdvancing(Queue) {
  const calls = [];
  let frontAttempts = 0;
  const queue = new Queue(async (input) => {
    calls.push(input);
    if (input === "front" && frontAttempts++ < 2) {
      throw new Error("offline");
    }
    return response(200);
  }, {
    initialRetryDelayMs: 2,
    maxRetryDelayMs: 8,
    logger: quietLogger(),
  });

  const results = await Promise.all([
    queue.enqueue({ input: "front", label: "front" }),
    queue.enqueue({ input: "behind", label: "behind" }),
  ]);

  assert.deepEqual(results, [true, true]);
  assert.deepEqual(calls, ["front", "front", "front", "behind"]);
}

async function testDropsPermanentClientError(Queue) {
  const calls = [];
  const queue = new Queue(async (input) => {
    calls.push(input);
    return response(input === "bad" ? 400 : 200);
  }, { logger: quietLogger() });

  const results = await Promise.all([
    queue.enqueue({ input: "bad" }),
    queue.enqueue({ input: "next" }),
  ]);

  assert.deepEqual(results, [false, true]);
  assert.deepEqual(calls, ["bad", "next"]);
}

async function main() {
  const { Queue, tempDir } = compileQueue();
  try {
    await testSerializesRequests(Queue);
    await testSharesRetryBeforeAdvancing(Queue);
    await testDropsPermanentClientError(Queue);
    console.log("source write queue tests: PASS");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
