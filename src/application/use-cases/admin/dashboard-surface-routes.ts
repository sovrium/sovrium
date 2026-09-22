/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The ONE `/_admin`-stripped sub-path question the console still parses.
 *
 * ─── WHAT THIS FILE WAS ────────────────────────────────────────────────────
 *
 * A table of parsers, one per synthesised surface family: the Data destinations,
 * the seven design-system console pages, the eighty-five per-type pages. Every
 * one of those is an authored page of the embedded preset now, matched by the
 * ordinary page router against a declared `path` — including the two families
 * whose segments are open-valued, which `page.params` vouches for by naming the
 * read endpoint their domain comes from.
 *
 * So the parsers went with the builders behind them. What survives is the single
 * question the MOUNT asks, and it is not about routing at all: it is the one
 * place the console is allowed to look at the operator's schema, in order to
 * merge the table a Records grid is about to bind.
 */

/**
 * Parse the RECORDS-GRID sub-path — `/tables/{table}` — or `undefined`.
 *
 * ─── WHY THIS IS ALL THAT IS LEFT OF THE DATA PARSER ───────────────────────
 *
 * The general Data-route parser recognised `/{page}[/{object}]` for every Data
 * destination, because a resolver behind it claimed eight of them. Every one of those is now
 * an authored page of the embedded preset, matched by the ordinary page router,
 * so the general parser had exactly one caller left — and that caller only ever
 * asked one question of it.
 *
 * ─── WHAT THE ONE CALLER NEEDS IT FOR ──────────────────────────────────────
 *
 * The deliberate platform seam: a config page cannot inject the OPERATOR's
 * table into `app.tables`, so the mount merges it when the requested path names
 * one (`routeBoundOperatorTables`, `mount/embedded-app-mount.ts`). That is the
 * one place the mount knows the operator schema, and it is documented as such
 * rather than hidden.
 *
 * ─── WHAT IS PRESERVED FROM THE GENERAL PARSER ─────────────────────────────
 *
 * Exactly two segments. Three or more answered `undefined` before and must here
 * too: `/tables/a/b` names no table, and returning `a` for it would merge an
 * operator table into a request that is about to 404 anyway.
 *
 *  - `/tables/contacts` → `'contacts'`
 *  - `/tables`          → undefined (the directory; no table to merge)
 *  - `/tables/a/b`      → undefined
 *  - `/forms/contact`   → undefined (not the records grid)
 */
export function parseRecordsGridRoute(dashboardPath: string): string | undefined {
  const segments = dashboardPath.split('/').filter((segment) => segment.length > 0)
  if (segments.length !== 2 || segments[0] !== 'tables') return undefined
  return segments[1]
}
