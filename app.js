(function () {
  const $ = (id) => document.getElementById(id);
  function parseScenario(text) {
    const steps = [];
    const skipped = [];
    text.split('\n').forEach((raw, i) => {
      const line = raw.trim();
      if (!line) return;
      const parts = line.split('|').map((s) => s.trim());
      if (/^store\s+/i.test(parts[0])) {
        const [, id] = parts[0].split(/\s+/);
        const step = { store: { id, scope: parts[1] && !/^(ttl=)/.test(parts[1]) ? parts[1] : 'default', text: '' } };
        const rest = parts.slice(parts[1] && !/^ttl=/.test(parts[1]) ? 2 : 1);
        for (const p of rest) {
          const m = p.match(/^ttl=(\d+)$/);
          if (m) step.store.ttlSeconds = +m[1]; else step.store.text = p;
        }
        if (step.store.text) steps.push(step); else skipped.push(i + 1);
      } else if (/^query\s+/i.test(parts[0])) {
        const step = { query: parts[0].replace(/^query\s+/i, '') };
        for (const p of parts.slice(1)) {
          const ms = p.match(/^scope=(.+)$/); const me = p.match(/^expect=(hit|miss)$/);
          if (ms) step.scope = ms[1];
          else if (me) { if (me[1] === 'hit') step.expectHit = true; else step.expectHit = false; }
        }
        steps.push(step);
      } else skipped.push(i + 1);
    });
    return { steps, skipped };
  }
  function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function run() {
    const { steps, skipped } = parseScenario($('scenario').value);
    const { log, findings } = AgentMemoryCheck.runScenario(steps, Date.now());
    if (skipped.length) findings.unshift({ level: 'warn', code: 'UNPARSED', text: `Line(s) ${skipped.join(', ')} could not be parsed and were skipped.` });
    if (!findings.length) findings.push({ level: 'ok', code: 'CLEAN', text: 'Scenario ran clean: every expectation matched the simulated memory behaviour - a transparent toy scorer, not proof of production behaviour.' });
    $('findings').innerHTML = findings.map((f) =>
      `<li class="${f.level}"><span class="code">${esc(f.code)}</span><br>${esc(f.text)}</li>`).join('');
    $('log').innerHTML = log.map((l) => `<li>${esc(l)}</li>`).join('');
    $('results').classList.remove('hidden');
  }
  $('run').addEventListener('click', run);
})();
