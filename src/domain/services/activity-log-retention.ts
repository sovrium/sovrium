/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The activity-log retention window (pure domain).
 *
 * `system.activity_logs` is documented as "Retention: 1 year (compliance
 * requirement)" on its own schema, and the published privacy policy promises
 * the audit log is retained one year and then DELETED.
 *
 * What existed was a `gte(created_at, oneYearAgo)` predicate on the READ path.
 * That hides expired rows from the record-history API; it does not remove them.
 * Personal data — the `changes` JSONB carries before/after record field values —
 * was therefore retained forever while the product told users it was deleted.
 * The same no-op shape as the deleted `ECO_RETENTION_PURGE_DAYS`: a promise with
 * no executor.
 *
 * The cutoff lives here, in one pure function, so the filter that HIDES and the
 * sweep that DELETES cannot drift apart. Two windows would be worse than one
 * wrong window: a delete that ran ahead of the filter would silently shorten
 * visible history, and a filter that ran ahead of the delete would recreate
 * exactly the gap this closes — data present, and invisible to the only query
 * that would have revealed it.
 */

/**
 * Start of the retention window: one CALENDAR year before `now`.
 *
 * A calendar year, not 365 days, because that is what the read filter has always
 * computed and this function replaces it verbatim. Changing the arithmetic here
 * would move the boundary of already-shipped record-history responses, which is
 * a product decision, not a side effect of adding the missing executor.
 *
 * The parameter is `Readonly<Date>` and the return type is left to INFERENCE,
 * both to satisfy `functional/prefer-immutable-types` against an inherently
 * mutable `Date` — the same accommodation `toOptionalDate` in
 * `account-repository-live.ts` already makes.
 *
 * @param now - the reference instant (injected, so the function stays pure).
 * @returns the earliest `created_at` an activity-log row may have and be kept.
 */
export const activityLogRetentionCutoff = (now: Readonly<Date>) =>
  new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
