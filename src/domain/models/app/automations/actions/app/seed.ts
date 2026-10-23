/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ActionBaseFields } from '../base'
import {
  INSTANCE_SEED_TABLE_PATTERN,
  INSTANCE_SEED_TODAY_PATTERN,
  literalOrWholeTemplate,
  wholeTemplate,
} from '../instance'

/**
 * The four ways a self-seed treats the app's data. The first three are the
 * modes of `sovrium seed --mode`; `reset` exists only here.
 *
 * @public
 */
export const APP_SEED_MODES = ['if-empty', 'upsert', 'replace', 'reset'] as const

/** @public */
export type AppSeedMode = (typeof APP_SEED_MODES)[number]

/**
 * The modes that delete rows. The `SOVRIUM_SELF_SEED` gate allows them only
 * when it is set to `reset`.
 *
 * @public
 */
export const APP_SEED_DESTRUCTIVE_MODES: readonly AppSeedMode[] = ['replace', 'reset']

const AppSeedModeSchema = Schema.Literals(APP_SEED_MODES).annotate({
  description:
    "How the app's data is treated. 'if-empty' seeds only the tables that hold no rows; 'upsert' replays each seed file on its merge key; 'replace' deletes the rows of each seeded table, then inserts the seed; 'reset' empties every table of the app (a table with no seed file stays empty), removes every account the seed does not list with every session and every locally stored upload no seeded row references, then seeds. Written literally, never as a {{template}}: the server reads it at boot to decide whether the automation may be scheduled at all",
  howTo:
    "Set `SOVRIUM_SELF_SEED` on the host that runs the app. Unset, an automation holding this step is not scheduled. `SOVRIUM_SELF_SEED=reset` allows every mode; any other value allows 'if-empty' and 'upsert' only. An automation whose step asks for a mode the variable does not allow is not scheduled either, and the server says so once at boot.",
})

const AppSeedTablesSchema = Schema.Array(
  Schema.String.annotate({ description: 'A table to seed, by name' }).check(
    Schema.isPattern(INSTANCE_SEED_TABLE_PATTERN)
  )
)
  .annotate({
    description:
      "Restrict the run to these tables, as `sovrium seed --table` does. Absent: every table the app has a seed file for. Refused with mode 'reset', which always covers every table",
  })
  .check(Schema.isMinLength(1))

const AppSeedDryRunSchema = Schema.Union([
  Schema.Boolean.annotate({ description: 'true: report the plan and write nothing' }),
  wholeTemplate('One whole {{template}} resolving to true or false'),
]).annotate({
  description:
    "Report the plan computed against the app's own data and write nothing: no row, no account, no session and no file is touched. Default false",
})

/** The props a self-seed step carries, before the cross-prop rule. */
const AppSeedPropsFields = Schema.Struct({
  mode: AppSeedModeSchema,
  tables: Schema.optional(AppSeedTablesSchema),
  today: Schema.optional(
    literalOrWholeTemplate(
      INSTANCE_SEED_TODAY_PATTERN,
      'a calendar day written YYYY-MM-DD',
      'The day every {{today…}} in the seed files resolves against, as `sovrium seed --today`, written YYYY-MM-DD, or one whole {{template}} resolving to one. Absent: the day the run happens'
    )
  ),
  dryRun: Schema.optional(AppSeedDryRunSchema),
}).annotate({
  description:
    'How to seed the app from its own seed files: the mode, the tables, the day relative dates resolve against, and whether to only report the plan.',
})

/**
 * App Seed Action (type: app, operator: seed)
 *
 * Runs the engine's own seeder — the one `sovrium seed` runs — inside the
 * running server, on the app's OWN data, from the `seed/` folder beside the
 * config the server was started with (the release's `seed/` folder on a
 * host). It is how an app resets itself: a cron automation with one `reset`
 * step brings a demo, a sandbox or a training app back to its seed every
 * night, with no host access and no external agent.
 *
 * `instance/seed` seeds ANOTHER app on a host, as that app; this action never
 * reaches outside its own app.
 *
 * The rows are written exactly as `sovrium seed` writes them: `@table.key`
 * links, `@user:` owners, `{{today±Nd}}` dates and the `users.yaml` accounts.
 * A self-seed is silent: no record automation, no table webhook and no
 * activity-log entry fires for a row it deletes or writes.
 *
 * The action is off unless the host switches it on with `SOVRIUM_SELF_SEED`,
 * so a template that ships a seed and a nightly reset never wipes the data of
 * an app built from it. When the variable does not allow a step's mode the
 * whole automation is not scheduled — it starts no run and records no failure
 * — and the server prints one notice at boot naming the variable. That is why
 * `mode` is written literally: it is read at boot, before any run exists.
 *
 * `reset` removes every account the seed does not list, every session and
 * every locally stored upload no seeded row references, empties every table,
 * restores each listed account (its name, role and password), then seeds. A
 * listed account with no password of its own needs `SOVRIUM_SEED_PASSWORD`;
 * without it the step fails with the seeder's own message before anything is
 * deleted. An app with no `seed/` folder is simply emptied.
 *
 * The step's output is the seeder's report, one entry per table.
 */
export const AppSeedActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('app').pipe(
    Schema.annotate({
      description: "Constant value 'app' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('seed').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'app' action family; it decides which props the step takes",
    })
  ),
  props: AppSeedPropsFields.check(
    Schema.makeFilter(
      (props: { readonly mode: AppSeedMode; readonly tables?: readonly string[] }) =>
        props.mode !== 'reset' ||
        props.tables === undefined ||
        "mode 'reset' covers every table of the app; remove `tables`, or use mode 'replace' to reseed only the tables it names"
    )
  ),
}).pipe(
  Schema.annotate({
    identifier: 'AppSeedAction',
    title: 'App Seed Action',
    description:
      "Seed this app's own data from its seed files, or reset it to them, as `sovrium seed` would; switched on by the host with SOVRIUM_SELF_SEED",
  })
)

/** @public */
export type AppSeedAction = Schema.Schema.Type<typeof AppSeedActionSchema>
