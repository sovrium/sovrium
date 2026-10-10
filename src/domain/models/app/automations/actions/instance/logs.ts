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
 * The units of a supervised app whose journal `logs` may read, each naming one
 * fixed unit `sovrium-<unit>@<slug>.service`. A word, never a unit name: the
 * host lets the engine read the `sovrium-*@` units only, and a free name would
 * reach any unit on the machine.
 *
 * @public
 */
export const INSTANCE_LOG_UNITS = ['app', 'seed', 'backup', 'restore', 'proxy'] as const

/** @public */
export type InstanceLogUnit = (typeof INSTANCE_LOG_UNITS)[number]

/**
 * Instance Logs Action (type: instance, operator: logs)
 *
 * Returns the last lines one unit of a supervised app wrote to the journal —
 * the app itself unless `unit` names another — read with
 * `journalctl -u sovrium-<unit>@<slug>.service --no-pager -n <lines>` (plus
 * `--since=<since>` when given). Every value is checked before it reaches the
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
    unit: Schema.optional(
      Schema.Literals(INSTANCE_LOG_UNITS).annotate({
        description:
          'Which unit of the app to read: app (the app itself), seed, backup or restore (the one-shot runs of those steps), or proxy (the idle-exit proxy in front of the app). Default app',
      })
    ),
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
    description:
      'The supervised app and which of its units is read, how many lines, and from when.',
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
