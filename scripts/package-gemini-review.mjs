import { cp, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = path.resolve(projectRoot, "../../outputs/OpportunityOS-Gemini-Review");
const includedPaths = [
  "src",
  "supabase",
  "data",
  "docs",
  "scripts",
  "package.json",
  "package-lock.json",
  "README.md",
  "AGENTS.md",
  "next.config.ts",
  "tsconfig.json",
  "eslint.config.mjs",
  "vitest.config.mts",
  "postcss.config.mjs",
  "vercel.json",
];

await mkdir(outputDirectory);
for (const relativePath of includedPaths) {
  await cp(path.join(projectRoot, relativePath), path.join(outputDirectory, relativePath), { recursive: true });
}

await writeFile(
  path.join(outputDirectory, "UPLOAD-README.txt"),
  [
    "This is a code-and-data snapshot for an independent review of OpportunityOS.",
    "It excludes Git history, node_modules, Next build output, local environment files, and credentials.",
    "Open docs/GEMINI_EXTERNAL_REVIEW.md and paste its prompt after importing this folder as code.",
    "Attach OpportunityOS-Audit.pdf separately so the reviewer can compare the older audit with current source.",
    "This snapshot does not include live database records or prove current opportunity facts.",
    "",
  ].join("\n"),
);

console.log(`Review folder created at ${outputDirectory}`);
