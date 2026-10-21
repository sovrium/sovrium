/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// Links — which short link the audience is actually using, and which one needs
// changing right now.
//
// TWO pages out of one module: the flat directory and one link's deep-dive.
// They share a window, a query and four panel shapes, so splitting them across
// two files would put the halves of one surface where a change to the trend
// chart could land on one and miss the other.
//
// ─── IT IS A FLAT DIRECTORY — NO `redirectToFirst` ─────────────────────────
//
// Records, Submissions and Files 302 a bare path to their first object because
// their object list is config-bounded and the sidebar enumerates it. The links
// population is unbounded and database-backed: there is no meaningful "first
// link", enumerating hundreds of rows in a 256px disclosure would be hostile,
// and the operator's first question is cross-link anyway. `page.redirectToFirst`
// exists and is deliberately NOT declared here — `[internal ref]`
// pins the bare path staying put.
//
// ─── EVERY METRIC COMES FROM THE ANALYTICS READERS ─────────────────────────
//
// There is no `/api/admin/links/overview` and no per-link click endpoint,
// however natural either looks: a second aggregation path over the same click
// rows would eventually disagree with the first. Both pages ask the
// SAME readers a narrower question, with `event_type=link_click`, and the
// deep-dive adds `event_name`. The ONE links-specific endpoint either page binds
// is the catalog, and it lists definitions rather than metrics.
//
// ─── WHAT KEPT THIS A BUILDER, AND WHAT CLOSED IT ──────────────────────────
//
// Three things, in the order they were closed.
//
// `page.window` (the analytics readers require ABSOLUTE ISO `from` / `to`, and a
// `dataSource.system.query` value is a static literal, so "seven days back,
// ending now" was not expressible at all). `link.activeWhen` / `activeProps`
// (the period rail marks one preset current, which is an attribute on one of
// three links rather than a visibility gate — spelling it with one would mean
// six links to render three). And a page-level `{ system }` record resolved
// SERVER-SIDE, because the deep-dive's own name has to be in the first
// response: a heading patched in after a fetch leaves the document briefly
// nameless, and permanently nameless to a crawler or a reader with no scripting.
//
// The last blocker was ONE token. The whole surface passed 84 specs on its first
// run and was reverted anyway, because the builder heads the deep-dive
// `title ?? slug` and `AdminLink.title` is nullable — a console-minted link put
// the literal word `null` at the top of an operator page. It was closed in
// the `$` grammar rather than in this file: `$record.title|$record.slug` resolves
// to the first candidate that is non-empty, so every consumer of that
// substitution gained a fallback at once and this page declares no special case.

import dashboardDataLinks from './dashboard-data-links.page.json'
import { detail } from './link-detail'
import type { Page as PageConfig } from '@/domain/models/app'

export default [
  dashboardDataLinks as PageConfig,
  detail as PageConfig,
] satisfies readonly PageConfig[]
