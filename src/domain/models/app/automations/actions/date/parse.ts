/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'
import { isValidTimezone, PatternProp, TimezoneProp } from './props'

/**
 * Date Parse Action (type: date, operator: parse)
 *
 * Read a string back into an instant using a pattern, and report whether it
 * was readable.
 *
 * Output: `{ instant: string | null, valid: boolean }`.
 *
 * ── Why validity is DATA, not a step failure ────────────────────────────────
 *
 * This operator subsumes what would otherwise be a second `isValid` operator.
 * A string that does not match the pattern is a fact about the INPUT, not a
 * misconfiguration, so the step SUCCEEDS with `valid: false` and a null
 * instant. Two things depend on that:
 *
 *  - retry: a failed step is retried per `retry` config. Retrying a
 *    deterministic verdict burns the budget and delays the run for a result
 *    that cannot change.
 *  - control flow: a failed step stops the branch (absent `continueOnError`),
 *    so a downstream `filter`/`path` that wants to route invalid rows never
 *    runs. Returning data keeps the decision where an author can act on it.
 *
 * A malformed PATTERN is the opposite case — an author error, not data — and
 * does fail the step.
 *
 * Note `locale` is absent by design: locale NAME tokens (`MMMM`, `EEEE`) are
 * format-only. `mars` is ambiguous across locales and abbreviation styles, so
 * accepting it on the parse side would be guesswork. See `TOKENS[].parseable`
 * in `domain/kernel/format/date-tokens.ts`.
 */
export const DateParseActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('date').pipe(
    Schema.annotate({
      description: "Constant value 'date' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('parse').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'date' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    /** The string to read. */
    input: TemplateStringSchema.pipe(
      Schema.annotate({
        description:
          'String to parse into an instant, or a template resolving to one ' +
          '(e.g. "{{trigger.data.dueDate}}")',
      })
    ),

    /** Numeric-token pattern describing the input's shape. */
    pattern: PatternProp.pipe(
      Schema.annotate({
        description:
          'Pattern describing the input, using NUMERIC tokens only (yyyy, MM, dd, HH, mm, ss ' +
          'and the legacy aliases YYYY/DD). Locale name tokens are format-only.',
      })
    ),

    /** IANA timezone the parsed wall-clock fields are interpreted in. Default UTC. */
    timezone: Schema.optional(
      TimezoneProp.pipe(
        Schema.annotate({
          description:
            'IANA timezone the wall-clock fields are read in (e.g. "Europe/Paris"). Default "UTC". ' +
            'A pattern without an offset is ambiguous without this.',
        })
      )
    ),
  })
    .annotate({
      description: 'The text to read as a date, the pattern it follows, and the time zone.',
    })
    .pipe(
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
    identifier: 'DateParseAction',
    title: 'Date Parse Action',
    description:
      'Parse a string into an instant, reporting validity as data rather than as a step failure',
  })
)

/** @public */
export type DateParseAction = Schema.Schema.Type<typeof DateParseActionSchema>
