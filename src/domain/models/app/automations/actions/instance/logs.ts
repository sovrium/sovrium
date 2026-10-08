/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ActionBaseFields } from '../base'
import { InstanceSlugSchema, literalOrWholeTemplate } from './instance-slug'

/** An ISO 8601 date, or date and time to the second, journalctl reads as local time. */
export const INSTANCE_LOGS_SINCE_PATTERN = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2})?)?$/

/**
 * Instance Logs Action (type: instance, operator: logs)
 *
 * Returns the last lines `sovrium-app@<slug>.service` wrote to the journal, read
 * with `journalctl -u sovrium-app@<slug>.service --no-pager -n <lines>` (plus
 * `--since=<since>` when given). Both values are checked before they reach the
 * command line.
 */
export const InstanceLogsActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('instance').pipe(
    Schema.annotate({
      description: "Constant value 'instance' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('logs').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'instance' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    slug: InstanceSlugSchema,
    lines: Schema.optional(
      Schema.Number.pipe(
        Schema.annotate({
          description: 'How many of the most recent lines to return, from 1 to 1000. Default 100',
        }),
        Schema.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 1000 }))
      )
    ),
    since: Schema.optional(
      literalOrWholeTemplate(
        INSTANCE_LOGS_SINCE_PATTERN,
        'an ISO 8601 date (2026-10-08) or date and time (2026-10-08T09:30:00)',
        'Only lines written at or after this moment: an ISO 8601 date (2026-10-08) or date and time (2026-10-08T09:30:00) in the host time zone, or one whole {{template}} resolving to one'
      )
    ),
  }).annotate({
    description: 'The supervised app whose journal is read, how many lines, and from when.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'InstanceLogsAction',
    title: 'Instance Logs Action',
    description: 'Read the last journal lines of a supervised app',
  })
)

/** @public */
export type InstanceLogsAction = Schema.Schema.Type<typeof InstanceLogsActionSchema>
