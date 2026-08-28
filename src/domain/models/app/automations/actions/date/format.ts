/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'
import { isValidTimezone, LocaleProp, PatternProp, TimezoneProp } from './props'

/**
 * Date Format Action (type: date, operator: format)
 *
 * Render an instant as a string in a given timezone and locale.
 *
 * This is the operator that closes the timezone gap. Nothing in the codebase
 * could render a date in anything but UTC before it: the Handlebars date
 * helpers run six sequential global string replaces over the pattern and always
 * format in UTC, so `MMMM` renders `0303` for March and lowercase `yyyy` passes
 * through literally. `formatWithTokens` replaces that with a real single-pass
 * tokenizer over a closed vocabulary.
 *
 * Output: `{ formatted: string }`.
 *
 * `toTimezone` deliberately does not exist as a sibling operator. An instant
 * carries no zone, so "convert this instant to Paris" names a model that is not
 * true — the zone belongs to the RENDERING, which is exactly this operator's
 * `timezone` prop.
 */
export const DateFormatActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('date'),
  operator: Schema.Literal('format'),
  props: Schema.Struct({
    /** The instant to render. */
    input: TemplateStringSchema.pipe(
      Schema.annotate({
        description:
          'Instant to format: an ISO 8601 string or a template resolving to one ' +
          '(e.g. "{{trigger.record.createdAt}}")',
      })
    ),

    /** Format pattern over the closed token set. */
    pattern: PatternProp,

    /** IANA timezone the instant is rendered in. Default UTC. */
    timezone: Schema.optional(TimezoneProp),

    /** BCP 47 locale for month/weekday names. Default en-US. */
    locale: Schema.optional(LocaleProp),
  }).pipe(
    Schema.check(
      Schema.makeFilter(({ timezone }) =>
        timezone !== undefined && !isValidTimezone(timezone)
          ? `Invalid IANA timezone: ${timezone}`
          : undefined
      )
    )
  ),
}).pipe(
  Schema.annotate({
    identifier: 'DateFormatAction',
    title: 'Date Format Action',
    description: 'Render an instant as a string in a given timezone and locale',
  })
)

/** @public */
export type DateFormatAction = Schema.Schema.Type<typeof DateFormatActionSchema>
