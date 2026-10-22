// Agent-memory QA harness: simulates a scoped agent memory with semantic-ish
// retrieval, TTL expiry and hit/miss observability, then scores it.
// Pure functions, no DOM, importable from tests and the browser app.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AgentMemoryCheck = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  function tokenize(s) {
    return (s.toLowerCase().match(/[a-z0-9]+/g) || []).filter((t) => t.length > 2);
  }
  const STOP = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'from', 'are', 'was', 'were', 'have', 'has', 'you', 'your']);
  function keywords(s) { return new Set(tokenize(s).filter((t) => !STOP.has(t))); }
  function overlapScore(a, b) {
    const ka = keywords(a), kb = keywords(b);
    if (!ka.size || !kb.size) return 0;
    let hit = 0;
    for (const t of ka) if (kb.has(t)) hit++;
    return hit / Math.sqrt(ka.size * kb.size);
  }
  function makeMemory(now) {
    const items = [];
    return {
      store(id, text, scope, ttlSeconds, storedAgoSeconds) {
        items.push({ id, text, scope: scope || 'default', storedAt: now - (storedAgoSeconds || 0) * 1000, ttl: ttlSeconds || null, hits: 0 });
      },
      query(q, scope) {
        const alive = items.filter((m) => m.scope === scope && (!m.ttl || now - m.storedAt <= m.ttl * 1000));
        let best = null, bestScore = 0;
        for (const m of alive) {
          const s = overlapScore(q, m.text);
          if (s > bestScore) { best = m; bestScore = s; }
        }
        if (best && bestScore >= 0.5) { best.hits++; return { hit: true, item: best, score: bestScore }; }
        return { hit: false, score: bestScore, candidates: alive.length };
      },
      items,
    };
  }
  // Run a QA scenario: steps are {store:{...}} or {query, scope, expectHit}
  function runScenario(steps, now) {
    const mem = makeMemory(now ? new Date(now).getTime() : 0);
    const log = [];
    const findings = [];
    steps.forEach((step, i) => {
      if (step.store) {
        mem.store(step.store.id, step.store.text, step.store.scope, step.store.ttlSeconds, step.store.storedAgoSeconds);
        log.push(`stored "${step.store.id}" in scope "${step.store.scope || 'default'}"`);
      } else if (step.query) {
        const r = mem.query(step.query, step.scope || 'default');
        log.push(`query "${step.query}" -> ${r.hit ? 'HIT "' + r.item.id + '"' : 'MISS'} (score ${r.score.toFixed(2)})`);
        if (step.expectHit === true && !r.hit)
          findings.push({ level: 'error', code: 'EXPECTED_HIT_MISSED', text: `Step ${i + 1}: "${step.query}" should hit memory but missed (best score ${r.score.toFixed(2)}).` });
        if (step.expectHit === false && r.hit)
          findings.push({ level: 'error', code: 'UNEXPECTED_HIT', text: `Step ${i + 1}: "${step.query}" hit "${r.item.id}" but should have missed (scope or expiry leak).` });
        if (step.expectParaphraseHit && !r.hit)
          findings.push({ level: 'warn', code: 'PARAPHRASE_MISS', text: `Step ${i + 1}: paraphrase "${step.query}" missed - semantic cache would not catch this rephrase.` });
      }
    });
    const stats = { stored: mem.items.length, totalHits: mem.items.reduce((a, m) => a + m.hits, 0) };
    const wantedHit = steps.some((s) => s.query && (s.expectHit || s.expectParaphraseHit));
    if (stats.stored && wantedHit && stats.totalHits === 0)
      findings.push({ level: 'warn', code: 'NO_HITS_AT_ALL', text: 'Memory stores items but no query ever hits - retrieval threshold or indexing is broken.' });
    return { log, findings, stats };
  }
  return { tokenize, keywords, overlapScore, makeMemory, runScenario };
});
