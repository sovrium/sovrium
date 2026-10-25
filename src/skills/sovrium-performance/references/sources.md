# Sources

The public sources this skill learned from, and the Sovrium decisions it states. Each entry: tag, title — organisation or author — URL — what was taken. URLs answered on 2026-10-24. Nothing is copied: every source keeps its own licence, and this skill is written in its own words from the Sovrium manual and schema. Sovrium's own decisions are not shipped as documents; each entry names the manual article where its consequences are stated. No budget figure from any source is carried over: Sovrium sets none for pages, so none is quoted.

## Contents

- Skills and method (S1–S4, S19)
- Measurement (S5, S11, S12, S17)
- Loading, images and caching (S6–S10, S18)
- Data and queries (S13–S15)
- Footprint (S16)
- Sovrium decisions (S20–S22)

## Skills and method

- **S1 Agent Skills best practices** — Anthropic — https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices. Taken: a concise body, one level of references, a copyable checklist with a measure → fix → re-measure loop, evals first.
- **S2 `performance` skill** — Addy Osmani, web-quality-skills — https://github.com/addyosmani/web-quality-skills (MIT). Taken: four evidence types (field, first-party monitoring, lab trace, static source), field shows impact and lab explains it, measure before editing, change only what a measurement points at, report before and after with conditions, label unverified items as hypotheses.
- **S3 `core-web-vitals` skill** — Addy Osmani, web-quality-skills — https://github.com/addyosmani/web-quality-skills (MIT). Taken: never compare one lab value with a field percentile; source alone suggests a cause, it does not prove a failing metric.
- **S4 `react-best-practices` skill** — Vercel — https://github.com/vercel-labs/agent-skills (MIT). Taken: rules grouped in impact tiers from CRITICAL to LOW, each with a prefixed kebab id usable in a report.
- **S19 Equipping agents for the real world with Agent Skills** — Anthropic engineering — https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills. Taken: progressive disclosure, a skill that names its neighbours.

## Measurement

- **S5 Chrome UX Report** — Google — https://developer.chrome.com/docs/crux. Taken: field data from real visitors, its lag.
- **S11 Lighthouse overview** — Google — https://developer.chrome.com/docs/lighthouse/overview. Taken: a lab run under stated conditions; the score as a guardrail.
- **S12 PageSpeed Insights** — Google — https://pagespeed.web.dev/. Taken: field and lab side by side for one URL.
- **S17 Web Vitals** — web.dev — https://web.dev/articles/vitals. Taken: which metrics measure loading, responsiveness and stability; thresholds left to `sovrium-seo-geo`.

## Loading, images and caching

- **S6 Optimize Largest Contentful Paint; Fetch Priority** — web.dev — https://web.dev/articles/optimize-lcp and https://web.dev/articles/fetch-priority. Taken: the LCP image loads eagerly with high priority, nothing else competes with it.
- **S7 HTTP caching** — MDN — https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching. Taken: reading `Cache-Control`, revalidation with an `ETag`.
- **S8 Browser-level image lazy loading** — web.dev — https://web.dev/articles/browser-level-image-lazy-loading. Taken: lazy for every image below the first screen, dimensions on every image.
- **S9 Use WebP images** — web.dev — https://web.dev/articles/serve-images-webp. Taken: WebP's saving over JPEG, serving it by negotiation.
- **S10 Save-Data** — MDN — https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Save-Data. Taken: the client hint a reduced-data posture can follow.
- **S18 HTTP Semantics (RFC 9110) and HTTP Caching (RFC 9111)** — IETF — https://www.rfc-editor.org/rfc/rfc9110 and https://www.rfc-editor.org/rfc/rfc9111. Cited for conditional requests and cache directives; wording not reproduced.

## Data and queries

- **S13 Paging through results** — Markus Winand, Use The Index, Luke — https://use-the-index-luke.com/no-offset. Paraphrased: paging in the database, the cost of reading everything to show a page.
- **S14 Multicolumn indexes** — PostgreSQL documentation — https://www.postgresql.org/docs/current/indexes-multicolumn.html. Taken: a composite index serves its leading column.
- **S15 The SQLite query planner** — SQLite — https://www.sqlite.org/queryplanner.html. Taken: how an index turns a full scan into a lookup.

## Footprint

- **S16 EcoIndex** — GreenIT — https://www.ecoindex.fr/. Cited to say what Sovrium's `X-Eco-Index` header is not: it grades response bytes only, not the page analysis EcoIndex performs.

## Sovrium decisions

- **S20 Performance-first by default; the eco posture is the operator's, in `ECO_*` environment variables, never in the app schema** — Sovrium. Not shipped; consequences in `sovrium docs operations/ecoconception`.
- **S21 Runtime image transforms encode WebP and refuse AVIF** — Sovrium. Not shipped; consequences in `sovrium docs images/image-formats`.
- **S22 Page cacheability is derived from what a page reads, never declared, and the cache serves anonymous requests only** — Sovrium. Not shipped; consequences in `sovrium docs operations/database-infrastructure`.
