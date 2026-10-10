/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ActionBaseFields } from '../base'
import { InstanceSlugSchema, literalOrWholeTemplate, wholeTemplate } from './instance-slug'

/**
 * The three ways a seed run treats a table, as `sovrium seed --mode` names
 * them. Spelled out here because `src/domain/models/app/` may not import the
 * seed-file models; the two lists are one vocabulary and must stay equal.
 *
 * @public
 */
export const INSTANCE_SEED_MODES = ['if-empty', 'upsert', 'replace'] as const

/** @public */
export type InstanceSeedMode = (typeof INSTANCE_SEED_MODES)[number]

const SEED_MODE_PATTERN = /^(?:if-empty|upsert|replace)$/

/** A calendar day, `YYYY-MM-DD` — what `sovrium seed --today` takes. */
export const INSTANCE_SEED_TODAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/**
 * A table name as the request file carries it: 1 to 63 characters, no control
 * character, no `/` or `\`. Table names may hold capitals, hyphens and spaces;
 * none of it reaches a command line.
 */
export const INSTANCE_SEED_TABLE_PATTERN = /^[^/\\\p{Cc}]{1,63}$/u

const SeedTablesSchema = Schema.Union([
  Schema.Array(
    Schema.String.annotate({ description: 'A table to seed, by name' }).check(
      Schema.isPattern(INSTANCE_SEED_TABLE_PATTERN)
    )
  ).check(Schema.isMinLength(1)),
  wholeTemplate('One whole {{template}} resolving to a list of table names'),
]).annotate({
  description:
    'Restrict the run to these tables, as `sovrium seed --table` does. Absent: every table the release has a seed file for',
})

const SeedDryRunSchema = Schema.Union([
  Schema.Boolean.annotate({ description: 'true: report the plan and write nothing' }),
  wholeTemplate('One whole {{template}} resolving to true or false'),
]).annotate({
  description:
    'Report the plan computed against the app’s own data — which tables would be written, and which would be skipped because they already hold rows — and write nothing. Default false',
})

/**
 * Instance Seed Action (type: instance, operator: seed)
 *
 * Runs `sovrium seed` for a supervised app, as that app, on the seed files of
 * the release it runs — `<SOVRIUM_INSTANCES_DIR>/<slug>/current/seed/`. The
 * rows are written by the engine's own seeder, so a seed is silent exactly as
 * it is on a laptop: no table webhook, no record automation.
 *
 * The app's data belongs to its own system user, so the step does not seed
 * from here. In order, stopping at the first failure:
 *
 * 1. refuses when the current release holds no `seed/` folder, before
 *    anything is written or started;
 * 2. writes the run's options to `<SOVRIUM_INSTANCES_DIR>/<slug>/seed/request.json`;
 * 3. starts the one-shot unit `sovrium-seed@<slug>.service`, which runs
 *    `sovrium seed` as the app with that request and writes
 *    `seed/report.json`;
 * 4. returns that report and deletes both files.
 *
 * A refusal of the seeder — an `upsert` with no merge key, a seed file naming
 * a table the config no longer has — fails the step with the seeder's own
 * message, the one the same command prints on a laptop.
 *
 * A `replace` deletes rows. The step takes no backup itself: an agent that
 * replaces runs `instance/backup` first.
 */
export const InstanceSeedActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('instance').pipe(
    Schema.annotate({
      description: "Constant value 'instance' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('seed').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'instance' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    slug: InstanceSlugSchema,
    mode: Schema.optional(
      literalOrWholeTemplate(
        SEED_MODE_PATTERN,
        "one of 'if-empty', 'upsert' or 'replace'",
        "How each table is treated, as `sovrium seed --mode`: 'if-empty' seeds only tables with no rows, 'upsert' replays on each file's merge key, 'replace' deletes the rows then inserts. Or one whole {{template}} resolving to one. Default 'if-empty'"
      )
    ),
    tables: Schema.optional(SeedTablesSchema),
    today: Schema.optional(
      literalOrWholeTemplate(
        INSTANCE_SEED_TODAY_PATTERN,
        'a calendar day written YYYY-MM-DD',
        'The day every {{today…}} in the seed files resolves against, as `sovrium seed --today`, written YYYY-MM-DD, or one whole {{template}} resolving to one. Absent: the day the run happens'
      )
    ),
    dryRun: Schema.optional(SeedDryRunSchema),
  }).annotate({
    description:
      'The supervised app to seed from its current release’s seed files, and how: mode, tables, the day dates resolve against, and whether to only report the plan.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'InstanceSeedAction',
    title: 'Instance Seed Action',
    description:
      "Load a supervised app's seed data from the release it runs, as the app, and return the per-table report",
  })
)

/** @public */
export type InstanceSeedAction = Schema.Schema.Type<typeof InstanceSeedActionSchema>
