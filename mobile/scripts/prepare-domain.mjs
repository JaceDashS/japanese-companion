import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const files = ["domain/srs.ts", "domain/constants.ts", "domain/srsPreferences.ts", "domain/date.ts", "domain/expression.ts", "domain/textRepair.ts", "domain/studyTypes.ts", "data/initialState.ts", "data/initialStateParsing.ts", "data/assetModules.ts", "domain/shuffle.ts"];
for (const file of files) {
  const source = await fs.readFile(path.join(root, "../shared", file), "utf8");
  let output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  output = output.replace(/(from\s+["'])(\.[^"']+)(["'])/g,
    (_, a, p, b) => a + p.replace(/\.ts$/, "").replace(/\.js$/, "") + ".js" + b);
  if (/from ["'](?:react|react-dom)|document\.|window\.|import\.meta/.test(output))
    throw new Error("Browser dependency in " + file);
  const target = path.join(root, ".generated", file.replace(/\.ts$/, ".js"));
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, output);
}
