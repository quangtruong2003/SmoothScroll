#!/usr/bin/env node
/* global AbortController, URL, clearTimeout, console, process, setTimeout */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const DEFAULT_API_URL =
  'https://developers.buymeacoffee.com/api/v1/supporters';
export const MARKER_START = '<!-- SMOOTHSCROLL_SUPPORTERS:START -->';
export const MARKER_END = '<!-- SMOOTHSCROLL_SUPPORTERS:END -->';
export const MAX_DISPLAYED_SUPPORTERS = 20;

const REPO_ROOT = resolve(__dirname, '..');
const DEFAULT_README_PATH = resolve(REPO_ROOT, 'README.md');
const DEFAULT_STATE_PATH = resolve(REPO_ROOT, '.github', 'supporters.json');
const MAX_API_PAGES = 1000;

const MARKDOWN_ESCAPES = new Map([
  ['&', '&amp;'],
  ['<', '&lt;'],
  ['>', '&gt;'],
  ['\\', '\\\\'],
  ['`', '\\`'],
  ['*', '\\*'],
  ['_', '\\_'],
  ['{', '\\{'],
  ['}', '\\}'],
  ['[', '\\['],
  [']', '\\]'],
  ['(', '\\('],
  [')', '\\)'],
  ['#', '\\#'],
  ['+', '\\+'],
  ['-', '\\-'],
  ['.', '\\.'],
  ['!', '\\!'],
  ['|', '\\|'],
  ['~', '\\~'],
]);

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isExplicitlyFalse(value) {
  return value === false || value === 0 || value === '0' || value === 'false';
}

function readPositiveInteger(...values) {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue;
    const number =
      typeof value === 'number'
        ? value
        : /^\d+$/.test(String(value).trim())
          ? Number(value)
          : NaN;
    if (Number.isSafeInteger(number) && number > 0) return number;
    return null;
  }
  return null;
}

function readNonNegativeInteger(value) {
  const number =
    typeof value === 'number'
      ? value
      : /^\d+$/.test(String(value).trim())
        ? Number(value)
        : NaN;
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}

function firstNonEmptyString(...values) {
  return values.find(
    (value) => typeof value === 'string' && value.trim().length > 0,
  ) ?? null;
}

function isEmailLike(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function replaceControlCharacters(value) {
  return Array.from(value, (character) => {
    const codePoint = character.codePointAt(0);
    return codePoint >= 0x20 && codePoint !== 0x7f ? character : ' ';
  }).join('');
}

function parseTimestamp(value) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value < 1_000_000_000_000 ? value * 1000 : value;
  }
  if (typeof value !== 'string' || value.trim() === '') return null;

  const normalized = value.trim();
  const oldApiDate =
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(normalized)
      ? `${normalized.replace(' ', 'T')}Z`
      : normalized;
  const timestamp = Date.parse(oldApiDate);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function isRefunded(record) {
  const status = typeof record.status === 'string' ? record.status.toLowerCase() : '';
  return status === 'refunded' || [
    record.is_refunded,
    record.refunded,
  ].some(
    (value) => value === true || value === 1 || value === '1' || value === 'true',
  );
}

function publicIdentityKey(record, hasPublicName) {
  if (!hasPublicName) return null;

  const providerId = record.supporter_id;
  if (
    (typeof providerId === 'number' && Number.isSafeInteger(providerId)) ||
    (typeof providerId === 'string' && providerId.trim() !== '')
  ) {
    return `id:${String(providerId)}`;
  }

  const username = firstNonEmptyString(
    record.supporter_username,
    record.public_username,
    record.username,
  );
  return username ? `username:${username.toLowerCase()}` : null;
}

export function sanitizeDisplayName(value) {
  if (typeof value !== 'string') return 'Anonymous';
  const cleaned = replaceControlCharacters(value)
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return 'Anonymous';
  const characters = Array.from(cleaned);
  return characters.length > 80
    ? `${characters.slice(0, 79).join('')}…`
    : cleaned;
}

export function normalizeSupporterRecord(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new Error('Buy Me a Coffee returned an invalid supporter record');
  }
  if (isRefunded(record)) return null;

  const coffees = readPositiveInteger(
    record.support_coffees,
    record.coffee_count,
    record.coffees,
    record.coffee,
  );
  if (coffees === null) {
    throw new Error('Buy Me a Coffee returned a supporter without a valid coffee count');
  }

  const isPrivate = isExplicitlyFalse(
    record.support_visibility ?? record.visibility,
  );
  const publicNameCandidate = isPrivate
    ? null
    : firstNonEmptyString(record.supporter_name, record.public_name, record.name);
  const publicUsernameCandidate = isPrivate
    ? null
    : firstNonEmptyString(
        record.supporter_username,
        record.public_username,
        record.username,
      );
  const publicName = isEmailLike(publicNameCandidate) ? null : publicNameCandidate;
  const publicUsername = isEmailLike(publicUsernameCandidate)
    ? null
    : publicUsernameCandidate;
  const hasPublicName = Boolean(publicName || publicUsername);

  return {
    name: sanitizeDisplayName(publicName ?? publicUsername),
    coffees,
    createdAt: parseTimestamp(
      record.support_created_on ?? record.created_at ?? record.created,
    ),
    identityKey: publicIdentityKey(record, hasPublicName),
  };
}

export function aggregateSupporters(records) {
  const aggregated = [];
  const byIdentity = new Map();

  for (const record of records) {
    if (!record) continue;
    if (!record.identityKey) {
      aggregated.push({ ...record });
      continue;
    }

    const existing = byIdentity.get(record.identityKey);
    if (!existing) {
      const copy = { ...record };
      byIdentity.set(record.identityKey, copy);
      aggregated.push(copy);
      continue;
    }

    existing.coffees += record.coffees;
    if (
      record.createdAt !== null &&
      (existing.createdAt === null || record.createdAt > existing.createdAt)
    ) {
      existing.createdAt = record.createdAt;
    }
  }

  return aggregated;
}

function normalizeFirstSupporter(firstSupporter) {
  if (!firstSupporter || typeof firstSupporter !== 'object') {
    throw new Error('First supporter configuration is missing');
  }
  const coffees = readPositiveInteger(firstSupporter.coffees);
  if (coffees === null) {
    throw new Error('First supporter configuration has an invalid coffee count');
  }
  return {
    name: sanitizeDisplayName(firstSupporter.name),
    coffees,
  };
}

export function loadFirstSupporter(statePath = DEFAULT_STATE_PATH) {
  let state;
  try {
    state = JSON.parse(readFileSync(statePath, 'utf8'));
  } catch (error) {
    throw new Error(`Unable to read first supporter state: ${error.message}`);
  }
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    throw new Error('First supporter state must be a JSON object');
  }
  return normalizeFirstSupporter(state.firstSupporter);
}

function escapeMarkdownText(value) {
  return Array.from(value, (character) => MARKDOWN_ESCAPES.get(character) ?? character).join('');
}

function renderCoffeeCount(coffees) {
  return coffees <= 5 ? '☕'.repeat(coffees) : `☕ × ${coffees}`;
}

function renderSupporterLine(supporter, first = false) {
  const badge = first ? '🥇 ' : '';
  const firstLabel = first ? ' — First supporter' : '';
  return `- ${badge}**${escapeMarkdownText(supporter.name)}**${firstLabel} · ${renderCoffeeCount(supporter.coffees)}`;
}

export function renderSupporters({
  records = [],
  firstSupporter,
  maxSupporters = MAX_DISPLAYED_SUPPORTERS,
}) {
  const first = normalizeFirstSupporter(firstSupporter);
  const limit = Math.max(0, Math.floor(maxSupporters));
  const visible = records.slice(0, limit);
  const lines = [renderSupporterLine(first, true)];

  for (const record of visible) lines.push(renderSupporterLine(record));
  const omitted = records.length - visible.length;
  if (omitted > 0) lines.push(`- _+ ${omitted} more supporters_`);

  return lines.join('\n');
}

export function replaceSupporterSection(readme, generated) {
  const markerPattern = new RegExp(
    `${escapeRegExp(MARKER_START)}[\\s\\S]*?${escapeRegExp(MARKER_END)}`,
    'g',
  );
  const matches = readme.match(markerPattern);
  if (!matches || matches.length !== 1) {
    throw new Error('README must contain exactly one supporter marker pair');
  }

  const newline = readme.includes('\r\n') ? '\r\n' : '\n';
  const generatedWithNewlines = generated.replace(/\r?\n/g, newline);
  return readme.replace(
    markerPattern,
    `${MARKER_START}${newline}${generatedWithNewlines}${newline}${MARKER_END}`,
  );
}

function parsePagePayload(payload, page) {
  if (Array.isArray(payload)) {
    return { data: payload, total: payload.length, lastPage: 1, hasNext: false };
  }
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.data)) {
    throw new Error('Buy Me a Coffee returned malformed JSON');
  }

  const hasTotal = payload.total !== undefined && payload.total !== null;
  const total = hasTotal ? readNonNegativeInteger(payload.total) : null;
  if (hasTotal && total === null) {
    throw new Error('Buy Me a Coffee returned invalid total pagination metadata');
  }
  const hasLastPage = payload.last_page !== undefined && payload.last_page !== null;
  const lastPage = hasLastPage ? readPositiveInteger(payload.last_page) : null;
  if (hasLastPage && lastPage === null) {
    throw new Error('Buy Me a Coffee returned invalid last_page pagination metadata');
  }
  if (total !== null && total < payload.data.length) {
    throw new Error('Buy Me a Coffee returned inconsistent pagination metadata');
  }
  if (payload.data.length === 0 && total !== 0) {
    throw new Error('Buy Me a Coffee returned an empty or incomplete supporter page');
  }
  if (payload.data.length === 0 && total === null && lastPage === null) {
    throw new Error('Buy Me a Coffee returned an empty page without pagination metadata');
  }

  const hasNext =
    lastPage !== null ? page < lastPage : Boolean(payload.next_page_url);
  return { data: payload.data, total, lastPage: lastPage ?? page, hasNext };
}

export function parseSupporterPayload(payload) {
  const page = parsePagePayload(payload, 1);
  return {
    records: page.data.map(normalizeSupporterRecord).filter(Boolean),
    complete: !page.hasNext,
    total: page.total ?? page.data.length,
  };
}

async function requestWithTimeout(fetchImpl, url, options, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`Buy Me a Coffee API request timed out after ${timeoutMs}ms`);
    }
    throw new Error(`Buy Me a Coffee API request failed: ${error.message}`);
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchSupporterRecords({
  token,
  endpoint = DEFAULT_API_URL,
  fetchImpl = globalThis.fetch,
  timeoutMs = 15_000,
} = {}) {
  if (typeof token !== 'string' || token.trim() === '') {
    throw new Error('BUY_ME_A_COFFEE_TOKEN is required for a production update');
  }
  if (typeof fetchImpl !== 'function') {
    throw new Error('Fetch is unavailable in this Node.js runtime');
  }

  const records = [];
  let page = 1;
  let total = null;

  while (true) {
    const pageUrl = new URL(endpoint);
    pageUrl.searchParams.set('page', String(page));
    const response = await requestWithTimeout(
      fetchImpl,
      pageUrl.toString(),
      {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token.trim()}`,
          'User-Agent': 'SmoothScroll-supporters-updater',
        },
      },
      timeoutMs,
    );

    if (!response.ok) {
      throw new Error(`Buy Me a Coffee API returned HTTP ${response.status}`);
    }

    let payload;
    try {
      payload = JSON.parse(await response.text());
    } catch {
      throw new Error('Buy Me a Coffee API returned malformed JSON');
    }

    const pageData = parsePagePayload(payload, page);
    records.push(...pageData.data.map(normalizeSupporterRecord).filter(Boolean));
    if (pageData.total !== null) total = pageData.total;
    if (!pageData.hasNext) break;

    page += 1;
    if (page > MAX_API_PAGES) {
      throw new Error(`Buy Me a Coffee pagination exceeded ${MAX_API_PAGES} pages`);
    }
  }

  return { records, complete: true, total: total ?? records.length };
}

function readFixture(fixturePath) {
  let payload;
  try {
    payload = JSON.parse(readFileSync(fixturePath, 'utf8'));
  } catch (error) {
    throw new Error(`Unable to read supporter fixture: ${error.message}`);
  }
  return parseSupporterPayload(payload);
}

function removePersistedFirstDonation(records, firstSupporter, complete) {
  if (!complete || records.length === 0) return records;
  if (!records.every((record) => record.createdAt !== null)) return records;

  let earliestIndex = 0;
  for (let index = 1; index < records.length; index += 1) {
    if (records[index].createdAt < records[earliestIndex].createdAt) {
      earliestIndex = index;
    }
  }

  const first = normalizeFirstSupporter(firstSupporter);
  if (records[earliestIndex].name.toLowerCase() !== first.name.toLowerCase()) {
    return records;
  }
  return records.filter((_, index) => index !== earliestIndex);
}

function sortLatestFirst(records) {
  return [...records].sort(
    (left, right) => (right.createdAt ?? -Infinity) - (left.createdAt ?? -Infinity),
  );
}

export async function updateReadme({
  readmePath = DEFAULT_README_PATH,
  statePath = DEFAULT_STATE_PATH,
  token = process.env.BUY_ME_A_COFFEE_TOKEN,
  fixturePath,
  dryRun = false,
  endpoint = DEFAULT_API_URL,
  fetchImpl = globalThis.fetch,
  maxSupporters = MAX_DISPLAYED_SUPPORTERS,
} = {}) {
  const firstSupporter = loadFirstSupporter(statePath);
  const source = fixturePath
    ? readFixture(fixturePath)
    : await fetchSupporterRecords({ token, endpoint, fetchImpl });
  const remaining = removePersistedFirstDonation(
    source.records,
    firstSupporter,
    source.complete,
  );
  const records = sortLatestFirst(aggregateSupporters(remaining));
  const generated = renderSupporters({ records, firstSupporter, maxSupporters });

  if (dryRun) return { changed: false, generated, records };

  const readme = readFileSync(readmePath, 'utf8');
  const updated = replaceSupporterSection(readme, generated);
  if (updated === readme) return { changed: false, generated, records };

  writeFileSync(readmePath, updated);
  return { changed: true, generated, records };
}

export function parseArgs(argv = process.argv) {
  const args = {};
  for (let index = 2; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--dry-run') {
      args.dryRun = true;
      continue;
    }
    if (argument === '--fixture') {
      const fixturePath = argv[index + 1];
      if (!fixturePath || fixturePath.startsWith('--')) {
        throw new Error('--fixture requires a file path');
      }
      args.fixturePath = resolve(process.cwd(), fixturePath);
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }
  return args;
}

export async function main(argv = process.argv) {
  const args = parseArgs(argv);
  const result = await updateReadme(args);
  if (args.dryRun) {
    console.log(`Generated supporter section:\n${result.generated}`);
    return;
  }
  console.log(result.changed ? 'Updated README.md supporter section.' : 'Supporters unchanged.');
}

if (process.argv[1] && resolve(process.argv[1]) === __filename) {
  main().catch((error) => {
    console.error(`[supporters] ${error.message}`);
    process.exitCode = 1;
  });
}
