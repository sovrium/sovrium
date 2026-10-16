/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// sovrium-library: block/command@0.37.0#11d80c9163ba

// The console's ⌘K command palette, INSTALLED from the library's `command`
// block. The copy keeps the block's shape; its bindings are `search`, which
// adds cross-entity search over `/api/admin/search`, and `groups`, which
// replaces the block's demo rows with the console's one authored row below
// (literals here, because a block copy is read as a literal, as every copy is
// read).
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

// ─── THE ONE AUTHORED ROW: « ASK ABOUT THIS APP » ──────────────────────────
//
// Drawn above the search results on every console page, it takes the operator
// to the Overview's assistant with the words typed so far (`$query`, filled in
// the browser and URL-encoded in `href`); the composer reads them from `?q=`
// and waits, focused and unsent. With nothing typed the row reads its
// `emptyLabel`. The group carries the composer's own gate — a model to answer
// and a caller allowed to act — and is removed on the server where that gate
// fails, so a read-only operator's page never carries the row at all.

const paletteCopy = {
  type: 'command',
  search: { endpoint: '/api/admin/search' },
  groups: [
    {
      label: '$t:admin.palette.ask.group',
      visibility: { runtime: 'ai', capability: 'edit-operations' },
      items: [
        {
          label: '$t:admin.palette.ask.label',
          emptyLabel: '$t:admin.palette.ask.empty',
          icon: 'message-square',
          href: '/?q=$query',
        },
      ],
    },
  ],
} as const

export default paletteCopy
