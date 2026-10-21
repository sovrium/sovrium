/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// SYSTEM · Decisions — the architecture decision records the running app
// declares in `app.decisions[]`: a register to scan, one document to read.
//
// ─── WHAT THIS SURFACE IS FOR ──────────────────────────────────────────────
//
// Every other console page answers WHAT the app is: its tables, its automations,
// its variables. None of them answers WHY any of it is that way. An operator who
// inherits a running app can read that `DATABASE_URL` points at Postgres and
// still not know that it used to be SQLite, that the write lock was hit daily,
// or that the record saying so is still in the register with its status set to
// `superseded`. This is the page where the config explains itself.
//
// ─── READ-ONLY, AND STRUCTURALLY SO ────────────────────────────────────────
//
// [internal ref] amendment A6 authorises the register as an INTROSPECTION surface, on
// the same invariant as the two config reads A1 authorised: reading the running
// configuration is observability, mutating it is authoring. There is no edit
// control here because there is nothing to edit against — `GET /api/admin/decisions`
// is the only address the register has, a decision is changed in `app.ts` and
// redeployed, and the page says so where an operator would look for a button.
//
// ─── THREE THINGS THE CANVAS DRAWS THAT CONFIG CANNOT SAY ──────────────────
//
// Recorded here rather than silently dropped, because each is a platform gap
// with a shipped substitute rather than a decision taken on this surface.
//
//  1. STATUS CHIPS. The canvas draws `all · accepted · proposed · superseded` as
//     a chip row over the grid. A chip row is expressible — `/links` draws one
//     over `?period=` — but it would filter NOTHING: the endpoint takes no
//     parameters (it returns the register whole, by design), a `table` has no
//     static row predicate, and a `visibility.query` gate over four copies of
//     the same grid would render four identical unfiltered tables. A control
//     that redraws itself and changes no row is worse than no control. The
//     shipped substitute is the runtime filter builder (`toolbar.filters`),
//     which filters the rows the grid actually holds — and it holds all of them,
//     because the endpoint never pages.
//
//  2. NEWEST FIRST. The endpoint returns the DECLARED order deliberately —
//     "ordering is a reading choice and belongs to the surface that makes it" —
//     and this surface cannot make it: `defaultSort` was removed from the table
//     schema (it typed and then failed `sovrium validate`, the drift its
//     docstring still records). So the register reads in the order `app.ts`
//     states it, which is at least a fact about the file, and `toolbar.sort`
//     is how a reader asks for it by date.
//
// 3. A ONE-CELL LINEAGE COLUMN. The canvas prints `supersedes [internal ref]` or
// `superseded by [internal ref]` in one column. A column binds ONE field and there
//     is no cell template, so the two directions would be two columns of mostly
//     empty cells. The grid carries the one that changes what a reader should
//     DO — `Superseded by`, which marks a record not to act on — and the
//     document carries both, as links, in the record rail.
//
//  4. THE COUNTS. The canvas prints `12 decisions` and
//     `8 accepted · 2 proposed · 2 superseded` in the chrome bar. The endpoint
//     publishes all four as flat scalars for exactly that, and no config path
//     renders a system-bound scalar as bar text — the gap the `chromeEnd`
//     contract already records. They are NOT relocated to a `kpi` strip: that
//     would be four lazy islands over a page whose entire content is one small
//     table, on a surface the canvas draws with no tiles at all.
//
// ─── WHY TWO ROUTES AND NOT `?id=` ─────────────────────────────────────────
//
// The document was planned as a `?id=` view switch on this one route. It is not
// expressible: `page.query` REQUIRES a closed `enum` (an out-of-list URL value
// clamps to the default), and the ids belong to the host app's register, which
// a platform-owned preset compiled into the binary cannot enumerate. A path
// segment has no such allow-list, so the document is `/decisions/:id` — the same
// shape `/links/:slug`, `/users/:email` and `/tables/:table` already take.

import dashboardDecision from './dashboard-decision.page.json'
import dashboardDecisions from './dashboard-decisions.page.json'
import type { Page as PageConfig } from '@/domain/models/app'

export const decisionPages: readonly PageConfig[] = [
  dashboardDecisions as PageConfig,
  dashboardDecision as PageConfig,
]
