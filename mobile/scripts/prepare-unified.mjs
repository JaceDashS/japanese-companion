import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

// Reuse maintained product controllers without adding the web dependency tree to Metro.
const mobile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const product = path.resolve(mobile, "..");
const output = path.join(mobile, ".generated/product");
const visited = new Set();
const adapters = new Map([
  ["client/src/api.ts", "apiFetch, apiUrl"],
  ["client/src/data/storage.ts", "loadState, saveState, clearState"],
]);

async function resolveSource(from, specifier) {
  const base = path.resolve(path.dirname(from), specifier);
  for (const candidate of [base, base + ".ts", base + ".tsx"]) {
    if ((await fs.stat(candidate).catch(() => null))?.isFile()) return candidate;
  }
  throw new Error("Unresolved product import: " + specifier + " in " + from);
}

async function generate(source) {
  const relative = path.relative(product, source).replaceAll("\\", "/");
  if (relative.startsWith("../") || !/^(client\/src|shared)\//.test(relative)) throw new Error("Outside product source: " + source);
  if (visited.has(relative)) return;
  visited.add(relative);
  const target = path.join(output, relative.replace(/\.tsx?$/, ".js"));
  await fs.mkdir(path.dirname(target), { recursive: true });
  let text;
  if (adapters.has(relative)) {
    const runtime = path.relative(path.dirname(target), path.join(mobile, "src/unified/runtime")).replaceAll("\\", "/");
    text = `export { ${adapters.get(relative)} } from "${runtime}";\n`;
  } else if (relative === "client/src/domain/date.ts") {
    text = 'export * from "../../../shared/domain/date.js";\n';
    text += 'export { getTodayString } from "../../../../../src/unified/runtime";\n';
    await generate(path.join(product, "shared/domain/date.ts"));
  } else {
    text = ts.transpileModule(await fs.readFile(source, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    const imports = [...text.matchAll(/(?:from\s*|import\s*)["'](\.[^"']+)["']/g)];
    for (const match of imports) {
      const dependency = await resolveSource(source, match[1]);
      await generate(dependency);
      const mapped = path.relative(path.dirname(target), path.join(output, path.relative(product, dependency).replace(/\.tsx?$/, ".js"))).replaceAll("\\", "/");
      text = text.replaceAll('"' + match[1] + '"', '"' + (mapped.startsWith(".") ? mapped : "./" + mapped) + '"');
      text = text.replaceAll("'" + match[1] + "'", '"' + (mapped.startsWith(".") ? mapped : "./" + mapped) + '"');
    }
    if (/import\.meta|\bwindow\.|\bdocument\./.test(text)) throw new Error("Browser runtime in reused controller: " + relative);
  }
  await fs.writeFile(target, text);
}

for (const name of ["curriculumFiles", "homeDashboard", "learningPlanSync", "sessionController", "sessionOpeners", "sessionSelectors", "sessionInput", "sessionEffects", "progressActions", "sourcePersistence", "dayClipboardImporter", "dayClipboardHelpers", "problem"]) {
  // Keyboard effects are installed by the platform screen, not the browser-only hook.
  if (name === "sessionEffects") continue;
  await generate(path.join(product, "client/src/domain", name + ".ts"));
}
console.log("Prepared " + visited.size + " reused product modules");
