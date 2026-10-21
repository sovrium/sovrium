/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// Analytics — the audience of the operator's own pages.
//
// A flat Plausible-style dashboard, not an object rail: audience is app-wide,
// and there is no "pick a page first". Six panels, every one of them a generic
// system-bound component over an endpoint that already shipped.
//
// ─── WHAT IT TOOK TO WRITE THIS AS CONFIG ──────────────────────────────────
//
// One thing, and it is the reason this surface stayed a builder longest: every
// `/api/analytics/*` reader requires ABSOLUTE ISO `from` / `to`, while a
// `dataSource.system.query` value is a static literal. "Thirty days back, ending
// now" was not expressible in config at all, so the builder computed it in
// TypeScript and baked it into ten panels.
//
// `page.window` closes exactly that: a closed list of look-back presets,
// resolved ONCE per render into `$window.start` / `$window.end` /
// `$window.granularity`. Once per render is the load-bearing half — a page whose
// panels each resolved `now` for themselves would drift their windows apart by
// however long the render took, and a surface reporting two periods at once
// invites the operator to compare them.
//
// ─── WHY ONE PRESET, AND NO PERIOD RAIL ────────────────────────────────────
//
// The retired builder had no period selector: the window was fixed at 30 days,
// and its own comment called that a deferred platform gap. Declaring the three
// presets the Links console offers would be a NEW capability on this surface,
// not a migration of the old one — it changes what an operator can do, moves the
// `@regression` screenshot baseline, and is a product decision rather than a
// mechanical one. So this declares the window the surface actually has, which
// is what makes `$window.*` usable here without changing a single byte of the
// rendered document.
//
// Adding `{ id: '24h' }` and `{ id: '7d' }` plus a `link` rail marked with
// `activeWhen` is a two-part edit the day that decision is taken.
//
// ─── EVERY LITERAL IS COPIED, NOT CHOSEN ───────────────────────────────────
//
// The `@regression` test takes an UNMASKED full-page screenshot, so every string
// on this page is pixel-pinned — including the six section headings, every
// column header and every empty message, none of which any locator names. They
// are reproduced verbatim from the retired builder for that reason.

import dashboardDataPages from './dashboard-data-pages.page.json'
import type { Page as PageConfig } from '@/domain/models/app'

export default [dashboardDataPages as PageConfig] satisfies readonly PageConfig[]
