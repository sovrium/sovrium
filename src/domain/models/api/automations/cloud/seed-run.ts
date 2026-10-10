/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { optionalField } from '@/domain/models/api/combinators/optional-field'
import {
  INSTANCE_SEED_MODES,
  INSTANCE_SEED_TABLE_PATTERN,
  INSTANCE_SEED_TODAY_PATTERN,
} from '@/domain/models/app/automations/actions/instance/seed'
import { deployRequestSchema } from '../automations'

/**
 * Seeding a hosted app from the terminal: `sovrium seed --app <slug>`, and
 * `sovrium deploy --seed` once a deployment is live.
 *
 * Like the deploy contract, no route of the engine serves it: the cloud is an
 * ordinary Sovrium app. The rows are never sent over HTTP. The seed data is
 * the `seed/` folder of the bundle the app runs, and the machine that hosts the
 * app loads it with the engine's own seeder, so a remote seed is as silent as a
 * local one — no table webhook, no record automation.
 *
 * 1. The CLI posts {@link seedRunRequestSchema} to the cloud's `seed` webhook
 *    (`POST /api/automations/seed/webhook`, `auth: { type: session }`, the
 *    stored key as `x-api-key`). The cloud answers `201`
 *    {@link seedRunResponseSchema}, or refuses with
 *    {@link seedRunRefusalSchema}: `404 unknown-app` (not one of the caller's
 *    apps — the anti-enumeration answer), `409 no-live-deployment`, `422
 *    no-seed` (the live bundle holds no `seed/`), `422 confirmation-required`
 *    (a `replace` whose `confirm` is not the app's address), or `422
 *    invalid-seed-request`.
 * 2. The cloud records a `queued` seed run. The machine hosting the app picks
 *    it up as it picks up a deployment, marks it `running`, takes a backup
 *    first when the mode is `replace`, runs `instance/seed` on the live
 *    release, and records `done` with the report, or `failed` with the reason.
 * 3. The CLI reads the run with `GET /api/tables/seed_runs/records/:id` every
 *    2 seconds; its `fields` carry {@link seedRunRecordFieldsSchema}.
 */

/**
 * The seeder's modes, as the request carries them.
 *
 * @public
 */
export const seedRunModeSchema = Schema.Literals(INSTANCE_SEED_MODES).annotate({
  description:
    "'if-empty': seed only tables that have no rows; 'upsert': replay on each seed file's merge key; 'replace': take a backup, delete the rows, then insert",
})

/**
 * Body of the seed webhook call.
 *
 * `confirm` is required for `replace`, and must be the app's address: the
 * cloud refuses a destructive run that does not name what it destroys, even
 * from a client that skipped its own prompt.
 *
 * @public
 */
export const seedRunRequestSchema = Schema.Struct({
  app: deployRequestSchema.fields.app,
  mode: seedRunModeSchema,
  tables: optionalField(
    Schema.Array(
      Schema.String.annotate({ description: 'A table to seed, by name' }).check(
        Schema.isPattern(INSTANCE_SEED_TABLE_PATTERN)
      )
    )
      .annotate({
        description:
          'Restrict the run to these tables (the CLI’s --table, repeatable). Absent: every table the live bundle has a seed file for',
      })
      .check(Schema.isMinLength(1))
  ),
  today: optionalField(
    Schema.String.annotate({
      description:
        'The day every {{today…}} in the seed files resolves against (the CLI’s --today), YYYY-MM-DD. Absent: the day the run happens on the host',
    }).check(Schema.isPattern(INSTANCE_SEED_TODAY_PATTERN))
  ),
  dryRun: optionalField(
    Schema.Boolean.annotate({
      description:
        'true: compute the plan against the app’s own data and write nothing. The report then says which tables would be written and which would be skipped because they already hold rows',
    })
  ),
  confirm: optionalField(
    Schema.String.annotate({
      description:
        "The app's address, typed back. Required when mode is 'replace' (the CLI’s --confirm <slug>, or what was typed at its prompt); ignored otherwise",
    })
  ),
})

/** @public */
export type SeedRunRequest = Schema.Schema.Type<typeof seedRunRequestSchema>

/**
 * Where a seed run stands: `queued` (recorded, not started), `running` (the
 * host is seeding — or taking the backup a `replace` starts with), `done`
 * (see `report`), or `failed` (see `error`).
 *
 * @public
 */
export const seedRunStatusValues = ['queued', 'running', 'done', 'failed'] as const

/** @public */
export const seedRunStatusSchema = Schema.Literals(seedRunStatusValues).annotate({
  description:
    "Where the seed run stands: 'queued' (recorded, not started), 'running' (the host is seeding, or taking the backup a replace starts with), 'done' (see report) or 'failed' (see error)",
})

/** @public */
export type SeedRunStatus = Schema.Schema.Type<typeof seedRunStatusSchema>

/**
 * The seed webhook's `201` answer.
 *
 * @public
 */
export const seedRunResponseSchema = Schema.Struct({
  seedRunId: Schema.String.annotate({
    description:
      'Id of the seed run record, read back at GET /api/tables/seed_runs/records/:id while the CLI waits',
  }).check(Schema.isMinLength(1)),
  status: seedRunStatusSchema,
  deploymentId: optionalField(
    Schema.String.annotate({
      description: 'The live deployment whose seed/ folder the run loads',
    }).check(Schema.isMinLength(1))
  ),
})

/** @public */
export type SeedRunResponse = Schema.Schema.Type<typeof seedRunResponseSchema>

/**
 * The seed webhook's refusal codes.
 *
 * - `unknown-app` (404): no app at that address on the caller's account —
 *   whether it exists for someone else is not said.
 * - `no-live-deployment` (409): the app has never gone live, so there is no
 *   release to seed from. Deploy first.
 * - `no-seed` (422): the bundle the app runs has no `seed/` folder. Add one and
 *   deploy.
 * - `confirmation-required` (422): a `replace` whose `confirm` is not the
 *   app's address.
 * - `invalid-seed-request` (422): the body is not a seed request.
 *
 * Nothing is recorded on any refusal.
 *
 * @public
 */
export const seedRunRefusalCodes = [
  'unknown-app',
  'no-live-deployment',
  'no-seed',
  'confirmation-required',
  'invalid-seed-request',
] as const

/** @public */
export const seedRunRefusalSchema = Schema.Struct({
  error: Schema.Literals(seedRunRefusalCodes).annotate({
    description:
      "'unknown-app' (404), 'no-live-deployment' (409), 'no-seed' (422), 'confirmation-required' (422) or 'invalid-seed-request' (422); nothing was recorded",
  }),
  message: optionalField(Schema.String.annotate({ description: 'Why, for a person' })),
})

/** @public */
export type SeedRunRefusal = Schema.Schema.Type<typeof seedRunRefusalSchema>

const countSchema = (description: string) =>
  Schema.Number.annotate({ description }).check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0))

/**
 * What a seed run did to one table, or — in a dry run — would do.
 *
 * - `seeded`: rows were written; `created` and `updated` count them (`updated`
 *   is 0 except under `upsert`). A `replace` reports the rows it inserted
 *   after deleting.
 * - `skipped`: `if-empty` left the table alone because it already holds
 *   `present` rows.
 *
 * In a dry run nothing is written: `seeded` counts the rows the run would
 * write (`created` holds the file's record count; under `upsert` it cannot
 * know which rows would be updates, so `updated` is 0), and `skipped` is
 * computed against the app's real data.
 *
 * @public
 */
export const seedTableResultSchema = Schema.Struct({
  table: Schema.String.annotate({ description: 'The table, by name' }).check(Schema.isMinLength(1)),
  outcome: Schema.Literals(['seeded', 'skipped']).annotate({
    description:
      "'seeded': rows were (or, in a dry run, would be) written; 'skipped': if-empty left the table alone because it holds rows",
  }),
  created: countSchema('Rows inserted (in a dry run: rows the run would write)'),
  updated: countSchema('Rows an upsert matched and updated; 0 in every other mode'),
  present: optionalField(countSchema('Rows the table already held, for a table if-empty skipped')),
})

/** @public */
export type SeedTableResult = Schema.Schema.Type<typeof seedTableResultSchema>

/**
 * The report of one seed run — what `sovrium seed --report <file>` writes,
 * what `instance/seed` returns as its output, and what a seed run record
 * carries once `done`.
 *
 * `lines` are the lines the same command prints on a laptop, in order, so the
 * CLI shows a remote run exactly as it shows a local one; `tables` says the
 * same per table, for a program.
 *
 * @public
 */
export const seedReportSchema = Schema.Struct({
  mode: seedRunModeSchema,
  dryRun: Schema.Boolean.annotate({ description: 'true when nothing was written' }),
  tables: Schema.Array(seedTableResultSchema).annotate({
    description: 'One entry per table the run targeted, in the order they were written',
  }),
  lines: Schema.Array(Schema.String.annotate({ description: 'One line of the report' })).annotate({
    description:
      'The report exactly as `sovrium seed` prints it, one entry per line — accounts first, then one line per table',
  }),
  revision: optionalField(
    Schema.String.annotate({
      description: 'The release whose seed/ folder was loaded, when the run happened on a host',
    }).check(Schema.isMinLength(1))
  ),
})

/** @public */
export type SeedReport = Schema.Schema.Type<typeof seedReportSchema>

/**
 * The `fields` of a seed run record the CLI reads while it waits. Other
 * fields the cloud keeps (the app, the deployment, who asked) are ignored.
 *
 * Field names are the table's columns, in lowercase with underscores.
 *
 * @public
 */
export const seedRunRecordFieldsSchema = Schema.Struct({
  status: seedRunStatusSchema,
  mode: optionalField(seedRunModeSchema),
  dry_run: optionalField(
    Schema.NullOr(Schema.Boolean).annotate({ description: 'Whether the run only reports' })
  ),
  report: optionalField(Schema.NullOr(seedReportSchema)),
  error: optionalField(
    Schema.NullOr(Schema.String).annotate({
      description:
        "Why a 'failed' run stopped — the seeder's own refusal (for example an upsert with no merge key), or the end of the host's journal — printed as is; null or absent otherwise",
    })
  ),
  backup_key: optionalField(
    Schema.NullOr(Schema.String).annotate({
      description:
        "Where the backup a 'replace' takes before deleting anything was stored, once taken; it restores through the cloud's ordinary restore. Null or absent for other modes",
    })
  ),
})

/** @public */
export type SeedRunRecordFields = Schema.Schema.Type<typeof seedRunRecordFieldsSchema>
