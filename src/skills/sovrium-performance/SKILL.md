---
name: sovrium-performance
description: Use when a Sovrium app is slow or heavy and the cause has to be found and fixed behind the first byte — it measures first, then picks the lever — the page cache and what keeps a page out of it, image formats, sizes and loading, client islands, data bindings and pagination, table indexes and views, query shape, the ECO_* environment levers, low-data mode, X-Eco-Index, the database choice and local-first AI. Use for "this page is slow", "the site feels heavy", page weight, caching, Cache-Control and ETag, a slow list or table, an image too big, a performance or ecoconception review, a green or frugal site. Not this skill for Core Web Vitals thresholds, titles and share images, which are `sovrium-seo-geo`; nor for layout choices on one page, which are `sovrium-pages`.
license: BSL-1.1
metadata:
  author: sovrium
  version: '1.0.0'
---

# Sovrium performance

A bare agent tunes a Sovrium app like a hand-built web stack: it advises before measuring, adds an `eco` block to the config (the schema has none — the eco posture is the operator's, in `ECO_*` environment variables), asks for AVIF (the runtime transform has no AV1 encoder, so `?format=avif` answers `400`), "turns on caching" for a page that binds table data (such a page is never served from the page cache, by design), loads every row of a large table into one page instead of paginating, filters on a field with no index, quotes byte budgets and default values from memory, and promises a "green" badge with no measured figure behind it. In Sovrium the levers are few, named and observable: response headers say what the server did, and the manual says what each lever does in the binary you run.

Run the core loop from `sovrium-app` underneath this skill. Manual: `sovrium docs operations/ecoconception`, `sovrium docs operations/database-infrastructure`, `sovrium docs configuration/env-vars-services`, `sovrium docs configuration/env-vars-hosting`, `sovrium docs images/image-formats`, `sovrium docs images/image-presets-caching`, `sovrium docs images/image-transforms`, `sovrium docs components/media-components`, `sovrium docs tables/table-indexes-constraints`, `sovrium docs tables/table-views`, `sovrium docs records/records-filtering-sorting`, `sovrium docs pages/pages-overview`, `sovrium docs pages/pages-data-binding`, `sovrium docs ai/ai-eco-routing`.

## Scope

**What the config expresses**: whether a page can be cached (derived from what it reads, never declared), data bindings (`dataSource` with `limit`, `pagination`, `filter`, `sort`, `refreshMode`, `searchEngine`), table `indexes`, `unique` and `views` (including materialized SQL views), image `props` (`loading`, `width`, `height`, `srcset`, `sizes`, `variant: hero`), and which interactive components a page places.

**What the binary does on its own**: server rendering with interactive islands mounted afterwards; one compiled stylesheet per app holding only the component types it uses; an in-memory cache of anonymous page HTML; WebP negotiated from the `Accept` header on stored images; transformed images cached and served immutable; content-hashed assets cached for a long time.

**What the operator sets, never the config**: the `ECO_*` levers, `DATABASE_URL`, `STORAGE_TRANSFORM_PRESETS`, `AI_PROVIDER` and the AI routing precedence. Each one's values and default: `sovrium docs env <NAME>`. An `eco` key in the app config is refused; there is nothing to add there.

**Not here**: Core Web Vitals thresholds, titles, canonical URLs and share images (`sovrium-seo-geo`); one page's layout and composition (`sovrium-pages`); the visual system (`sovrium-design`).

## Evidence

Measure before advising, and say which evidence a finding rests on. Field data shows the impact on real visitors; lab data and headers explain it; source inspection only suggests it. [S2][S3]

| Evidence         | How                                                                                                                       | Proves                                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Response headers | `curl -sI <url>` anonymously, then with a session cookie                                                                  | `X-Render-Cache` (`hit`, `miss`, `bypass`), `Cache-Control`, `ETag`, `X-Eco-Index` — what the server actually did |
| Transfer size    | `curl -s -o /dev/null -w '%{size_download} %{time_starttransfer} %{time_total}\n' <url>`, and the browser's network panel | Bytes and time to first byte for this request                                                                     |
| Lab trace        | Chrome DevTools performance panel, or a Lighthouse run                                                                    | Why a page is slow on this device: the LCP element, long tasks, layout shift                                      |
| Field data       | Chrome UX Report or PageSpeed Insights on a public origin                                                                 | Whether real visitors are affected; it lags behind a fix                                                          |
| Database         | the slow request's `?filter`/`?sort` and the table's `indexes`                                                            | Whether a lookup can use an index                                                                                 |
| Config           | the page's bindings, images and components                                                                                | A likely cause, to be confirmed by one of the rows above                                                          |

With no running app, label every finding a hypothesis and give the command that would confirm it. Recipes and a per-page report template: `references/measure.md`.

## Survey → Implement → Evaluate

Copy this checklist into your notes and tick it as you go.

```
- [ ] 1 Name the slow pages and the visitor: anonymous or signed in, phone or desktop
- [ ] 2 Baseline each page: headers, transfer size, time to first byte (references/measure.md), and one lab trace for the worst
- [ ] 3 Classify each page: cacheable (miss then hit), revalidated (no-cache + ETag), or rendered fresh (bypass) — and why
- [ ] 4 Pick the lever by tier below; write the change and the expected effect before editing
- [ ] 5 Edit the config (or hand the operator the environment change); sovrium validate; fix until valid
- [ ] 6 Re-measure the same way, same conditions; record before and after
- [ ] 7 One browser pass: the page still works for its roles, images still load, nothing shifts
- [ ] 8 Report with the evidence type and confidence for each finding; field data is "pending" until it catches up
```

Change only what a measurement points at, one lever at a time, so the after-measurement can say what moved it.

## The checklist

Rule ids go in findings. Tags in brackets point to `references/sources.md`.

**CRITICAL — the slowest or heaviest thing on the page**

- `cache-know-why-bypass` — A page whose `X-Render-Cache` is `bypass` or whose `Cache-Control` is `no-cache` is rendered per request by design. Find the signal that keeps it out (a `dataSource` anywhere it renders, non-public `access`, a `:param` path with no `contentDir`, `presence`, a data-bound sidebar, `$app.origin`, a form prefilled from `$query` or `$now`, a session-dependent visibility rule) before touching anything. The list: `references/page-cache-and-rendering.md`. [S7][S22]
- `cache-split-static-from-data` — A marketing or landing page that is cacheable except for one small live widget is usually better split: keep the page request-invariant and move the live part to a page or component that reads data, or accept the revalidated render. Never fake freshness with a template that hides a binding — the cache follows templates and breakpoint children too.
- `data-paginate-large-sets` — A binding without `pagination` puts every record on one page. Give large tables a `pagination.pageSize` (or a `limit`), and let the records API page in the database. [S13]
- `data-index-the-filter` — Every field a page or an API caller filters or sorts on in a growing table has an index in the table's `indexes`; a composite index speeds lookups on its first field alone, not on its second. A `unique` lookup is an index already. [S14][S15]
- `data-no-client-search-on-big-tables` — `searchEngine: client` (the default) sends the bound rows to the browser and searches there. On a large table bind with a `limit` and search through the records endpoint instead; read `sovrium docs pages/pages-data-binding` for what each engine does today.

**HIGH — bytes and work every visit pays**

- `img-no-avif` — Never request `?format=avif`: it answers `400`. Name no format and let the server negotiate WebP from the `Accept` header; `?format=webp` when you must be explicit; `?format=origin` only for a download. [S9][S21]
- `img-size-at-the-source` — Request the size the layout draws (`?width=…`, or an operator preset `?preset=…`) and a low quality for small images; never ship the original to a thumbnail.
- `img-hero-eager-rest-lazy` — Only the largest image of the first screen loads eagerly (`variant: hero` does this by default); every other image stays lazy, and every image has `width` and `height`. [S6][S8]
- `island-only-what-the-page-needs` — Every interactive component (grid, calendar, chart, editor, chat) ships its own client code and requests. Place one only where the page's job needs it; a server-drawn list or cards render with no client fetch.
- `data-refresh-on-purpose` — `refreshMode: poll` re-reads on an interval and `realtime` holds a subscription; use them only where staleness hurts the visitor.
- `data-group-reads-all` — `groupBy` on a records request reads every matching row before grouping; on a large table, group in a view.

**MEDIUM — operator levers and infrastructure**

- `eco-env-not-schema` — Eco posture is set by the operator: `ECO_MODE`, `ECO_PAGE_CACHE`, `ECO_PAGE_CACHE_MAX_MB`, `ECO_INDEX_HEADER`, `ECO_LOW_DATA_DEFAULT`, `ECO_DESIGN_LAYER`, `ECO_FORM_ANALYTICS`, `ECO_AI_PROVIDER_PRECEDENCE`. Read each one's values and default with `sovrium docs env <NAME>` before proposing it; an unrecognised value refuses the boot, except for the AI precedence, which falls back silently. [S20]
- `eco-cache-budget-fits-container` — The page cache counts inside the process's memory limit; on a small container, size `ECO_PAGE_CACHE_MAX_MB` against it (`sovrium docs configuration/env-vars-hosting`).
- `eco-low-data-opt-in` — Low-data mode lowers fidelity and never blocks a feature; `respect-client` follows the visitor's `Save-Data` hint. It is the operator's choice, not the author's. [S10]
- `db-choose-by-load` — SQLite is the zero-config default and serves the core surface; set `DATABASE_URL` to PostgreSQL for concurrent writers and the features that need it (they answer `501` with `requires-postgres` on SQLite). Read `sovrium docs operations/database-infrastructure` before recommending a move.
- `view-materialize-heavy-reads` — A heavy SQL view read often can be `materialized`, with `refreshOnMigration`; it is stale until refreshed, so say so.
- `ai-local-first` — AI calls route through the provider precedence; prefer a reachable local model, and never hard-code a cloud provider. The health endpoint reports the precedence in force (`sovrium docs ai/ai-eco-routing`).

**LOW — micro-tuning, after the above**

- `fonts-fewer-faces` — Each declared web font is a request; fewer faces and weights, always with a fallback (the faces themselves are `sovrium-design`).
- `motion-short` — Long or infinite animations on first paint cost on every visit.
- `measure-x-eco-index` — Read `X-Eco-Index` for what it grades: response bytes, nothing more. It is not a Lighthouse or EcoIndex score.

## Before reporting

A candidate finding is reported only after four checks:

1. **Is it measured?** A header, a size, a trace or field data backs it; otherwise it is a hypothesis with the command to confirm it.
2. **Who pays for it?** Anonymous visitors, signed-in users, one role, crawlers; on every visit or on the first.
3. **How big is it?** Compare with the other findings on the same page; the largest measured cost goes first, whatever its tier.
4. **Is the lever in reach?** Config (the author), environment (the operator), or neither (say so; a Sovrium defect goes to `sovrium-report-issue`).

An empty report says "no findings", with the measurements that show it. A performance review never claims an improvement it did not re-measure.

## Report

```markdown
## Performance review — <app>

Conditions: <origin, anonymous/signed in, device or throttling, date>

| Severity | Rule                     | Page      | Evidence (type: value)                        | Smallest fix                         | Who changes it | Confidence |
| -------- | ------------------------ | --------- | --------------------------------------------- | ------------------------------------ | -------------- | ---------- |
| CRITICAL | data-paginate-large-sets | /products | headers: bypass, no-cache · transfer: <bytes> | `pagination.pageSize` on the binding | author         | Confirmed  |

Before → after: <page, metric, value, value>
Confidence: Confirmed (measured before and after) · Likely (measured once, cause read in config) · Needs verification (hypothesis).
Field data: pending until <source> reflects the change.
Decisions to record: <title — touches>
```

End the report with one `Decisions to record: <title — touches>` line per nominated decision, or `Decisions to record: none`. Nominate only a data-model shape, the permissions or auth model, SQLite versus PostgreSQL, a design character choice, a disabled or deferred automation, or a security trade-off left in place — never labels, copy or colours. Nominate here; the `sovrium-config-editor` agent writes the `decisions:` record, never this skill.

## Must not claim

1. The app config has an `eco` key, or any performance setting the operator does not control through the environment.
2. Sovrium serves AVIF from its image transform.
3. A page that binds table data, has non-public access or a parameterised path with no content directory, is served from the page cache.
4. Turning a cache on fixes a page that is rendered per request by design.
5. A default value or an option list of an `ECO_*` variable, quoted from memory instead of `sovrium docs env <NAME>`.
6. A byte, request or time budget Sovrium promises; the binary sets none for pages.
7. `X-Eco-Index` is a Lighthouse score, an EcoIndex score, or a measure of carbon.
8. An improvement that was not re-measured under the same conditions.
9. Low-data mode removes features.
10. The page cache serves signed-in visitors or preview renders.
11. A lab score proves what real visitors experience.
12. An "eco" or "green" badge is honest without a measured figure beside it.

## References

- [references/page-cache-and-rendering.md](references/page-cache-and-rendering.md) — read when a page is slow for anonymous visitors or a header surprises you: the three cache verdicts, every signal that keeps a page out, the headers per case, islands and the stylesheet.
- [references/images.md](references/images.md) — read before touching an image: negotiation, formats and the AVIF refusal, width and quality, presets, the transform cache, loading and dimensions.
- [references/data-and-queries.md](references/data-and-queries.md) — read when a list, table, board or API call is slow: pagination, limits, search engines, refresh modes, indexes, views, the database choice.
- [references/eco-levers.md](references/eco-levers.md) — read before proposing any environment change: each `ECO_*` lever, the command that prints its values, and its class.
- [references/measure.md](references/measure.md) — read before the survey and before reporting: curl recipes, DevTools and Lighthouse, field data, the per-page template.
- [references/sources.md](references/sources.md) — the public sources behind the tags above, and the Sovrium decisions this skill states.
