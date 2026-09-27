/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/** The renewal window of `longLivedToken` when `renewWithinDays` is omitted. */
export const DEFAULT_LONG_LIVED_RENEW_WITHIN_DAYS = 30

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Whether a stored long-lived token should be exchanged for a fresh one
 * before it is used: it is still valid, and has at most `renewWithinDays`
 * left. An expired token cannot be exchanged (Meta refuses it), and a token
 * with no recorded expiry is never renewed.
 */
export const isLongLivedRenewalDue = (
  expiresAt: Readonly<Date> | undefined,
  renewWithinDays: number | undefined,
  now: number = Date.now()
): boolean => {
  if (expiresAt === undefined) return false
  const left = expiresAt.getTime() - now
  return left > 0 && left <= (renewWithinDays ?? DEFAULT_LONG_LIVED_RENEW_WITHIN_DAYS) * DAY_MS
}
