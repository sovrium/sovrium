/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// The console's ⌘K command palette, as config.
//
// ─── WHY IT IS DECLARED RATHER THAN INHERITED ──────────────────────────────
//
// The engine appends a generic record palette to every page unless the app opts
// out, and `src/admin/app.ts` opts out (`palette: { enabled: false }`). That is
// not the console refusing a palette — it is the console refusing the SECOND
// one: two palettes bound to one ⌘K open two overlays on one keystroke. The
// console's palette is cross-ENTITY search over `/api/admin/search`, which the
// generic record palette cannot express, so it is declared here explicitly.
//
// ─── `kindLabels` IS DELIBERATELY ABSENT ───────────────────────────────────
//
// The palette island carries its own kind→heading map and falls back to it when
// the config declares none. Authoring the map here would be the third copy of a
// vocabulary the server's `adminSearchEntityTypeSchema` already owns, and the
// first one able to drift from it silently — a heading naming a `kind` the
// server no longer emits reads as a permanently empty group. Adding it is a
// deliberate later step, taken together with a way to keep it honest.
//
// ─── IT RENDERS NO VISIBLE MARKUP ──────────────────────────────────────────
//
// Server-side this emits a JSON config block plus an island host; the overlay is
// built lazily in the browser on the first ⌘K. So its position in the shell has
// no layout effect — but it must stay OUTSIDE the SPA swap region, or a content
// swap would unmount the listener and ⌘K would stop working after the first
// in-console navigation.

import { SEARCH_ENDPOINT } from '../system-sources'

export default {
  type: 'command-palette',
  search: { endpoint: SEARCH_ENDPOINT },
} as const
