/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The two Zap step settings the import reads as structure rather than as
 * inputs: a Filter's or a Path's criteria, and a Schedule trigger's timing.
 *
 * ## Criteria
 *
 * `filter_criteria` is a list of `{ key, match, value, action, group }`. Rules
 * sharing a `group` must all hold; any one group holding is enough. A Sovrium
 * condition has one combinator, so one group becomes an `and`, groups of one
 * rule each become an `or`, and anything else is kept as a rule no operator
 * maps, which the mapper reports. A rule whose `action` is `stop` stops the
 * Zap when it matches, so its operator is looked up as `stop:<match>`.
 *
 * ## Schedule
 *
 * A Schedule trigger becomes cron only when the export states every setting
 * the cron needs (its time of day, its weekday or its day of month). A
 * trigger whose `trigger_on_weekends` is `no` fires on weekdays only.
 */

import { isRecord } from '@/domain/kernel/config-parsing/plain-object'
import { tokeniseZapierValue, type ZapierScope } from './zapier-expression-service'
import type { CanonicalCondition } from './canonical-flow'

type Json = Readonly<Record<string, unknown>>
type Rule = CanonicalCondition['rules'][number]

/** A criterion's field: a bare `1__plan` is the curly `{{1__plan}}`. */
const leftOf = (key: string, scope: ZapierScope): unknown =>
  tokeniseZapierValue(key.includes('{{') ? key : `{{${key}}}`, scope)

const ruleOf = (criterion: Json, scope: ZapierScope): Rule => {
  const { key, match, value, action } = criterion
  const operator = `${action === 'stop' ? 'stop:' : ''}${typeof match === 'string' ? match : ''}`
  return {
    left: typeof key === 'string' ? leftOf(key, scope) : key,
    operator,
    ...(value === undefined ? {} : { right: tokeniseZapierValue(value, scope) }),
  }
}

/** The criteria as one condition, or `undefined` when the export holds none. */
export const conditionOfCriteria = (
  criteria: unknown,
  scope: ZapierScope
): CanonicalCondition | undefined => {
  if (!Array.isArray(criteria)) return undefined
  const read = criteria.filter(isRecord)
  if (read.length === 0) return undefined
  const groups = [...new Set(read.map((criterion) => String(criterion['group'] ?? 1)))]
  const rules = read.map((criterion) => ruleOf(criterion, scope))
  if (groups.length === 1) return { combinator: 'and', rules }
  if (groups.length === read.length) return { combinator: 'or', rules }
  return {
    combinator: 'and',
    rules: [{ left: JSON.stringify(criteria), operator: 'and-groups joined by or' }],
  }
}

/** A clock time read from its parts, or `undefined` when it is not one. */
const clockOf = (
  hours: number,
  minute: number,
  meridiem: string | undefined
): { readonly hour: number; readonly minute: number } | undefined => {
  if (meridiem === undefined)
    return hours <= 23 && minute <= 59 ? { hour: hours, minute } : undefined
  if (hours < 1 || hours > 12 || minute > 59) return undefined
  return { hour: (hours % 12) + (meridiem === 'pm' ? 12 : 0), minute }
}

/** `09:00`, `9am`, `9:30 pm`, `17` → hour and minute. */
const timeOf = (value: unknown): { readonly hour: number; readonly minute: number } | undefined => {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined
  const match = /^\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*$/i.exec(String(value))
  return match === null
    ? undefined
    : clockOf(Number(match[1]), Number(match[2] ?? 0), match[3]?.toLowerCase())
}

const WEEKDAYS: readonly string[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
]

/** A weekday name, or a number from 0 (Sunday) to 6, as the cron day-of-week. */
const weekdayOf = (value: unknown): number | undefined => {
  if (typeof value === 'number')
    return Number.isInteger(value) && value >= 0 && value <= 6 ? value : undefined
  if (typeof value !== 'string') return undefined
  const index = WEEKDAYS.findIndex((day) => day.startsWith(value.trim().toLowerCase().slice(0, 3)))
  return value.trim().length >= 3 && index >= 0 ? index : undefined
}

const dayOfMonthOf = (value: unknown): number | undefined => {
  const day = Number(value)
  return Number.isInteger(day) && day >= 1 && day <= 31 ? day : undefined
}

const weekdaysOnly = (params: Json): string =>
  params['trigger_on_weekends'] === 'no' || params['trigger_on_weekends'] === false ? '1-5' : '*'

/** Each schedule action, and the cron it is, from its settings. */
const SCHEDULES: Readonly<Record<string, (params: Json) => string | undefined>> = {
  everyHour: (params) => `0 * * * ${weekdaysOnly(params)}`,
  everyDay: (params) => {
    const time = timeOf(params['time_of_day'])
    return time === undefined
      ? undefined
      : `${String(time.minute)} ${String(time.hour)} * * ${weekdaysOnly(params)}`
  },
  everyWeek: (params) => {
    const time = timeOf(params['time_of_day'])
    const day = weekdayOf(params['day_of_week'])
    return time === undefined || day === undefined
      ? undefined
      : `${String(time.minute)} ${String(time.hour)} * * ${String(day)}`
  },
  everyMonth: (params) => {
    const time = timeOf(params['time_of_day'])
    const day = dayOfMonthOf(params['day_of_month'])
    return time === undefined || day === undefined
      ? undefined
      : `${String(time.minute)} ${String(time.hour)} ${String(day)} * *`
  },
}

/** The legacy Schedule app's action names, as the current ones. */
const LEGACY_SCHEDULES: Readonly<Record<string, string>> = {
  schedule_hourly: 'everyHour',
  schedule_daily: 'everyDay',
  schedule_weekly: 'everyWeek',
  schedule_monthly: 'everyMonth',
}

/** A Schedule trigger as cron, or `undefined` when the export lacks a setting it needs. */
export const cronOfSchedule = (action: string, params: Json | undefined): string | undefined => {
  if (params === undefined) return undefined
  const schedule = SCHEDULES[LEGACY_SCHEDULES[action] ?? action]
  return schedule?.(params)
}
