/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// The operator-DATA surfaces: the console pages about the app's own contents.
//
// ─── WHY ONE BARREL AND NOT N IMPORTS IN `app.ts` ──────────────────────────
//
// `app.ts` names ONE import per area rather than one per page. The console is
// being migrated area by area, by several hands, and a per-page list in `app.ts`
// makes every area's landing a diff on the same seven lines — a merge conflict
// manufactured entirely by the shape of the import block. An area barrel moves
// that churn inside the area, where it belongs.
//
// Order is the order an operator meets them in the sidebar, not alphabetical.
//
// A module may export SEVERAL pages — Records is one surface answering two paths
// (`/tables` and `/tables/:table`), so it spreads. Its own file owns their
// relative order, which is where a route-precedence question belongs.

import agents from './agents'
import automations from './automations'
import buckets from './buckets'
import connections from './connections'
import forms from './forms'
import links from './links'
import organisation from './organisation'
import pages from './pages'
import tables from './tables'
import users from './users'
import type { PageConfig } from 'sovrium'

/**
 * Every data-surface page, in sidebar order: System, then Application, then the
 * one Developers row that is also a data surface.
 *
 * The order is documentation, not routing. Every path below is distinct, so
 * nothing here decides precedence — that question arises only INSIDE a module
 * exporting several pages (Records answers both `/tables` and `/tables/:table`),
 * and each such module owns its own spread order.
 */
export const dataPages: readonly PageConfig[] = [
  // System — Organisation leads, as it does in the sidebar: it is the one
  // surface about the SHAPE of the app rather than its contents, and it is the
  // question an operator arrives with.
  organisation,
  ...users,
  // `/pages` and the retained `/footprint`, which is the same page opened on
  // the other tab.
  ...pages,
  // Application
  automations,
  ...tables,
  ...forms,
  ...buckets,
  ...agents,
  ...links,
  // Developers
  connections,
]

export default dataPages
