/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { optionalField } from '@/domain/models/api/combinators/optional-field'
import { APP_SEED_MODES } from '@/domain/models/app/automations/actions/app/seed'

/**
 * The output of an `app/seed` step: the seeder's report on the app's own data,
 * readable by the next steps as `{{steps.<name>.tables}}` and the rest.
 *
 * It says what `sovrium seed` says on a laptop, per table, plus what only a
 * `reset` does: the tables it emptied for want of a seed file, and the
 * accounts, sessions and files it removed. A trigger declaring
 * `history: minimal` keeps none of it once the run ends.
 */

const countSchema = (description: string) =>
  Schema.Number.annotate({ description }).check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0))

/**
 * What the step did to one table, or — in a dry run — would do.
 *
 * - `seeded`: rows were written; `created` and `updated` count them.
 * - `skipped`: `if-empty` left the table alone because it holds `present` rows.
 * - `emptied`: `reset` deleted the rows of a table that has no seed file, and
 *   wrote none.
 *
 * @public
 */
export const appSeedTableResultSchema = Schema.Struct({
  table: Schema.String.annotate({ description: 'The table, by name' }).check(Schema.isMinLength(1)),
  outcome: Schema.Literals(['seeded', 'skipped', 'emptied']).annotate({
    description:
      "'seeded': rows were (or, in a dry run, would be) written; 'skipped': if-empty left the table alone because it holds rows; 'emptied': reset deleted the rows of a table with no seed file",
  }),
  created: countSchema('Rows inserted (in a dry run: rows the run would write)'),
  updated: countSchema('Rows an upsert matched and updated; 0 in every other mode'),
  deleted: optionalField(
    countSchema(
      'Rows deleted before seeding, under replace and reset (in a dry run: rows it would delete)'
    )
  ),
  present: optionalField(countSchema('Rows the table already held, for a table if-empty skipped')),
})

/** @public */
export type AppSeedTableResult = Schema.Schema.Type<typeof appSeedTableResultSchema>

/**
 * What a `reset` removed besides table rows.
 *
 * @public
 */
export const appSeedRemovedSchema = Schema.Struct({
  accounts: countSchema('Accounts removed because seed/users.yaml does not list them'),
  sessions: countSchema('Sessions removed: every session the app held'),
  files: countSchema('Locally stored uploads removed because no seeded row references them'),
})

/** @public */
export type AppSeedRemoved = Schema.Schema.Type<typeof appSeedRemovedSchema>

/**
 * The step's output.
 *
 * @public
 */
export const appSeedReportSchema = Schema.Struct({
  mode: Schema.Literals(APP_SEED_MODES).annotate({ description: 'The mode the step ran in' }),
  dryRun: Schema.Boolean.annotate({ description: 'true when nothing was written' }),
  tables: Schema.Array(appSeedTableResultSchema).annotate({
    description:
      'One entry per table the step targeted, in the order they were written; under reset, every table of the app',
  }),
  removed: optionalField(
    appSeedRemovedSchema.annotate({
      description: 'What reset removed besides table rows; absent in every other mode',
    })
  ),
  lines: Schema.Array(Schema.String.annotate({ description: 'One line of the report' })).annotate({
    description:
      'The report as `sovrium seed` prints it, one entry per line — accounts first, then one line per table',
  }),
})

/** @public */
export type AppSeedReport = Schema.Schema.Type<typeof appSeedReportSchema>
