/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `calendar` — a month of days to pick one date, a range, or several, inline
 * on the page. shadcn/ui's Calendar, under its own name, on react-day-picker.
 *
 * ## The event view is `event-calendar`
 *
 * The view that places records on a month, week or day grid is
 * `event-calendar`. Each of its keys is refused on this type with a sentence
 * naming it (`repurposed-removed-keys.ts`).
 *
 * ## Dates are ISO text
 *
 * Every date the config writes and every date the calendar submits is ISO
 * text (year, month, day); a range is two dates joined by a slash, several dates
 * are joined by commas. The shape of `defaultValue` follows `mode` — one date,
 * a `{ from, to }` range, or a list — and a mismatch is refused at validation
 * (`day-calendar-validation.ts`).
 *
 * Source: [internal ref]
 */

import { Schema } from 'effect'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { visibilityFields } from '../modules/visibility'

export const DayCalendarTypeLiteral = Schema.Literal('calendar')

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** One calendar day as ISO text. */
export const IsoDateSchema = Schema.String.annotate({
  title: 'ISO Date',
  description: 'A calendar day as ISO text, for example 2026-10-14.',
}).pipe(
  Schema.check(
    Schema.isPattern(ISO_DATE, { message: 'A date is ISO text, for example 2026-10-14.' })
  )
)

const weekday = Schema.Finite.annotate({
  description: 'A weekday: 0 is Sunday, 1 is Monday, … 6 is Saturday.',
}).pipe(Schema.check(Schema.isInt()), Schema.check(Schema.isBetween({ minimum: 0, maximum: 6 })))

export const dayCalendarFields = {
  ...coreFields,
  ...visibilityFields,
  ...i18nFields,
  mode: Schema.optional(
    Schema.Literals(['single', 'range', 'multiple']).annotate({
      title: 'Mode',
      defaultNote: 'single',
      description:
        "What a reader picks: 'single' (one date), 'range' (a start and an end) or 'multiple' (several dates, each press toggling one). shadcn/ui's Calendar mode.",
    })
  ),
  defaultValue: Schema.optional(
    Schema.Union([
      IsoDateSchema,
      Schema.Struct({ from: IsoDateSchema, to: Schema.optional(IsoDateSchema) }),
      Schema.Array(IsoDateSchema),
    ]).annotate({
      title: 'Default Value',
      description:
        "The selection the calendar opens with, shaped by `mode`: one ISO date ('single'), `{ from, to }` ('range') or a list of dates ('multiple'). It also decides the month shown first.",
      examples: ['2026-10-14', { from: '2026-10-19', to: '2026-10-23' }],
    })
  ),
  minDate: Schema.optional(
    IsoDateSchema.annotate({
      description:
        "The first day that can be picked. react-day-picker's startMonth/disabled before.",
    })
  ),
  maxDate: Schema.optional(
    IsoDateSchema.annotate({
      description: "The last day that can be picked. react-day-picker's endMonth/disabled after.",
    })
  ),
  disabled: Schema.optional(
    Schema.Struct({
      before: Schema.optional(IsoDateSchema),
      after: Schema.optional(IsoDateSchema),
      daysOfWeek: Schema.optional(
        Schema.Array(weekday).annotate({
          description: 'The weekdays that cannot be picked: 0 is Sunday, 6 is Saturday.',
        })
      ),
      dates: Schema.optional(
        Schema.Array(IsoDateSchema).annotate({
          description: 'The single days that cannot be picked, as ISO dates.',
        })
      ),
    }).annotate({
      title: 'Disabled Days',
      description:
        'Days that cannot be picked: those `before` or `after` a date, the weekdays in `daysOfWeek` (0 is Sunday), and the listed `dates`.',
    })
  ),
  months: Schema.optional(
    Schema.Finite.annotate({
      title: 'Months',
      defaultNote: '1',
      description:
        "How many consecutive months are drawn side by side, 1 to 3. react-day-picker's numberOfMonths.",
    }).pipe(
      Schema.check(Schema.isInt()),
      Schema.check(Schema.isBetween({ minimum: 1, maximum: 3 }))
    )
  ),
  captionLayout: Schema.optional(
    Schema.Literals(['label', 'dropdown']).annotate({
      title: 'Caption Layout',
      defaultNote: 'label',
      description: "'label' prints the month and year; 'dropdown' lets the reader pick them.",
    })
  ),
  weekStartsOn: Schema.optional(
    weekday.annotate({
      title: 'Week Starts On',
      description:
        'The first column: 0 is Sunday, 1 is Monday. Without it, the page language decides (Monday in French, Sunday in American English).',
    })
  ),
  name: Schema.optional(
    Schema.String.annotate({
      title: 'Name',
      description:
        'The field name the selection is submitted under, as ISO text, when the calendar sits in a form.',
      examples: ['delivery_date'],
    }).pipe(Schema.check(Schema.isMinLength(1)))
  ),
} as const
