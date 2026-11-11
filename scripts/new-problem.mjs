// Usage: npm run new -- <number> <slug>
// e.g.   npm run new -- 1 two-sum
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [num, slug] = process.argv.slice(2);
if (!num || !slug || !/^\d+$/.test(num)) {
  console.error("Usage: npm run new -- <number> <slug>");
  process.exit(1);
}

const dir = join("problems", `${num.padStart(4, "0")}-${slug}`);
if (existsSync(dir)) {
  console.error(`${dir} already exists`);
  process.exit(1);
}

const fnName = slug.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
const title = slug
  .split("-")
  .map((w) => w[0].toUpperCase() + w.slice(1))
  .join(" ");

mkdirSync(dir, { recursive: true });

writeFileSync(
  join(dir, "README.md"),
  `# ${num}. ${title}

https://leetcode.com/problems/${slug}/

## Problem

TODO

## Constraints

- TODO
`,
);

writeFileSync(
  join(dir, "solution.ts"),
  `export function ${fnName}(): unknown {
  throw new Error("Not implemented");
}
`,
);

writeFileSync(
  join(dir, "solution.test.ts"),
  `import { ${fnName} } from "./solution";

describe("${num}. ${title}", () => {
  describe("basic", () => {
    it.todo("example 1");
  });

  describe("corner cases", () => {
    it.todo("empty input");
  });
});
`,
);

console.log(`Created ${dir}`);
