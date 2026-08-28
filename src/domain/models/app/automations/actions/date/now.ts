/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ActionBaseFields } from '../base'
import { isValidTimezone, LocaleProp, PatternProp, TimezoneProp } from './props'

/**
 * Date Now Action (type: date, operator: now)
 *
 * Capture the current instant.
 *
 * Output: `{ instant: string }` (ISO 8601, UTC) plus `{ formatted: string }`
 * when `pattern` is given.
 *
 * ── Why this is its own operator ────────────────────────────────────────────
 *
 * `now` is the ONLY non-deterministic operator in the `date` type. Isolating it
 * is what keeps the other seven pure: given the same props they return the same
 * answer forever, so they are trivially testable and a run is reproducible from
 * its recorded inputs. Folding "current time" into `format` — by making its
 * `input` optional — would smear that non-determinism across the whole type and
 * make `format` untestable without freezing a clock.
 *
 * ── Why it nevertheless takes `pattern` ─────────────────────────────────────
 *
 * "Stamp this run with the local time" is the dominant use, and forcing it
 * through two steps (`now` then `format`) is noise in every automation that
 * needs it. The optional `pattern` is not a second formatting surface — it is
 * the same `formatWithTokens` call, reached without an intermediate step. The
 * redundancy the operator budget guards against is extra OPERATORS, not
 * optional props on one.
 *
 * Omit `pattern` and the output is an ISO 8601 instant suitable for feeding
 * `add`, `diff` or a record field.
 */
export const DateNowActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('date'),
  operator: Schema.Literal('now'),
  props: Schema.Struct({
    /** Optional pattern. Omitted, the output is an ISO 8601 instant. */
    pattern: Schema.optional(
      PatternProp.pipe(
        Schema.annotate({
          description:
            'Optional format pattern over the closed token set. Omit for an ISO 8601 instant.',
        })
      )
    ),

    /** IANA timezone the current instant is rendered in. Default UTC. */
    timezone: Schema.optional(
      TimezoneProp.pipe(
        Schema.annotate({
          description:
            'IANA timezone the current instant is rendered in (e.g. "Europe/Paris"). Default ' +
            '"UTC". Only affects `formatted`; `instant` is always UTC.',
        })
      )
    ),

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
    identifier: 'DateNowAction',
    title: 'Date Now Action',
    description: 'Capture the current instant, optionally rendered in a timezone and locale',
  })
)

/** @public */
export type DateNowAction = Schema.Schema.Type<typeof DateNowActionSchema>
