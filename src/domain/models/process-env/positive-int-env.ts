/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A positive integer read from one environment value, or `undefined` when the
 * value is absent, blank, or anything other than a whole number above zero.
 *
 * The one reader behind every operator-tunable limit that falls back to its
 * default on a value it cannot use — the rate-limit windows and ceilings, the
 * API timeout and body limit. `Number`, not `parseInt`: `"30s"` or `"1.5"` is
 * a value the operator did not mean, so it is refused rather than truncated,
 * and `Infinity` is refused with it, so no limit can be widened to "never".
 */
export const parsePositiveIntEnv = (raw: string | undefined): number | undefined => {
  if (raw === undefined || raw.trim() === '') return undefined
  const value = Number(raw)
  return Number.isSafeInteger(value) && value > 0 ? value : undefined
}
