import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  determineBump,
  computeNewVersion,
  parseReleaseAsFooter,
  groupCommitsByType,
  parseCommitMessage,
  generateChangelogEntry,
  updateChangelog,
  readPlatformVersion,
  writePlatformVersion,
  parseArgs,
} from './version-bump.mjs';
import { mkdtempSync, writeFileSync as wfs, readFileSync as rfs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('determineBump: returns "major" when commit has BREAKING CHANGE footer', () => {
  const commits = [
    { type: 'feat', subject: 'new feature', body: 'BREAKING CHANGE: removes old API', breaking: true },
  ];
  assert.equal(determineBump(commits), 'major');
});

test('determineBump: returns "major" when subject uses bang notation feat!', () => {
  const commits = [
    { type: 'feat', subject: 'redesign config', body: '', breaking: true },
  ];
  assert.equal(determineBump(commits), 'major');
});

test('determineBump: returns "minor" for feat commits', () => {
  const commits = [
    { type: 'feat', subject: 'add dark mode', body: '', breaking: false },
    { type: 'chore', subject: 'tidy', body: '', breaking: false },
  ];
  assert.equal(determineBump(commits), 'minor');
});

test('determineBump: returns "patch" for fix/perf/revert commits', () => {
  const commits = [
    { type: 'fix', subject: 'crash on launch', body: '', breaking: false },
  ];
  assert.equal(determineBump(commits), 'patch');
});

test('determineBump: returns null when no triggering commits', () => {
  const commits = [
    { type: 'docs', subject: 'update README', body: '', breaking: false },
    { type: 'chore', subject: 'bump deps', body: '', breaking: false },
  ];
  assert.equal(determineBump(commits), null);
});

test('determineBump: picks highest severity (major > minor > patch)', () => {
  const commits = [
    { type: 'fix', subject: 'bug', body: '', breaking: false },
    { type: 'feat', subject: 'feature', body: '', breaking: false },
    { type: 'fix', subject: 'breaking fix', body: 'BREAKING CHANGE: schema', breaking: true },
  ];
  assert.equal(determineBump(commits), 'major');
});

test('computeNewVersion: bumps patch from 1.2.3 to 1.2.4', () => {
  assert.equal(computeNewVersion('1.2.3', 'patch'), '1.2.4');
});

test('computeNewVersion: bumps minor from 1.2.3 to 1.3.0 (resets patch)', () => {
  assert.equal(computeNewVersion('1.2.3', 'minor'), '1.3.0');
});

test('computeNewVersion: bumps major from 1.2.3 to 2.0.0 (resets minor + patch)', () => {
  assert.equal(computeNewVersion('1.2.3', 'major'), '2.0.0');
});

test('computeNewVersion: bumps from 0.1.38 patch to 0.1.39', () => {
  assert.equal(computeNewVersion('0.1.38', 'patch'), '0.1.39');
});

test('computeNewVersion: throws on invalid current version', () => {
  assert.throws(() => computeNewVersion('not-a-version', 'patch'));
});

test('parseReleaseAsFooter: extracts version from Release-As footer', () => {
  const body = 'Some message\n\nRelease-As: 1.0.0';
  assert.equal(parseReleaseAsFooter(body), '1.0.0');
});

test('parseReleaseAsFooter: case-insensitive for footer key', () => {
  const body = 'Some message\n\nrelease-as: 2.0.0-beta.1';
  assert.equal(parseReleaseAsFooter(body), '2.0.0-beta.1');
});

test('parseReleaseAsFooter: returns null when no footer', () => {
  const body = 'No footer here';
  assert.equal(parseReleaseAsFooter(body), null);
});

test('groupCommitsByType: groups feat under Added, fix under Fixed', () => {
  const commits = [
    { type: 'feat', subject: 'feature A', body: '', breaking: false, hash: 'abc' },
    { type: 'fix', subject: 'bug B', body: '', breaking: false, hash: 'def' },
    { type: 'feat', subject: 'feature C', body: '', breaking: false, hash: 'ghi' },
  ];
  const groups = groupCommitsByType(commits);
  assert.deepEqual(groups.Added, ['feature A', 'feature C']);
  assert.deepEqual(groups.Fixed, ['bug B']);
});

test('groupCommitsByType: ignores chore/docs/style', () => {
  const commits = [
    { type: 'chore', subject: 'ci', body: '', breaking: false, hash: 'abc' },
    { type: 'docs', subject: 'readme', body: '', breaking: false, hash: 'def' },
  ];
  const groups = groupCommitsByType(commits);
  assert.equal(groups.Added, undefined);
  assert.equal(groups.Fixed, undefined);
});

test('parseCommitMessage: parses simple feat subject', () => {
  const parsed = parseCommitMessage('feat: add dark mode');
  assert.equal(parsed.type, 'feat');
  assert.equal(parsed.subject, 'add dark mode');
  assert.equal(parsed.breaking, false);
});

test('parseCommitMessage: detects breaking via bang', () => {
  const parsed = parseCommitMessage('feat!: drop legacy API');
  assert.equal(parsed.breaking, true);
});

test('parseCommitMessage: detects breaking via footer', () => {
  const parsed = parseCommitMessage('feat: rename setting\n\nBREAKING CHANGE: smoothness renamed');
  assert.equal(parsed.breaking, true);
});

test('parseCommitMessage: handles scope', () => {
  const parsed = parseCommitMessage('fix(ui): button hover');
  assert.equal(parsed.type, 'fix');
  assert.equal(parsed.subject, 'button hover');
});

test('parseCommitMessage: returns null for malformed subject', () => {
  const parsed = parseCommitMessage('no conv format here');
  assert.equal(parsed, null);
});

test('generateChangelogEntry: orders sections Added/Changed/Fixed/Performance', () => {
  const entry = generateChangelogEntry('1.0.0', '2026-05-23', {
    Fixed: ['bug X'],
    Added: ['feature Y'],
  });
  const addedIdx = entry.indexOf('### Added');
  const fixedIdx = entry.indexOf('### Fixed');
  assert.ok(addedIdx >= 0 && fixedIdx >= 0);
  assert.ok(addedIdx < fixedIdx);
});

test('generateChangelogEntry: includes version header and date', () => {
  const entry = generateChangelogEntry('1.0.0', '2026-05-23', { Added: ['x'] });
  assert.ok(entry.includes('## [1.0.0] - 2026-05-23'));
});

test('updateChangelog: skips when version entry already exists', () => {
  const dir = mkdtempSync(join(tmpdir(), 'changelog-'));
  const path = join(dir, 'CHANGELOG.md');
  wfs(path, '# Changelog\n\n## [Unreleased]\n\n## [1.0.0] - 2026-05-23\n\nExisting entry\n');
  updateChangelog(path, '1.0.0', '## [1.0.0] - 2026-05-23\n\n### Added\n- New\n');
  const result = rfs(path, 'utf8');
  assert.ok(result.includes('Existing entry'));
  assert.ok(!result.includes('### Added\n- New'));
});

test('updateChangelog: inserts entry below Unreleased when version absent', () => {
  const dir = mkdtempSync(join(tmpdir(), 'changelog-'));
  const path = join(dir, 'CHANGELOG.md');
  wfs(path, '# Changelog\n\n## [Unreleased]\n');
  updateChangelog(path, '1.1.0', '## [1.1.0] - 2026-05-24\n\n### Added\n- Feature\n');
  const result = rfs(path, 'utf8');
  assert.ok(result.includes('## [1.1.0]'));
  assert.ok(result.includes('### Added\n- Feature'));
});

test('parseArgs: extracts --platform value', () => {
  const args = parseArgs(['node', 'script.mjs', '--platform', 'windows']);
  assert.equal(args.platform, 'windows');
});

test('parseArgs: treats --dry-run as boolean true when no value follows', () => {
  const args = parseArgs(['node', 'script.mjs', '--platform', 'linux', '--dry-run']);
  assert.equal(args.platform, 'linux');
  assert.equal(args.dryRun, true);
});

test('parseArgs: treats --dry-run as boolean true when another flag follows', () => {
  const args = parseArgs(['node', 'script.mjs', '--dry-run', '--platform', 'linux']);
  assert.equal(args.dryRun, true);
  assert.equal(args.platform, 'linux');
});

test('parseArgs: returns empty object when no flags', () => {
  const args = parseArgs(['node', 'script.mjs']);
  assert.equal(args.platform, undefined);
  assert.equal(args.dryRun, undefined);
});

test('readPlatformVersion: reads VERSION.windows', () => {
  const dir = mkdtempSync(join(tmpdir(), 'version-'));
  wfs(join(dir, 'VERSION.windows'), '1.19.5');
  const result = readPlatformVersion('windows', dir);
  assert.equal(result, '1.19.5');
});

test('readPlatformVersion: reads VERSION.macos', () => {
  const dir = mkdtempSync(join(tmpdir(), 'version-'));
  wfs(join(dir, 'VERSION.macos'), '2.0.0');
  const result = readPlatformVersion('macos', dir);
  assert.equal(result, '2.0.0');
});

test('readPlatformVersion: throws on invalid platform', () => {
  assert.throws(() => readPlatformVersion('invalid', '/tmp'));
});

test('writePlatformVersion: writes VERSION.macos', () => {
  const dir = mkdtempSync(join(tmpdir(), 'version-'));
  writePlatformVersion('macos', '2.0.0', dir);
  const result = rfs(join(dir, 'VERSION.macos'), 'utf8');
  assert.equal(result, '2.0.0');
});

test('writePlatformVersion: overwrites existing VERSION.linux', () => {
  const dir = mkdtempSync(join(tmpdir(), 'version-'));
  wfs(join(dir, 'VERSION.linux'), '1.0.0');
  writePlatformVersion('linux', '1.1.0', dir);
  const result = rfs(join(dir, 'VERSION.linux'), 'utf8');
  assert.equal(result, '1.1.0');
});
