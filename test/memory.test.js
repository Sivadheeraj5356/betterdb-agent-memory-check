const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../memory.js');

test('keyword overlap scoring is symmetric and bounded', () => {
  const s = M.overlapScore('refund policy for delayed orders', 'delayed orders refund policy');
  assert.ok(s > 0.9);
  assert.equal(M.overlapScore('apples', 'oranges'), 0);
});

test('exact query hits stored memory', () => {
  const r = M.runScenario([
    { store: { id: 'm1', text: 'refund window is 30 days for damaged items' } },
    { query: 'refund window damaged items', expectHit: true },
  ], '2026-10-01T00:00:00Z');
  assert.equal(r.findings.length, 0);
});

test('scope isolation prevents cross-scope leaks', () => {
  const r = M.runScenario([
    { store: { id: 'm1', text: 'vip customer pricing tier', scope: 'agent-a' } },
    { query: 'vip customer pricing', scope: 'agent-b', expectHit: false },
  ], '2026-10-01T00:00:00Z');
  assert.equal(r.findings.length, 0);
});

test('expired memories do not hit', () => {
  const r = M.runScenario([
    { store: { id: 'm1', text: 'temporary access code 4242', ttlSeconds: 60, storedAgoSeconds: 600 } },
    { query: 'temporary access code', expectHit: false },
  ], new Date('2026-10-01T00:10:00Z').getTime());
  assert.equal(r.findings.length, 0);
});

test('paraphrase miss is flagged as a warning, not an error', () => {
  const r = M.runScenario([
    { store: { id: 'm1', text: 'refund window is 30 days' } },
    { query: 'completely unrelated question about weather', expectParaphraseHit: true },
  ], '2026-10-01T00:00:00Z');
  assert.ok(r.findings.some((f) => f.code === 'PARAPHRASE_MISS' && f.level === 'warn'));
});

test('flags memory that never serves a wanted hit', () => {
  const r = M.runScenario([
    { store: { id: 'm1', text: 'some fact' } },
    { query: 'totally different words here', expectHit: true },
  ], '2026-10-01T00:00:00Z');
  assert.ok(r.findings.some((f) => f.code === 'NO_HITS_AT_ALL'));
});

test('unexpected hit is an error (scope/expiry leak)', () => {
  const r = M.runScenario([
    { store: { id: 'm1', text: 'shared fact about refunds' } },
    { query: 'shared fact refunds', expectHit: false },
  ], '2026-10-01T00:00:00Z');
  assert.ok(r.findings.some((f) => f.code === 'UNEXPECTED_HIT'));
});
