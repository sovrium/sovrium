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
 * A `gte(created_at, oneYearAgo)` predicate on the READ path alone hides expired
 * rows from the record-history API; it does not remove them. Personal data —
 * the `changes` JSONB carries before/after record field values — would then be
 * retained forever while the product tells users it is deleted: a promise with
 * no executor.
 *
 * The cutoff lives here, in one pure function, so the filter that HIDES and the
 * sweep that DELETES cannot drift apart. Two windows would be worse than one
 * wrong window: a delete that ran ahead of the filter would silently shorten
 * visible history, and a filter that ran ahead of the delete would recreate
 * exactly the gap this closes — data present, and invisible to the only query
 * that would have revealed it.
 */

import { zonedStartOfDayYearsBefore } from '@/domain/kernel/time/zoned-calendar'

/**
 * Start of the retention window: midnight, one CALENDAR year before `now`'s
 * calendar day, both read on the wall clock of `timeZone`.
 *
 * A calendar year, not 365 days, because that is what the read filter computes.
 * The zone is a parameter — the operator timezone at every caller — rather than
 * the process zone a bare `new Date(y - 1, m, d)` would silently use: that
 * follows the host's POSIX `TZ`, which is not the operator's choice.
 *
 * On 29 February the counterpart day does not exist; the boundary is then
 * 28 February of the previous year (Effect's `DateTime` clamps to the end of
 * the month), one day earlier than a `Date` overflow to 1 March would give.
 *
 * @param now - the reference instant (injected, so the function stays pure).
 * @param timeZone - an IANA zone identifier: the operator timezone.
 * @returns the earliest `created_at` an activity-log row may have and be kept.
 */
export const activityLogRetentionCutoff = (now: Readonly<Date>, timeZone: string) =>
  zonedStartOfDayYearsBefore(now, timeZone, 1)
