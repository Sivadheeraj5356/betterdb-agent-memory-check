# BetterDB Agent Memory Check

A client-side QA harness for an agent memory layer, built with BetterDB's world in mind: long-term agent memory, semantic caching and retrieval over your own store are only worth shipping if hits, misses, scoping and expiry behave exactly as promised.

Define a scenario of `store` and `query` steps and the harness flags:

- **EXPECTED_HIT_MISSED** - a query that should have recalled a memory but did not
- **UNEXPECTED_HIT** - a query that recalled something it should not (scope or TTL leak)
- **PARAPHRASE_MISS** - a rephrase the retrieval layer failed to catch
- **NO_HITS_AT_ALL** - memory stores items but never serves one

Retrieval here is a transparent keyword-overlap scorer (cosine over keyword sets) so every hit and miss is explainable in the execution log - the point is the harness shape: scoped namespaces, TTL expiry, and observable hit/miss accounting.

## Use

Open `index.html` and edit the scenario, one step per line:

```text
store m1 | default | refund window is 30 days for damaged items
store m3 | ops | warehouse cutoff time is 4pm IST | ttl=3600
query refund window damaged items | expect=hit
query warehouse cutoff | expect=miss
```

## Test

```bash
npm test
```

The project uses plain HTML, CSS and JavaScript with the Node.js built-in test runner. It has no external services, build step or secrets.
