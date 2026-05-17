/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Shared period preset for admin overview endpoints (CC-2).
 *
 * Locked by `US-ADMIN-AUTOMATIONS-OVERVIEW` (story #1) per the Phase-0 read-API
 * authoring plan §5.2. Subsequent overview endpoints — users, tables, buckets —
 * MUST import this schema rather than re-declaring the enum, so the period UX
 * stays consistent across the admin dashboard.
 *
 * The enum values were chosen to cover the three triage windows operators ask
 * for: "what's happening right now?" (24h), "how did we do this week?" (7d),
 * and "month-over-month?" (30d). Custom date ranges are deliberately out of
 * scope for Phase-0 — adding them later is non-breaking (a new variant of the
 * enum or a sibling `from`/`to` pair).
 *
 * @see ADR-012 D5 — `series` rollup with fixed buckets is the canonical
 *      overview shape; `resolvePeriodWindow()` produces the bucket size that
 *      stays in lock-step with that decision.
 */

import { z } from '@hono/zod-openapi'

/**
 * Period preset literal accepted by every admin overview endpoint.
 *
 * Default `'24h'` — operators on the dashboard footer expect "today's
 * snapshot" without picking a value first. The default is enforced at the Zod
 * layer so a missing `?period` query param produces the same handler input as
 * an explicit `?period=24h`.
 */
export const periodPresetSchema = z
  .enum(['24h', '7d', '30d'])
  .default('24h')
  .describe(
    'Time window for the overview rollup. 24h returns 1h-bucket series; 7d and 30d return 1d-bucket series. Default: 24h.'
  )

export type PeriodPreset = z.infer<typeof periodPresetSchema>

/**
 * Bucket interval emitted in `series.interval` of every overview response.
 *
 * Maps from the period preset (locked by ADR-012 D5):
 * - `24h` period → `1h` buckets (24 points)
 * - `7d`/`30d` period → `1d` buckets (7 / 30 points)
 *
 * Exported as a Zod enum so consumer schemas (`bucketsOverviewResponseSchema`,
 * sibling overview shapes) reference a single canonical type rather than
 * redeclaring the literal union per file.
 */
export const seriesIntervalSchema = z
  .enum(['1h', '1d'])
  .describe('Bucket interval for the overview series rollup. Derived from the period preset.')

/** @public */
export type SeriesInterval = z.infer<typeof seriesIntervalSchema>

/**
 * Concrete, resolved period window used by handlers to query the database.
 *
 * `from` and `to` are ISO 8601 UTC strings — `to` is "now" at the moment the
 * handler runs (NOT cached at module load). `interval` is the bucket size the
 * handler must group rows by (`date_trunc(interval, timestamp)`).
 *
 * The interval mapping is locked by ADR-012 D5:
 * - `24h` → `1h` buckets (24 points)
 * - `7d`  → `1d` buckets (7 points)
 * - `30d` → `1d` buckets (30 points)
 *
 * Mixing finer granularity (e.g. 1h buckets at 30d) would produce 720 points
 * per overview response — too noisy for dashboard tiles and slow to render.
 * Coarser granularity at 24h (e.g. 1d) would collapse the response into a
 * single point, defeating the point of a series. The locked pairing is the
 * one ADR-012 explicitly forbids re-opening.
 */
export interface PeriodWindow {
  readonly from: string
  readonly to: string
  readonly interval: '1h' | '1d'
}

/**
 * Resolve a period preset to the concrete window the handler will query.
 *
 * Pure function — does not read any environment state, does not cache. Pass
 * `now` explicitly in tests to make assertions deterministic; production
 * callers omit it to use the system clock at the moment the handler runs.
 *
 * @param preset — One of the three period presets; default applied at the
 *   Zod layer means the parameter is always a literal value here, never
 *   `undefined`.
 * @param now — Reference timestamp (defaults to `new Date()`). Tests override
 *   this to assert the from/to boundary exactly.
 */
const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

/**
 * Per-preset offset and bucket interval pairing.
 *
 * The mapping is locked by ADR-012 D5; declared as a frozen record so the
 * resolver below is a pure lookup with no branching.
 */
const PRESET_TO_WINDOW: Readonly<
  Record<PeriodPreset, { readonly offsetMs: number; readonly interval: '1h' | '1d' }>
> = {
  '24h': { offsetMs: 24 * HOUR_MS, interval: '1h' },
  '7d': { offsetMs: 7 * DAY_MS, interval: '1d' },
  '30d': { offsetMs: 30 * DAY_MS, interval: '1d' },
}

export function resolvePeriodWindow(
  preset: 'default' | PeriodPreset = 'default',
  now: Date = new Date()
): PeriodWindow {
  // The Zod default is applied before this function is called, but consumers
  // that bypass parsing (e.g. internal call sites) may pass `'default'` to
  // request the canonical default behavior. Map it to '24h' explicitly.
  const resolved: PeriodPreset = preset === 'default' ? '24h' : preset
  const { offsetMs, interval } = PRESET_TO_WINDOW[resolved]
  const from = new Date(now.getTime() - offsetMs)

  return {
    from: from.toISOString(),
    to: now.toISOString(),
    interval,
  }
}
