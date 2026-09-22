/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * API contracts for the five reads that describe **this operator's** design
 * system, as opposed to what the engine can draw:
 *
 *   GET /api/admin/design-system/tokens?group=   — the resolved tokens, + counts
 *   GET /api/admin/design-system/guidance?kind=  — the declared prose, split
 *   GET /api/admin/design-system/coverage?key=   — which layers they declared
 *   GET /api/admin/design-system/exports         — what each export weighs
 *   GET /api/admin/design-system/usage?type=     — where a type is written
 *
 * ─── WHY THIS FILE EXISTS BESIDE `component-types.ts` ──────────────────────
 *
 * The split is the whole finding this module answers. `component-types.ts`
 * publishes the COMPONENT REGISTRY: which types exist, what fields they take,
 * which layer contributes a class. That is a constant for a given build — the
 * same eighty-five rows on every instance — which is why its module note can
 * say "a component catalogue describes what the engine can draw, not what this
 * instance holds".
 *
 * Everything here is the opposite: a FUNCTION of the operator's own `App`. The
 * token rows change when they edit `design`, the guidance rows are their
 * sentences, the export sizes are the bytes their config produces, and the
 * usage counts walk their `pages[]`. A console page transcribed into config
 * cannot compute any of it — a preset page is a constant — so each fact needs
 * an endpoint or it needs a builder, and [internal ref] leaves only the endpoint.
 *
 * Keeping the two families in one module would have put "invariant per build"
 * and "varies per operator" behind one header, and the caching, auditing and
 * staleness answers differ on exactly that axis.
 *
 * ─── THE ROWS ENVELOPE, AND WHY `summary` RIDES ALONG ──────────────────────
 *
 * Every response is `{ items, total }` — the shared envelope the rest of the
 * console binds through `dataSource.system`, with `rowsKey` defaulting to
 * `items`. The token read adds a `summary` object for one reason: the "Votre
 * design" page prints *N inherited · M overridden · L locked* as three
 * headline figures, and a `kpi` binds a scalar through
 * `dataSource.system.valuePath` — `summary.overridden` is that path. Counting
 * the rows client-side instead would mean shipping the whole token table to a
 * page that wanted three integers.
 *
 * `summary` describes the `items` THIS response carries, filter included. A
 * summary that silently counted the unfiltered document would make
 * `?group=color` print the whole system's totals beside six colour rows, and
 * no reader could tell which number they were looking at. The page that wants
 * the system-wide counters binds the read without a filter, which is what it
 * means.
 *
 * ─── AUTHORISATION AND THE CONFIDENTIALITY BOUND ───────────────────────────
 *
 * Reads only, behind the admin tier, answering **404** — never 403 — to an
 * anonymous or non-admin caller (standing rule S1, anti-enumeration). Same
 * invariant as the exports beside them: reading the running configuration is
 * observability, mutating it is authoring, and [internal ref] A2 puts authoring
 * outside the self-hosted product. There is no request-body schema in this
 * module because there is nothing to write to.
 *
 * These projections read `design.*`, `theme.*`, `components[].guidance` and the
 * PATHS of `pages[]`. They carry no table data and no `app.env[]` value. The
 * usage read is the one that touches `pages[]` at all, and it publishes a
 * route path and a count — never a page's content.
 *
 * `strictKeys` throughout is part of that bound rather than tidiness: a closed
 * response object means an implementer cannot smuggle an extra field into the
 * payload without the contract rejecting it first.
 *
 * @see src/domain/models/api/admin/design-system/component-types.ts
 */

/*
 * ─── WHERE EACH FACET LIVES ────────────────────────────────────────────────
 *
 * The contracts are one per facet, in a sibling named after it; this module is
 * the one every route and use-case names, so it re-exports all of them. The
 * split is a file boundary, never a change to what `facets` exports.
 *
 *   `facets-tokens.ts`   — GET /tokens?group=    the resolved tokens, + counts
 *   `facets-guidance.ts` — GET /guidance?kind=   the declared prose, split
 *   `facets-coverage.ts` — GET /coverage?key=    which layers they declared
 *   `facets-exports.ts`  — GET /exports          what each export weighs
 *   `facets-usage.ts`    — GET /usage?type=      where a type is written
 *   `facets-brand.ts`    — the mark, as rows a page can draw
 *   `facets-zones.ts`    — the zones, as rows
 */

export * from './facets-tokens'
export * from './facets-guidance'
export * from './facets-coverage'
export * from './facets-exports'
export * from './facets-usage'
export * from './facets-brand'
export * from './facets-zones'
