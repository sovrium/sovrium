/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The seed passwords an app's password policy refuses, judged before a run
 * writes anything.
 *
 * The auth engine refuses such a password too, but only while writing the
 * account — after a reset has already emptied the app. Judged up front, a
 * password the app would refuse stops the run while nothing has been touched.
 */

/** The length bounds an app holds its passwords to. */
export interface SeedPasswordBounds {
  readonly minLength: number
  readonly maxLength: number
}

/** One password a run would set, and the account it is for. */
export interface SeedPasswordEntry {
  readonly email: string
  readonly password: string
}

/**
 * One refusal per password outside the bounds, naming the account, in the
 * order given; empty when every password is accepted.
 */
export const seedPasswordRefusals = (
  entries: readonly SeedPasswordEntry[],
  bounds: SeedPasswordBounds
): readonly string[] =>
  entries
    .filter(
      (entry) =>
        entry.password.length < bounds.minLength || entry.password.length > bounds.maxLength
    )
    .map(
      (entry) =>
        `accounts: "${entry.email}" has a password this app refuses: it must be ` +
        `${String(bounds.minLength)} to ${String(bounds.maxLength)} characters long.`
    )
