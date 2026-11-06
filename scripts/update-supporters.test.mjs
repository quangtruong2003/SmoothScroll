/* global URL */

import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import {
  MARKER_END,
  MARKER_START,
  aggregateSupporters,
  fetchSupporterRecords,
  normalizeSupporterRecord,
  parseSupporterPayload,
  renderSupporters,
  replaceSupporterSection,
  updateReadme,
} from './update-supporters.mjs';

function responseFrom(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(payload),
    headers: { get: () => null },
  };
}

function makeTempRepo() {
  const root = mkdtempSync(join(tmpdir(), 'smoothscroll-supporters-'));
  const readmePath = join(root, 'README.md');
  const statePath = join(root, 'supporters.json');
  writeFileSync(
    readmePath,
    [
      'before',
      MARKER_START,
      'old generated content',
      MARKER_END,
      'after',
      '',
    ].join('\n'),
  );
  writeFileSync(
    statePath,
    JSON.stringify({ firstSupporter: { name: null, coffees: 1 } }),
  );
  return { readmePath, statePath };
}

test('renders a public supporter name and coffee count', () => {
  const supporter = normalizeSupporterRecord({
    supporter_name: 'Alex',
    support_coffees: 1,
  });

  const output = renderSupporters({
    records: [supporter],
    firstSupporter: { name: null, coffees: 1 },
  });

  assert.match(output, /Alex/);
  assert.match(output, /☕/);
});

test('uses Anonymous when the provider has no public name', () => {
  const supporter = normalizeSupporterRecord({
    supporter_name: null,
    support_email: 'private@example.invalid',
    support_coffees: 1,
  });

  const output = renderSupporters({
    records: [supporter],
    firstSupporter: { name: null, coffees: 1 },
  });

  assert.equal(supporter.name, 'Anonymous');
  assert.match(output, /Anonymous/);
  assert.doesNotMatch(output, /private@example\.invalid/);
});

test('does not publish an email-shaped display name', () => {
  const supporter = normalizeSupporterRecord({
    supporter_name: 'private@example.invalid',
    support_coffees: 1,
  });

  assert.equal(supporter.name, 'Anonymous');
});

test('honors an explicit private visibility flag', () => {
  const supporter = normalizeSupporterRecord({
    supporter_name: 'Alex',
    support_visibility: 0,
    support_coffees: 1,
  });

  assert.equal(supporter.name, 'Anonymous');
  assert.equal(supporter.identityKey, null);
});

test('does not render Markdown or HTML injection from a supporter name', () => {
  const supporter = normalizeSupporterRecord({
    supporter_name: '<script>alert(1)</script> [click](javascript:alert(1))',
    support_coffees: 1,
  });

  const output = renderSupporters({
    records: [supporter],
    firstSupporter: { name: null, coffees: 1 },
  });

  assert.match(output, /&lt;script&gt;/);
  assert.doesNotMatch(output, /<script>|\]\(javascript:/);
});

test('aggregates only records with a safe provider identity', () => {
  const identified = aggregateSupporters([
    normalizeSupporterRecord({
      supporter_id: 42,
      supporter_name: 'Alex',
      support_coffees: 1,
    }),
    normalizeSupporterRecord({
      supporter_id: 42,
      supporter_name: 'Alex',
      support_coffees: 2,
    }),
  ]);
  const sameNameWithoutIdentity = aggregateSupporters([
    normalizeSupporterRecord({ supporter_name: 'Alex', support_coffees: 1 }),
    normalizeSupporterRecord({ supporter_name: 'Alex', support_coffees: 1 }),
  ]);

  assert.equal(identified.length, 1);
  assert.equal(identified[0].coffees, 3);
  assert.equal(sameNameWithoutIdentity.length, 2);
});

test('filters refunded records before rendering', () => {
  assert.equal(
    normalizeSupporterRecord({
      supporter_name: 'Refunded Alex',
      support_coffees: 1,
      is_refunded: 1,
    }),
    null,
  );
});

test('fetches every paginated API page without following provider URLs', async () => {
  const requestedUrls = [];
  const result = await fetchSupporterRecords({
    token: 'test-token',
    endpoint: 'https://example.invalid/api/v1/supporters',
    fetchImpl: async (url) => {
      requestedUrls.push(url);
      const page = new URL(url).searchParams.get('page');
      if (page === '1') {
        return responseFrom({
          current_page: 1,
          last_page: 2,
          total: 2,
          data: [
            { supporter_name: 'Alex', support_coffees: 1 },
          ],
          next_page_url: 'https://attacker.invalid/steal-token',
        });
      }
      return responseFrom({
        current_page: 2,
        last_page: 2,
        total: 2,
        data: [
          { supporter_name: 'Minh', support_coffees: 1 },
        ],
      });
    },
  });

  assert.equal(result.records.length, 2);
  assert.equal(requestedUrls.length, 2);
  assert.match(requestedUrls[0], /page=1/);
  assert.match(requestedUrls[1], /page=2/);
  assert.ok(requestedUrls.every((url) => url.startsWith('https://example.invalid/')));
});

test('rejects invalid pagination metadata instead of rendering a partial list', () => {
  assert.throws(
    () =>
      parseSupporterPayload({
        total: 'not-a-number',
        last_page: 1,
        data: [{ supporter_name: 'Alex', support_coffees: 1 }],
      }),
    /invalid total/,
  );
});

test('replaces only the content between the README markers', () => {
  const original = [
    'before',
    MARKER_START,
    'old generated content',
    MARKER_END,
    'after',
    '',
  ].join('\n');

  const updated = replaceSupporterSection(original, '- **Alex** · ☕');

  assert.equal(
    updated,
    ['before', MARKER_START, '- **Alex** · ☕', MARKER_END, 'after', ''].join('\n'),
  );
});

test('fails when the README marker is missing or duplicated', () => {
  assert.throws(
    () => replaceSupporterSection('no markers here', 'generated'),
    /exactly one supporter marker pair/,
  );
  assert.throws(
    () =>
      replaceSupporterSection(
        [MARKER_START, 'one', MARKER_END, MARKER_START, 'two', MARKER_END].join('\n'),
        'generated',
      ),
    /exactly one supporter marker pair/,
  );
});

test('leaves README unchanged when the provider API fails', async () => {
  const { readmePath, statePath } = makeTempRepo();
  const before = readFileSync(readmePath, 'utf8');

  await assert.rejects(
    updateReadme({
      readmePath,
      statePath,
      token: 'test-token',
      fetchImpl: async () => responseFrom({ error: 'unavailable' }, 503),
    }),
    /HTTP 503/,
  );

  assert.equal(readFileSync(readmePath, 'utf8'), before);
});

test('dry-run prints generated content without modifying README', async () => {
  const { readmePath, statePath } = makeTempRepo();
  const fixturePath = join(readmePath, '..', 'fixture.json');
  writeFileSync(
    fixturePath,
    JSON.stringify([{ name: 'Alex', coffee: 1 }]),
  );
  const before = readFileSync(readmePath, 'utf8');

  const result = await updateReadme({
    readmePath,
    statePath,
    fixturePath,
    dryRun: true,
  });

  assert.equal(result.changed, false);
  assert.match(result.generated, /Alex/);
  assert.match(result.generated, /First supporter/);
  assert.equal(readFileSync(readmePath, 'utf8'), before);
});
