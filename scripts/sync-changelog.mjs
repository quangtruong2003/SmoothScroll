import { copyFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

const SRC = resolve(projectRoot, "CHANGELOG.md");
const DEST = resolve(projectRoot, "src/lib/CHANGELOG.md");

if (!existsSync(SRC)) {
  console.error(`[sync-changelog] Source not found: ${SRC}`);
  process.exit(1);
}

copyFileSync(SRC, DEST);
console.log(`[sync-changelog] Copied CHANGELOG.md → ${DEST}`);