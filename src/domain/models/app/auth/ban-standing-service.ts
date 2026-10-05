/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Whether an account's ban still holds at `now`.
 *
 * `banned` is nullable: anything but `true` means the account was never
 * banned, or was unbanned. A ban with an end date (`banExpires`) that has
 * passed no longer holds — Better Auth lifts it the same way at sign-in — so
 * every gate that refuses a banned person reads this one rule. A ban without
 * an end date, or with one that cannot be read as a date, holds.
 */
export const isBanInForce = (
  banned: unknown,
  banExpires: unknown,
  now: number = Date.now()
): boolean => {
  if (banned !== true) return false
  if (banExpires === null || banExpires === undefined) return true
  const ends =
    banExpires instanceof Date
      ? banExpires.getTime()
      : typeof banExpires === 'string' || typeof banExpires === 'number'
        ? new Date(banExpires).getTime()
        : Number.NaN
  return Number.isNaN(ends) || ends > now
}
