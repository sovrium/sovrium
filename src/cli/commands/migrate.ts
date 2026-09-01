/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium migrate [config] [--dry-run | --check]`
 *
 * Brings a database's schema forward WITHOUT booting the application, so a
 * deploy whose boot cannot complete still has a route to its own database — and
 * answers the two questions an operator has before they try.
 *
 * | Mode        | Question                          | Exit                  |
 * | ----------- | --------------------------------- | --------------------- |
 * | (none)      | Bring this database forward.      | 0 applied / 1 refused |
 * | `--dry-run` | What would change?                | 0 unless refused      |
 * | `--check`   | Is this database safe to upgrade? | 0 safe / 1 unsafe     |
 *
 * ## Why the command exists
 *
 * Migrating and booting used to be the same action: the only entry point was
 * `sovrium start`, and the generated Procfile carries nothing else. That
 * coupling is invisible until a boot cannot complete — and when v0.23.0 could
 * not boot over a v0.22.2 Postgres database, the one command an
 * operator could run was the one that would not run. Both production databases
 * were repaired by executing Sovrium's own `runMigrations` over a database
 * tunnel from a laptop.
 *
 * This command does NOT fix that ordering defect and must not be offered as its
 * remedy. It makes a broken upgrade survivable, which is a different
 * guarantee. `--check` is a pre-flight for the same reason: it reports what it
 * can prove is wrong, never that the upgrade will succeed.
 *
 * ## Both machines, in one order
 *
 * `runMigrations` (the baked Drizzle journal) then `initializeSchema` (the
 * dynamic `app.tables[]` DDL) — never the reverse. A `type: 'user'` field emits
 * a real `FOREIGN KEY … REFERENCES auth.user(id)`, so the dynamic DDL cannot
 * precede the journal that builds `auth.user`.
 *
 * ## The invariant every import here protects
 *
 * Nothing may reach `src/infrastructure/layers/app-layer.ts`. `createAppLayer(…)`
 * sits as an ARGUMENT EXPRESSION at `src/index.ts:123`, so it performs database
 * I/O while the program value is built, before any Effect runs. That is the
 * exact v0.23.0 mechanism. Every database import below is dynamic, and
 * `[internal ref]` pins the property behaviourally by running the command with
 * `DATABASE_URL` and nothing else.
 */

import { printDocument, printFailure, printProgress } from '@/infrastructure/logging/cli-output'
import { applyDatabaseMigrations, discoverConfigFile, refuse, requireApp } from './app-prelude'
import {
  appliedBlock,
  checkBlocks,
  checkFindingRows,
  configTableRefusalRows,
  configTablesBlock,
  contextBlock,
  dryRunBlocks,
} from './migrate-report'
import type { App } from '@/domain/models/app'
import type { DatabaseDialectConfig } from '@/domain/models/env/database/database-dialect'
import type { MigrationJournalState } from '@/infrastructure/database/drizzle/migrate'

/** Everything `sovrium migrate` reads from the command line. */
export interface MigrateCommandOptions {
  readonly configFile: string | undefined
  readonly dryRun: boolean
  readonly check: boolean
}

/** Resolve the dialect through the lazy boundary every database import crosses. */
const dialectConfig = async (): Promise<DatabaseDialectConfig> => {
  const { parseDatabaseDialectConfig } =
    await import('@/domain/models/env/database/database-dialect')
  return parseDatabaseDialectConfig()
}

/** Where the journal stands, read without applying anything. */
const readJournalState = async (): Promise<MigrationJournalState> => {
  const { readMigrationJournalState } = await import('@/infrastructure/database/drizzle/migrate')
  const { Effect } = await import('effect')
  return Effect.runPromise(readMigrationJournalState(await dialectConfig()))
}

/**
 * The driver's own words, as far as they survive.
 *
 * Effect wraps a failed program's error in a fiber failure whose `message`
 * carries the tagged error's text — which the migrator has already enriched with
 * the `.cause` chain, so `Failed query: …` no longer arrives on its own.
 */
const describeFailure = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

/** Print a refusal to stderr and exit 1. */
const fail = (headline: string, detail: readonly string[], guidance: string): never => {
  printFailure({ headline, detail, guidance })
  // eslint-disable-next-line functional/no-expression-statements
  process.exit(1)
  // eslint-disable-next-line functional/no-throw-statements -- unreachable; narrows the return type to `never`
  throw new Error('unreachable')
}

/**
 * `--check`: report where the database stands, and refuse if it cannot be
 * upgraded.
 *
 * Covers BOTH machines. [internal ref]'s own table names "a type coercion over
 * populated rows" as Layer B's failure class, so a `--check` that printed
 * "Safe to migrate." while such a coercion would abort the boot would be
 * under-reporting — the thing [internal ref] classes as a defect rather than a
 * limitation.
 *
 * ## On the "no config in reach" caveat
 *
 * [internal ref] flags that `runCheck` takes no `App` and asks for the Layer-B section
 * to be conditional on a config resolving. Measured rather than assumed: the
 * COMMAND already requires one. `handleMigrateCommand` calls `requireApp`
 * before dispatching to any mode, and `[internal ref]` pins that a `migrate`
 * invocation with no discoverable config refuses with
 * `Error: File not found: ./app.yaml` before opening a connection. So an
 * operator down a database tunnel with no config never reaches this function at
 * all, and widening `--check` to Layer B widens nothing.
 *
 * The section is still conditional, because a config can resolve and declare no
 * tables — the report says so rather than staying silent.
 */
const runCheck = async (app: App): Promise<void> => {
  const { readMigrationPreflight } =
    await import('@/infrastructure/database/drizzle/migrate-preflight')
  const { planConfigTableChanges } = await import('@/infrastructure/database/schema/schema-dry-run')
  const { Effect } = await import('effect')

  const config = await dialectConfig()
  const state = await readJournalState()
  const findings = await Effect.runPromise(readMigrationPreflight(config))
  // Read-only: `planConfigTableChanges` introspects and, for a changing column,
  // SELECTs its rows. It emits no DDL, which is what keeps `--check`'s
  // "writes nothing" contract true.
  const changes = await Effect.runPromise(planConfigTableChanges(app, config))

  // The report goes out FIRST and unconditionally: an operator asked where the
  // database stands, and a blocked upgrade does not make that question moot.
  printDocument(checkBlocks(state, findings, changes))

  const rows = [...checkFindingRows(findings), ...configTableRefusalRows(changes)]
  if (rows.length > 0) {
    return fail(
      'This database is not safe to migrate.',
      rows,
      'Resolve what is named above, then run sovrium migrate --check again.'
    )
  }

  // eslint-disable-next-line functional/no-expression-statements
  process.exit(0)
}

/** `--dry-run`: name what would change, on both machines, and write nothing. */
const runDryRun = async (app: App): Promise<void> => {
  const { planConfigTableChanges } = await import('@/infrastructure/database/schema/schema-dry-run')
  const { Effect } = await import('effect')

  const config = await dialectConfig()
  const state = await readJournalState()
  const changes = await Effect.runPromise(planConfigTableChanges(app, config))

  printDocument(dryRunBlocks(state, changes))

  // A recreate is reported as unsimulated because its statements cannot be
  // rendered ahead of time. Whether it would be REFUSED is the one thing about
  // it an operator's maintenance-window decision turns on, and that IS
  // computable read-only — so a dry run that found one exits non-zero rather
  // than reading as a plan the operator can go ahead and apply.
  const refusals = configTableRefusalRows(changes)
  if (refusals.length > 0) {
    return fail(
      'This plan would be refused.',
      refusals,
      'Resolve what is named above, then run sovrium migrate --dry-run again.'
    )
  }

  // eslint-disable-next-line functional/no-expression-statements
  process.exit(0)
}

/** The apply path: run both machines, then report the difference they made. */
const runApply = async (app: App): Promise<void> => {
  printProgress('Migrating')

  const before = await readJournalState()
  const failure = await applyDatabaseMigrations(app).then(
    () => undefined,
    (error: unknown) => describeFailure(error)
  )
  if (failure !== undefined) {
    return fail(
      'The database was not migrated.',
      failure.split('\n'),
      'Resolve what the driver reported above, then run sovrium migrate again.'
    )
  }

  const after = await readJournalState()
  printDocument([
    contextBlock(after),
    appliedBlock(before, after),
    configTablesBlock((app.tables ?? []).map((table) => table.name)),
  ])
  // eslint-disable-next-line functional/no-expression-statements
  process.exit(0)
}

/**
 * Handle `sovrium migrate`.
 *
 * The config is resolved before any mode runs, and before the database is
 * touched: a mistyped invocation on a production box must be inert rather than
 * half-applied. The exit is explicit in every branch because a database
 * connection can outlive the last statement and keep the process alive, and a
 * platform release phase waits on the code.
 */
export const handleMigrateCommand = async (options: MigrateCommandOptions): Promise<void> => {
  if (options.dryRun && options.check) {
    return refuse(
      'Error: --dry-run and --check cannot be combined.\n' +
        '  --check asks whether the upgrade is safe to attempt; --dry-run asks what it would do.\n' +
        '  Run them one at a time.'
    )
  }

  const configFile = options.configFile ?? (await discoverConfigFile())
  const app = await requireApp(configFile)

  // Every mode now reads `app`: `--check` covers the dynamic tables too
  // ([internal ref]'s Layer B), read-only. It still creates nothing — describing a
  // table is exactly what the mode promises to do without building it.
  const run = options.check
    ? () => runCheck(app)
    : options.dryRun
      ? () => runDryRun(app)
      : () => runApply(app)

  return run().catch((error: unknown) =>
    fail(
      'The database could not be reached.',
      describeFailure(error).split('\n'),
      'Check DATABASE_URL and that the database is reachable, then try again.'
    )
  )
}
