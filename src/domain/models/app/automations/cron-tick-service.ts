/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * One run per tick, whatever the number of schedules.
 *
 * An automation with several cron triggers arms one job per entry. When two of
 * its schedules fall due at the same tick — the minute for a five-field
 * expression, the second for a six-field one — the automation still runs once,
 * named after the FIRST of those entries in its `triggers` list. Each job
 * decides alone, without coordination: the entry fires unless an entry
 * declared before it is due at the same instant.
 */

import { Cron, Result } from 'effect'

/** One cron entry's schedule, its timezone already resolved. */
export interface CronEntrySchedule {
  readonly expression: string
  readonly timezone: string
}

/**
 * The tick a job woke for: the wake-up instant rounded to the nearest second.
 * A timer fires a few milliseconds off the instant it was set for, either side.
 */
export const tickOf = (wokenAt: Readonly<Date>): Readonly<Date> =>
  new Date(Math.round(wokenAt.getTime() / 1000) * 1000)

/** Whether a schedule falls due at the instant; an expression that no longer parses never does. */
const isDueAt = (entry: CronEntrySchedule, tick: Readonly<Date>): boolean => {
  const parsed = Cron.parse(entry.expression, entry.timezone)
  return Result.isSuccess(parsed) && Cron.match(parsed.success, tick)
}

/**
 * Whether the entry at `index` yields its tick to an entry declared before it
 * that falls due at the same instant — that earlier entry starts the one run.
 */
export const yieldsTickToEarlierEntry = (
  entries: ReadonlyArray<CronEntrySchedule>,
  index: number,
  tick: Readonly<Date>
): boolean => entries.slice(0, index).some((entry) => isDueAt(entry, tick))
