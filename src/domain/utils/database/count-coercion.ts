/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Safe coercion of a driver-returned aggregate scalar into a finite number.
 *
 * Applies to any single-value aggregate read — `COUNT(*)`, and equally
 * `SUM(size)`: the failure mode below is a property of the
 * `Number(row.x ?? 0)` idiom, not of the aggregate function used.
 *
 * Why this exists
 * ---------------
 * Every aggregate read in the codebase used to end in `Number(row.count ?? 0)`.
 * That idiom looks defensive but is NOT: `??` only rescues `null`/`undefined`,
 * and the value reaching it is frequently ALREADY a number. Drizzle's `count()`
 * is `sql\`count(*)\`.mapWith(Number)`, so the driver applies `Number()`
 * upstream — a count that fails to arrive lands as **`NaN`**, and `NaN ?? 0` is
 * `NaN`, not `0`.
 *
 * A single `NaN` then travels as a *successful* value, so neither
 * `Effect.catchAll` nor a latency guard can intercept it (the error channel
 * never sees it). It surfaces much later at the response boundary: the
 * 2026-07-25 production incident ended with
 * `ZodError {"expected":"number","received":"NaN","path":["submissions","total"]}`
 * — an admin-wide HTTP 500 caused by one unusable aggregate.
 *
 * Contract
 * --------
 * Coerce, then keep the value ONLY if it is finite; otherwise fall back to `0`.
 *
 *   - `NaN`, `Infinity`, `-Infinity`  → `0` (non-finite: unusable as a count)
 *   - `undefined`                     → `0` (`Number(undefined)` is `NaN`)
 *   - `null`, `''`                    → `0` (`Number()` yields `0` already)
 *   - `'12'` (Postgres bigint string) → `12`
 *   - `-5`, `0`, `7`                  → unchanged
 *
 * Negative values are deliberately passed through rather than clamped: a count
 * is never negative in practice, so clamping would silently mask a genuine
 * query bug. The documented contract is non-finite → `0`, nothing more.
 */
export const toFiniteCount = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
