/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { DateAddActionSchema } from './add'
import { DateDiffActionSchema } from './diff'
import { DateEndOfActionSchema } from './end-of'
import { DateFormatActionSchema } from './format'
import { DateNowActionSchema } from './now'
import { DateParseActionSchema } from './parse'
import { DateStartOfActionSchema } from './start-of'
import { DateSubtractActionSchema } from './subtract'

/**
 * Date Action — union of all timezone- and locale-aware date operators.
 *
 * Eight operators, chosen against a capability domain rather than against a
 * date library's API surface. What is deliberately ABSENT is as load-bearing
 * as what is present, and each omission is recorded on the operator that
 * subsumes it so it is not re-proposed:
 *
 *  - `isBefore` / `isAfter` / `isBetween` → belong in `filter`/`continue` and
 *    `ConditionGroupSchema`; `diff` already returns a signed answer (see
 *    `diff.ts`).
 *  - `toTimezone` → an instant carries no zone, so the name teaches a wrong
 *    model; subsumed by `format`'s `timezone` (see `format.ts`).
 *  - `dayOfWeek` / `isWeekday` / `isWeekend` → `format` with `EEEE` plus a
 *    filter. Three operators for one token is exactly the per-library sprawl
 *    this type exists to avoid.
 *  - `timestamp` / `fromTimestamp` → epoch tokens (`x`, `X`) are a token-set
 *    question, not an operator question.
 *  - business-day and holiday arithmetic → needs a calendar the platform does
 *    not have; a wrong answer here is worse than no answer.
 */
export const DateActionSchema = Schema.Union([
  DateFormatActionSchema,
  DateParseActionSchema,
  DateAddActionSchema,
  DateSubtractActionSchema,
  DateDiffActionSchema,
  DateStartOfActionSchema,
  DateEndOfActionSchema,
  DateNowActionSchema,
]).pipe(
  Schema.annotate({
    identifier: 'DateAction',
    title: 'Date Action',
    description: 'Timezone- and locale-aware date formatting, parsing, arithmetic and boundaries',
  })
)

/** @public */
export type DateAction = Schema.Schema.Type<typeof DateActionSchema>

export * from './add'
export * from './diff'
export * from './end-of'
export * from './format'
export * from './now'
export * from './parse'
export * from './props'
export * from './start-of'
export * from './subtract'
