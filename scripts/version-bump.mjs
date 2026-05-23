#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');

const TYPE_TO_SECTION = {
  feat: 'Added',
  fix: 'Fixed',
  perf: 'Performance',
  revert: 'Changed',
};

const BUMP_LEVEL = { major: 3, minor: 2, patch: 1 };

export function determineBump(commits) {
  let highest = null;
  for (const c of commits) {
    let level = null;
    if (c.breaking) level = 'major';
    else if (c.type === 'feat') level = 'minor';
    else if (c.type === 'fix' || c.type === 'perf' || c.type === 'revert') level = 'patch';

    if (level && (highest === null || BUMP_LEVEL[level] > BUMP_LEVEL[highest])) {
      highest = level;
    }
  }
  return highest;
}

export function computeNewVersion(currentVersion, bump) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-.+)?$/.exec(currentVersion);
  if (!match) throw new Error(`Invalid version: ${currentVersion}`);
  let [, major, minor, patch] = match;
  major = Number(major);
  minor = Number(minor);
  patch = Number(patch);
  if (bump === 'major') return `${major + 1}.0.0`;
  if (bump === 'minor') return `${major}.${minor + 1}.0`;
  if (bump === 'patch') return `${major}.${minor}.${patch + 1}`;
  throw new Error(`Unknown bump: ${bump}`);
}

export function parseReleaseAsFooter(body) {
  const match = /^release-as:\s*(\S+)\s*$/im.exec(body);
  return match ? match[1] : null;
}

export function groupCommitsByType(commits) {
  const groups = {};
  for (const c of commits) {
    const section = TYPE_TO_SECTION[c.type];
    if (!section) continue;
    if (!groups[section]) groups[section] = [];
    groups[section].push(c.subject);
  }
  return groups;
}

export function parseCommitMessage(raw) {
  const lines = raw.split('\n');
  const subjectLine = lines[0] || '';
  const body = lines.slice(2).join('\n');

  const match = /^(\w+)(\([^)]*\))?(!)?:\s*(.+)$/.exec(subjectLine);
  if (!match) return null;
  const [, type, , bang, subject] = match;
  const breaking = Boolean(bang) || /^BREAKING CHANGE:/m.test(body);
  return { type, subject, body, breaking };
}

export function readCurrentVersion() {
  const cargoToml = readFileSync(resolve(REPO_ROOT, 'Cargo.toml'), 'utf8');
  const match = /^\[workspace\.package\][\s\S]*?^version\s*=\s*"([^"]+)"/m.exec(cargoToml);
  if (!match) throw new Error('Cannot find workspace.package.version in Cargo.toml');
  return match[1];
}

export function bumpCargoToml(filePath, newVersion, isWorkspace) {
  const content = readFileSync(filePath, 'utf8');
  let updated;
  if (isWorkspace) {
    updated = content.replace(
      /(\[workspace\.package\][\s\S]*?\n)version\s*=\s*"[^"]+"/,
      `$1version = "${newVersion}"`
    );
  } else {
    updated = content.replace(
      /^version\s*=\s*"[^"]+"/m,
      `version = "${newVersion}"`
    );
  }
  writeFileSync(filePath, updated);
}

export function bumpJsonVersion(filePath, newVersion) {
  const content = readFileSync(filePath, 'utf8');
  const updated = content.replace(
    /^(\s*)"version":\s*"[^"]+"/m,
    `$1"version": "${newVersion}"`
  );
  writeFileSync(filePath, updated);
}

export function generateChangelogEntry(newVersion, dateISO, groups) {
  const lines = [`## [${newVersion}] - ${dateISO}`, ''];
  const order = ['Added', 'Changed', 'Fixed', 'Performance', 'Deprecated', 'Removed', 'Security'];
  for (const section of order) {
    const items = groups[section];
    if (!items || items.length === 0) continue;
    lines.push(`### ${section}`);
    for (const item of items) lines.push(`- ${item}`);
    lines.push('');
  }
  return lines.join('\n');
}

export function updateChangelog(filePath, newVersion, newEntry) {
  const content = readFileSync(filePath, 'utf8');
  if (content.includes(`## [${newVersion}]`)) {
    console.log(`CHANGELOG already has entry for ${newVersion}, skipping insert.`);
    return;
  }
  const updated = content.replace(
    /## \[Unreleased\]\s*\n/,
    `## [Unreleased]\n\n${newEntry}`
  );
  writeFileSync(filePath, updated);
}

function getCommits(lastTag) {
  const SEP = '<<<COMMIT_END>>>';
  const FIELD_SEP = '<<<FIELD>>>';
  const format = `%H${FIELD_SEP}%B${SEP}`;
  const args = ['log', `--pretty=format:${format}`];
  if (lastTag) args.splice(1, 0, `${lastTag}..HEAD`);
  let raw;
  try {
    raw = execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' });
  } catch {
    raw = execFileSync('git', ['log', `--pretty=format:${format}`], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
  }
  const entries = raw.split(SEP).map((s) => s.trim()).filter(Boolean);
  const commits = [];
  for (const entry of entries) {
    const [hash, ...rest] = entry.split(FIELD_SEP);
    const fullMsg = rest.join(FIELD_SEP);
    const parsed = parseCommitMessage(fullMsg);
    if (parsed) commits.push({ ...parsed, hash });
  }
  return commits;
}

function setGithubOutput(key, value) {
  const out = process.env.GITHUB_OUTPUT;
  if (!out) return;
  writeFileSync(out, `${key}=${value}\n`, { flag: 'a' });
}

async function main() {
  const lastTag = process.env.LAST_TAG || '';
  const headMsg = process.env.HEAD_COMMIT_MSG || '';

  if (/\[skip release\]/i.test(headMsg)) {
    console.log('Detected [skip release] in HEAD commit. Skipping.');
    process.exit(78);
  }

  const commits = getCommits(lastTag);
  console.log(`Analyzing ${commits.length} commit(s) since ${lastTag || 'beginning'}`);

  const releaseAs = parseReleaseAsFooter(headMsg);
  const currentVersion = readCurrentVersion();
  let newVersion;

  if (releaseAs) {
    console.log(`Release-As footer found: ${releaseAs}`);
    newVersion = releaseAs;
  } else {
    const bump = determineBump(commits);
    if (!bump) {
      console.log('No commits trigger a release. Skipping.');
      process.exit(78);
    }
    newVersion = computeNewVersion(currentVersion, bump);
    console.log(`Bump ${bump}: ${currentVersion} -> ${newVersion}`);
  }

  bumpCargoToml(resolve(REPO_ROOT, 'Cargo.toml'), newVersion, true);
  bumpCargoToml(resolve(REPO_ROOT, 'crates/core/Cargo.toml'), newVersion, false);
  bumpCargoToml(resolve(REPO_ROOT, 'crates/platform/Cargo.toml'), newVersion, false);
  bumpCargoToml(resolve(REPO_ROOT, 'src-tauri/Cargo.toml'), newVersion, false);
  bumpJsonVersion(resolve(REPO_ROOT, 'package.json'), newVersion);
  bumpJsonVersion(resolve(REPO_ROOT, 'src-tauri/tauri.conf.json'), newVersion);

  const groups = groupCommitsByType(commits);
  const dateISO = new Date().toISOString().slice(0, 10);
  const entry = generateChangelogEntry(newVersion, dateISO, groups);
  const changelogPath = resolve(REPO_ROOT, 'CHANGELOG.md');
  if (existsSync(changelogPath)) {
    updateChangelog(changelogPath, newVersion, entry);
  } else {
    writeFileSync(changelogPath, `# Changelog\n\n## [Unreleased]\n\n${entry}`);
  }

  const isPrerelease = /-/.test(newVersion);
  setGithubOutput('version', newVersion);
  setGithubOutput('tag', `v${newVersion}`);
  setGithubOutput('is_prerelease', String(isPrerelease));
  console.log(`Wrote outputs: version=${newVersion}, tag=v${newVersion}, is_prerelease=${isPrerelease}`);
}

const invokedFromCli = process.argv[1] && resolve(process.argv[1]) === resolve(__filename);
if (invokedFromCli) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
