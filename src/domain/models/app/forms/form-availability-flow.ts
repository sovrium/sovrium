/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Pure availability-window evaluation for top-level forms.
 *
 * A form declares an optional `availability` block:
 *   - `opensAt`  — ISO 8601 timestamp before which submissions are rejected
 *   - `closesAt` — ISO 8601 timestamp after which submissions are rejected
 *   - `maxSubmissions` — hard cap on accepted (non-spam) submissions
 *
 * The window check (opensAt / closesAt) is a pure function of the current
 * time and is evaluated before any database access. The cap
 * (`maxSubmissions`) is enforced atomically at the ledger-write step in the
 * infrastructure layer (`reserveTopLevelSlot`), not here, because it needs a
 * race-free count + insert against the database.
 */

/** Minimal shape of `form.availability` consumed by the evaluator. */
export interface FormAvailabilityShape {
  readonly opensAt?: string
  readonly closesAt?: string
  readonly maxSubmissions?: number
}

/**
 * Window evaluation result. `'open'` means submissions are accepted (modulo
 * the cap, which is evaluated separately). `'not-yet-open'` / `'closed'`
 * map to the two 403 rejection bodies the spec asserts on.
 */
export type AvailabilityWindowState =
  | { readonly kind: 'open' }
  | { readonly kind: 'not-yet-open'; readonly opensAt: string }
  | { readonly kind: 'closed'; readonly closedAt: string }

/**
 * Evaluate the opensAt / closesAt window against `now`. Returns `'open'`
 * when no window is configured or `now` falls inside it. A future `opensAt`
 * yields `'not-yet-open'`; a past `closesAt` yields `'closed'`.
 *
 * `opensAt` is checked before `closesAt` so a form that is both not-yet-open
 * AND past a (misconfigured) closesAt reports `not-yet-open` first — the
 * schema validator already rejects opensAt >= closesAt, so this ordering
 * only matters for defensive completeness.
 */
export const evaluateAvailabilityWindow = (
  availability: FormAvailabilityShape | undefined,
  now: number
): AvailabilityWindowState => {
  if (availability === undefined) return { kind: 'open' }
  const { opensAt, closesAt } = availability
  if (opensAt !== undefined) {
    const open = Date.parse(opensAt)
    if (!Number.isNaN(open) && now < open) {
      return { kind: 'not-yet-open', opensAt }
    }
  }
  if (closesAt !== undefined) {
    const close = Date.parse(closesAt)
    if (!Number.isNaN(close) && now >= close) {
      return { kind: 'closed', closedAt: closesAt }
    }
  }
  return { kind: 'open' }
}
