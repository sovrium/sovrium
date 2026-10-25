/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ActionBaseFields } from '../base'
import { InstanceSlugSchema } from './instance-slug'

/**
 * Instance Usage Action (type: instance, operator: usage)
 *
 * Answers how many bytes a supervised app holds: its database and its stored
 * files. The supervised app runs as its own system user, whose data this
 * process cannot read, so the measure is taken as the app: the step starts the
 * one-shot unit `sovrium-usage@<slug>.service`, which runs `sovrium usage
 * --report <SOVRIUM_INSTANCES_DIR>/<slug>/usage/report.json`; the step answers
 * that report and deletes it. A report an earlier run left behind is removed
 * before the unit starts, so a stale figure is never answered.
 *
 * Separate from `status` on purpose: `status` is one cheap read a reconcile
 * loop takes every tick, while sizing runs a unit and reads a database.
 */
export const InstanceUsageActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('instance').pipe(
    Schema.annotate({
      description: "Constant value 'instance' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('usage').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'instance' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    slug: InstanceSlugSchema,
  }).annotate({
    description: 'The supervised app the step measures.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'InstanceUsageAction',
    title: 'Instance Usage Action',
    description:
      "Measure how many bytes a supervised app's database and stored files hold, as the app, through its one-shot usage unit",
  })
)

/** @public */
export type InstanceUsageAction = Schema.Schema.Type<typeof InstanceUsageActionSchema>

/** A figure that could not be measured, and why — the reason carries no credential. */
export const UsageUnmeasuredSchema = Schema.Struct({
  figure: Schema.Literals(['databaseBytes', 'filesBytes']),
  reason: Schema.String,
})

/**
 * What `sovrium usage` reports, and what `instance/usage` answers: bytes only,
 * never a path, a URL or a credential. A figure that could not be measured is
 * `null`, never `0`, and is listed in `unmeasured`.
 */
export const UsageReportSchema = Schema.Struct({
  database: Schema.Literals(['sqlite', 'postgresql']),
  databaseBytes: Schema.NullOr(Schema.Finite),
  storage: Schema.Literals(['local', 's3', 'database']),
  filesBytes: Schema.NullOr(Schema.Finite),
  measuredAt: Schema.String,
  unmeasured: Schema.Array(UsageUnmeasuredSchema),
})

export type UsageReport = Schema.Schema.Type<typeof UsageReportSchema>
