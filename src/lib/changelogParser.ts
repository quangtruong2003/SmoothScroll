export type ChangelogSectionKind =
  | "Added"
  | "Fixed"
  | "Performance"
  | "Changed";

export interface ChangelogSection {
  kind: ChangelogSectionKind;
  items: string[];
}

export interface ChangelogEntry {
  version: string;
  date: string | null;
  sections: ChangelogSection[];
}

const HEADER_RE = /^## \[(\d+\.\d+\.\d+([-.+][\w.]+)?)\] - (\d{4}-\d{2}-\d{2})?/;
const SUBSECTION_RE = /^### (Added|Fixed|Performance|Changed|Removed|Deprecated|Security)\s*$/;
const BULLET_RE = /^[-*]\s+(.+)$/;

const ACCEPTED_KINDS = new Set<ChangelogSectionKind>([
  "Added",
  "Fixed",
  "Performance",
  "Changed",
]);

interface RawEntry {
  version: string;
  date: string | null;
  startLine: number;
}

function findAllEntries(raw: string): RawEntry[] {
  const lines = raw.split(/\r?\n/);
  const entries: RawEntry[] = [];
  for (const line of lines) {
    const m = HEADER_RE.exec(line);
    if (m) {
      entries.push({
        version: m[1],
        date: m[3] ?? null,
        startLine: lines.indexOf(line),
      });
    }
  }
  return entries;
}

function stripPreRelease(version: string): string {
  const dashIdx = version.indexOf("-");
  const plusIdx = version.indexOf("+");
  const cut = [dashIdx, plusIdx].filter((i) => i >= 0).sort((a, b) => a - b)[0];
  return cut !== undefined ? version.substring(0, cut) : version;
}

function selectEntry(
  entries: RawEntry[],
  target: string,
): RawEntry | null {
  if (entries.length === 0) return null;

  const stripped = stripPreRelease(target);

  // 1. Exact match
  const exact = entries.find((e) => e.version === stripped);
  if (exact) return exact;

  // 2. Same major.minor
  const targetMM = stripped.split(".").slice(0, 2).join(".");
  const sameMM = entries
    .filter((e) => e.version.split(".").slice(0, 2).join(".") === targetMM)
    .sort((a, b) => b.version.localeCompare(a.version));
  if (sameMM.length > 0) return sameMM[0];

  // 3. Latest entry
  const sorted = [...entries].sort((a, b) => b.version.localeCompare(a.version));
  return sorted[0];
}

export function parseChangelog(
  raw: string,
  targetVersion: string,
): ChangelogEntry | null {
  const entries = findAllEntries(raw);
  const selected = selectEntry(entries, targetVersion);
  if (!selected) return null;

  const lines = raw.split(/\r?\n/);
  const endLine =
    entries
      .filter((e) => e.startLine > selected.startLine)
      .sort((a, b) => a.startLine - b.startLine)[0]?.startLine ?? lines.length;

  const block = lines.slice(selected.startLine + 1, endLine);

  const sections: ChangelogSection[] = [];
  let current: ChangelogSection | null = null;

  for (const line of block) {
    const subMatch = SUBSECTION_RE.exec(line);
    if (subMatch) {
      const kind = subMatch[1] as ChangelogSectionKind;
      if (ACCEPTED_KINDS.has(kind)) {
        current = { kind, items: [] };
        sections.push(current);
      } else {
        current = null;
      }
      continue;
    }

    if (!current) continue;

    const bulletMatch = BULLET_RE.exec(line);
    if (bulletMatch) {
      current.items.push(bulletMatch[1].trim());
    }
  }

  return {
    version: selected.version,
    date: selected.date,
    sections,
  };
}