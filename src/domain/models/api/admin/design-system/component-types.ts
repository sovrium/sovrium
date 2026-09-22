/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * API contracts for the three schema-introspection reads the design-system
 * console runs on:
 *
 *   GET /api/admin/schema/component-types          — the catalogue, as rows
 *   GET /api/admin/schema/component-types/:type    — one type's fields
 *   GET /api/admin/design-system/provenance        — why a class is on an element
 *
 * plus the `?flat=1` projection of `GET /api/admin/design-system.json`.
 *
 * ─── WHY THESE ARE ENDPOINTS AND NOT BUILDERS ───────────────────────────────
 *
 * The console pages that read them are declarative config, and a config page
 * binds rows through a `dataSource.system` — an endpoint, a `rowsKey`, a
 * `totalKey`. So every response here is shaped as the SAME rows envelope the
 * rest of the console already speaks (`{ items, total }`), rather than as a
 * bespoke object per surface. `SystemSourceSchema` defaults `rowsKey` to
 * `items` and `totalKey` is opt-in, so a page binds these with no extra
 * declaration at all.
 *
 * ─── AUTHORISATION ──────────────────────────────────────────────────────────
 *
 * Reads only, behind the admin tier, answering **404** — never 403 — to an
 * anonymous or non-admin caller (standing rule S1, anti-enumeration). Same
 * invariant as the export beside it: reading is observability, mutating is
 * authoring, and [internal ref] A2 puts authoring outside the self-hosted product.
 * There is no request-body schema in this module because there is nothing to
 * write to.
 *
 * ─── THE CONFIDENTIALITY BOUND ──────────────────────────────────────────────
 *
 * These projections read the SCHEMA and the `design` key. They carry no table
 * data, no `app.env[]` value, and no operator content — a component catalogue
 * describes what the engine can draw, not what this instance holds.
 *
 * `strictKeys` throughout is part of that bound rather than tidiness: a closed
 * response object means an implementer cannot smuggle an extra field into the
 * payload without the contract rejecting it first.
 *
 */

/*
 * ─── WHERE EACH CONTRACT LIVES ──────────────────────────────────────────────
 *
 * One file per read, named after it; this module is the one every route and
 * use-case names, so it re-exports all of them. The split is a file boundary,
 * never a change to what `component-types` exports.
 *
 *   `component-types-catalogue.ts`  — the catalogue, as rows
 *   `component-types-parts.ts`      — the row shapes one type's detail carries
 *   `component-types-detail.ts`     — one type's whole detail record
 *   `component-types-options.ts`    — one type's whole option surface
 *   `component-types-provenance.ts` — why a class is on an element
 *   `component-types-tokens.ts`     — the flat projection of the token document
 */

export * from './component-types-catalogue'
export * from './component-types-parts'
export * from './component-types-detail'
export * from './component-types-options'
export * from './component-types-provenance'
export * from './component-types-tokens'
