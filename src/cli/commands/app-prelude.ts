/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The prelude every data-touching CLI command runs before it does its own work:
 * resolve the app config, then bring the database's schema forward.
 *
 * ## Why this is shared rather than copied
 *
 * `sovrium seed` owned this privately first, and `sovrium migrate` needs the
 * byte-identical sequence. Two copies would drift, and only one of them would
 * receive the next fix — the cause-restoration work [internal ref] calls for lands in
 * exactly these functions.
 *
 * ## The one property that must not regress
 *
 * Every import below is DYNAMIC. `createAppLayer(...)` sits as an *argument
 * expression* at `src/index.ts:123`, so it performs database I/O while the
 * program value is being built — before any Effect runs. A single eager import
 * that reaches `src/infrastructure/layers/app-layer.ts` from here would
 * reintroduce the v0.23.0 deadlock: the process would die constructing the auth
 * instance, on precisely the databases these commands exist to repair.
 * `[internal ref]` pins that as a behaviour by running with `DATABASE_URL` and
 * nothing else.
 */

import { Cause, Effect } from 'effect'
import { formatDiscoveredConfigNotice } from '@/domain/kernel/config-parsing/default-config-files'
import { printStderr } from '@/infrastructure/logging/cli-output'
import { lazyImportSchema } from './utils'
import type { App } from '@/domain/models/app'

/**
 * The path reported when discovery finds nothing.
 *
 * Terminal rather than a refusal of its own: `requireApp` then prints the
 * byte-identical `Error: File not found: ./app.yaml` it printed before
 * discovery existed, so the failure contract is untouched.
 */
export const DEFAULT_CONFIG_FILE = './app.yaml'

/** Print to stderr and exit 1. There is no partial-success exit code. */
export const refuse = (message: string): never => {
  printStderr(message)
  // eslint-disable-next-line functional/no-expression-statements
  process.exit(1)
}

/**
 * Resolve the config when no positional one was given.
 *
 * The change discovery made is purely additive — `app.yaml` still resolves (it
 * is candidate #1) and `app.yml` / `app.ts` now resolve too.
 */
export const discoverConfigFile = async (): Promise<string> => {
  const { discoverDefaultConfigFile } = await lazyImportSchema()
  const discovered = await discoverDefaultConfigFile(process.cwd())
  if (discovered === undefined) return DEFAULT_CONFIG_FILE

  printStderr(formatDiscoveredConfigNotice(discovered))
  return discovered
}

/** Load and decode the app config, refusing with the path the operator typed. */
export const requireApp = async (configFile: string): Promise<App> => {
  if (!(await Bun.file(configFile).exists())) {
    return refuse(`Error: File not found: ${configFile}`)
  }

  const { loadSchemaFromFile } = await lazyImportSchema()
  const parsed = await loadSchemaFromFile(configFile).catch((error: unknown) =>
    refuse(
      `Error: Failed to parse ${configFile}: ${error instanceof Error ? error.message : String(error)}`
    )
  )

  const { decodeAppConfigObject } = await import('@/application/use-cases/config/decode-app-config')
  const decoded = decodeAppConfigObject(parsed)
  return decoded.valid
    ? decoded.app
    : refuse(
        `Error: ${configFile} is not a valid configuration:\n` +
          decoded.errors.map((error) => `  ${error}`).join('\n')
      )
}

/**
 * The two boot steps, and only those two.
 *
 * `runMigrations` must precede `initializeSchema` — the app's own tables carry
 * foreign keys into `auth.user`, which the migrations create.
 *
 * Deliberately NOT included: boot's best-effort post-schema steps
 * (attachment-URL backfill, connection seeding, agent-user sync, RAG
 * embedding). Those are startup concerns, and a command named `seed` or
 * `migrate` would then have side effects its name does not promise.
 */
export const applyDatabaseMigrations = async (app: App): Promise<void> => {
  const { parseDatabaseDialectConfig } =
    await import('@/domain/models/process-env/database/database-dialect')
  const { runMigrations } = await import('@/infrastructure/database/drizzle/migrate')
  const { initializeSchema } = await import('@/infrastructure/database/schema/schema-initializer')
  return Effect.runPromise(
    Effect.gen(function* () {
      yield* runMigrations(parseDatabaseDialectConfig())
      yield* initializeSchema(app)
    })
  )
}

/**
 * Why {@link applyDatabaseMigrations} would REFUSE this config, asked without
 * applying anything.
 *
 * Read-only against the live database, and the same planner
 * `sovrium migrate --dry-run` reports from — the two must not be able to
 * disagree about whether a change is possible, and the words an operator reads
 * from a `--watch` refusal are the words they would read from the command.
 *
 * ## Why it lives in the prelude rather than beside its caller
 *
 * This file and `migrate*.ts` are the enumerated set of CLI files permitted to
 * open the database (`cli-database` in `[internal ref]`), and that
 * enumeration is the enforcement mechanism rather than an accident of history:
 * a directory glob would admit a new database-touching command silently. The
 * `--watch` pre-flight needs exactly this one read, so it asks for it HERE and
 * the set of files that may open a database is unchanged.
 *
 * ## A planner that could not RUN answers UNKNOWN, not "nothing in the way"
 *
 * An unreachable or unreadable database has not refused a change; it has failed
 * to answer. Those two are different verdicts and they used to be the same
 * value — this resolved `[]` on any error, which a caller cannot tell from
 * "nothing knowable stands in the way".
 *
 * MEASURED, and the cost was a total outage. The `--watch` pre-flight read the
 * empty list as a pass, `restartServer` stopped the listener, the boot failed on
 * the same unreadable database, and the rollback failed on it too:
 * `[server] stopped` followed by `the previous configuration could not be
 * restored either`. The earlier reasoning — "let the boot reach its own verdict a
 * moment later" — rested on the rollback being a net, and this is the case where
 * the net is made of the same material as the fall.
 *
 * So the outcome is a union, and the caller decides. Refusing is strictly better
 * on both branches: if the obstruction is transient the operator still has a
 * serving port and saves again, and if it is not, they get a message naming the
 * cause instead of a dead socket. Nothing is lost, because a pre-flight that
 * cannot read the schema was never going to make the migration succeed.
 *
 * @public
 */
export type DatabasePlanOutcome =
  /** The planner ran. `refusals` may be empty, and empty means what it says. */
  | { readonly kind: 'planned'; readonly refusals: readonly string[] }
  /** The planner could not ask the database. `cause` is what stopped it. */
  | { readonly kind: 'unanswerable'; readonly cause: string }

/** The sentence a cause carries, without its tag. */
const describePlanCause = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause)

export const planDatabaseRefusals = async (app: App): Promise<DatabasePlanOutcome> => {
  const { parseDatabaseDialectConfig } =
    await import('@/domain/models/process-env/database/database-dialect')
  const { planConfigTableChanges } = await import('@/infrastructure/database/schema/schema-dry-run')

  // `planConfigTableChanges` declares `E = never` — it opens its own read-only
  // handle inside `Effect.sync`, so a database that cannot be opened arrives as a
  // DEFECT rather than a typed failure. `catchCause` is therefore the one arm that
  // sees it, and `tapCause` sits BEFORE the recovery so the cause is logged rather
  // than only summarised into a sentence (standing rule E6).
  return Effect.runPromise(
    planConfigTableChanges(app, parseDatabaseDialectConfig()).pipe(
      Effect.map((changes): DatabasePlanOutcome => ({
        kind: 'planned',
        refusals: changes.flatMap((change) => change.refusals),
      })),
      Effect.tapCause((cause) =>
        Effect.logError('The migration pre-flight could not read the database', cause)
      ),
      Effect.catchCause((cause) =>
        Effect.succeed<DatabasePlanOutcome>({
          kind: 'unanswerable',
          cause: describePlanCause(Cause.squash(cause)),
        })
      )
    )
  )
}
