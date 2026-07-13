import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const copies = [
  ["public", ".next/standalone/public"],
  [".next/static", ".next/standalone/.next/static"]
];

for (const [source, destination] of copies) {
  if (!existsSync(source)) {
    continue;
  }

  mkdirSync(dirname(destination), { recursive: true });
  cpSync(source, destination, { recursive: true, force: true });
}
