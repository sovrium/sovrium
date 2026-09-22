/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Boot-time reconciliation of `type: 'user'` foreign keys onto
 * `ON DELETE SET NULL`.
 *
 * ── What drifts, and why it matters ───────────────────────────────────────
 * `generateForeignKeyConstraints` emits the key for a `type: 'user'` field with
 * `ON DELETE SET NULL`. It did not always: the clause was absent, so the key
 * defaulted to `NO ACTION` — and that default is not a neutral choice. If any
 * record assigns a person and was authored by SOMEBODY ELSE, that record
 * outlives the purge's `created_by = userId` sweep, and the closing
 * `DELETE FROM auth.user` raises a foreign-key violation that rolls back the
 * WHOLE GDPR Art. 17 transaction. The account cannot be erased at all for as
 * long as the assignment exists, and the deletion request answers 500.
 *
 * ── Why the ordinary migration path cannot deliver the fix ────────────────
 * `generateSchemaChecksum` hashes `app.tables` and nothing else — no engine
 * version. `resolveSkip` then skips `executeMigrationSteps` outright on a match.
 * An operator who upgrades the binary WITHOUT editing their config therefore
 * reconciles nothing, on either dialect. That is the most common upgrade, and it
 * is exactly the install still carrying the unerasable key. Even a config edit
 * only half-helps: Postgres re-adds every app table's keys through
 * `syncForeignKeyConstraints`, but that helper is a deliberate no-op on SQLite,
 * where a constraint change is carried by table recreation — which
 * `migrateExistingTableEffect` performs only when THAT table's own definition
 * changed.
 *
 * No `drizzle/000N_*.sql` migration can close the gap either: app tables are
 * created at runtime from arbitrary `app.tables[]` config, so a migration file
 * can only ever name `auth.*` / `system.*` relations.
 *
 * The drift is a property of the LIVE constraint, not of the config, so it is
 * probed unconditionally on every boot — same placement and same reasoning as
 * the timestamptz reconciler and the attachment-URL repair that share this
 * startup phase.
 *
 * ── Why this one is NOT behind an operator gate ───────────────────────────
 * The timestamptz reconciler next door IS gated, because `ALTER … TYPE` is a
 * full table rewrite under `ACCESS EXCLUSIVE` — a boot-time outage. Changing a
 * foreign key's referential action is a different animal, and the measurements
 * say so:
 *
 *   - **Postgres** — a single `ALTER TABLE … DROP CONSTRAINT …, ADD CONSTRAINT
 *     … NOT VALID` is catalog-only: ~2 ms on a 2M-row / 369 MB table and ~2 ms
 *     on a 5M-row / 974 MB one, i.e. independent of size. `NOT VALID` is what
 *     buys that: a validating re-add re-scans every row (measured 220 ms at 2M
 *     rows, 1.5 s at 5M) and the scan verifies something already guaranteed —
 *     the constraint being replaced enforced the very same referential
 *     integrity. Crucially the referential ACTION still fires on a `NOT VALID`
 *     key (verified: the parent delete nulls the child), because `NOT VALID`
 *     only skips the initial verification, never the RI triggers.
 *   - **SQLite** — there is no `ALTER … DROP CONSTRAINT` at all, so the repair
 *     IS a full recreate-and-copy. Measured at 0.9 s for 2M rows / 293 MB
 *     (~0.45 ms per MB). SQLite's own documented `PRAGMA writable_schema`
 *     in-place edit would have made this O(1), and is unavailable: `bun:sqlite`
 *     runs in defensive mode, where the pragma is silently ignored (it reads
 *     back `0`).
 *
 * A gate would have to default OFF to be worth having, and SQLite is the
 * ZERO-CONFIG default — so gating would leave the majority of self-hosted
 * installs unerasable until their operator read a warning and set a variable.
 * That reproduces the very bug this module exists to close, for the commonest
 * deployment, in exchange for a one-off sub-second boot cost that only a
 * deployment carrying the drift ever pays. Every boot after the first finds the
 * key correct and emits nothing.
 *
 * ── Why a failure does not abort the boot ─────────────────────────────────
 * Nothing here is destructive, so there is no dangerous half-state to protect
 * against by refusing to start. A failed repair leaves a latent compliance
 * defect; aborting would convert it into a total outage of the whole app. The
 * failure is instead reported as a WARN that names the consequence and the
 * manual remedy, so it is loud rather than silent.
 */

import { sql } from 'drizzle-orm'
import { Effect } from 'effect'
import { sanitizeTableName } from '@/domain/kernel/sql/table-naming'
import { parseDatabaseDialectConfig } from '@/domain/models/process-env/database/database-dialect'
import { db } from '@/infrastructure/database'
import { SchemaInitializationError } from '@/infrastructure/errors/schema-initialization-error'
import { logInfo, logWarning } from '@/infrastructure/logging/logger'
import { getBaseTableName, shouldUseView } from '../lookup/lookup-view-generators'
import { openSqliteDdlDatabase, runSqliteSchemaTransaction } from '../sql/dialect-ddl'
import { executeRaw } from '../sql/dialect-execute'
import { getExistingColumns } from '../sql/sql-execution'
import { isUserField } from '../sql/sql-field-predicates'
import { generateForeignKeyConstraints } from '../sql/sql-key-constraints'
import { buildTablePrimaryKeyTypesMap } from '../table-operations/column-generators'
import { recreateTableWithDataEffect } from '../table-operations/migration-utils'
import { applySchemaDefaults } from './apply-schema-defaults'
import type { SQLExecutionError, TransactionLike } from '../sql/sql-execution'
import type { App, Table } from '@/domain/models/app'

/** Tag a thrown value with the step that produced it. */
const asSchemaError = (operation: string) => (cause: unknown) =>
  new SchemaInitializationError({
    message: `Failed to ${operation} while reconciling user foreign keys`,
    cause,
  })

/** `pg_constraint.confdeltype` code for `ON DELETE SET NULL` — the target. */
const PG_SET_NULL = 'n'

/** How `pragma_foreign_key_list` spells the target action. */
const SQLITE_SET_NULL = 'SET NULL'

/** One `type: 'user'` column of one app table. */
export interface UserForeignKeyCandidate {
  /** The declaring table — the repair regenerates its DDL from this. */
  readonly table: Table
  /** The PHYSICAL relation — the `_base` table when the table is view-backed. */
  readonly relation: string
  /** `field.name` IS the column name; there is no mapper. */
  readonly column: string
}

const collectTableCandidates = (table: Readonly<Table>): readonly UserForeignKeyCandidate[] => {
  const sanitized = sanitizeTableName(table.name)
  const relation = shouldUseView(table) ? getBaseTableName(sanitized) : sanitized
  return table.fields.filter(isUserField).map((field) => ({ table, relation, column: field.name }))
}

/** Every `type: 'user'` column declared anywhere in the app. */
export const collectUserForeignKeyCandidates = (
  app: Readonly<App>
): readonly UserForeignKeyCandidate[] =>
  (app.tables ?? []).flatMap((table) => collectTableCandidates(table))

/**
 * The maps the DDL generators need, in the shape they expect.
 *
 * The primary-key map is built from the `applySchemaDefaults`-processed tables,
 * not the raw config: a table named in `auth.scopeTables` gets its implicit
 * TEXT key there, and a map built from the raw list would hand its children an
 * INTEGER foreign key onto a TEXT parent — the exact shape this repair exists
 * to remove, reintroduced by the repair itself.
 */
const buildGeneratorMaps = (
  app: Readonly<App>
): {
  readonly tableUsesView: ReadonlyMap<string, boolean>
  readonly tablePrimaryKeyTypes: ReadonlyMap<string, string | undefined>
} => ({
  tableUsesView: new Map((app.tables ?? []).map((table) => [table.name, shouldUseView(table)])),
  tablePrimaryKeyTypes: buildTablePrimaryKeyTypesMap(applySchemaDefaults(app.tables ?? [], app)),
})

/** The generator maps, as one value threaded through the SQLite repair. */
type GeneratorMaps = ReturnType<typeof buildGeneratorMaps>

/**
 * Which of `candidates` carry a live foreign key whose `ON DELETE` action is
 * not `SET NULL`.
 *
 * A candidate with NO foreign key at all is deliberately NOT reported: that is
 * the shape an auth-less app produces (the key is skipped at CREATE because
 * there is no `auth.user` to reference), where erasure is moot. Only a key that
 * EXISTS with the wrong action blocks a purge.
 *
 * Reads every single-column foreign key of every public relation in one query
 * and intersects in TypeScript, so the width is one query regardless of how many
 * tables the app declares.
 */
const probePostgresDrift = (
  candidates: readonly UserForeignKeyCandidate[]
): Effect.Effect<readonly UserForeignKeyCandidate[], SchemaInitializationError> =>
  Effect.tryPromise({
    try: () =>
      executeRaw(
        db,
        sql`SELECT cl.relname AS relation, att.attname AS column_name, con.confdeltype AS on_delete
          FROM pg_constraint con
          JOIN pg_class cl ON cl.oid = con.conrelid
          JOIN pg_namespace ns ON ns.oid = cl.relnamespace
          JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
          WHERE con.contype = 'f'
            AND ns.nspname = 'public'
            AND array_length(con.conkey, 1) = 1`
      ),
    catch: asSchemaError('read the foreign-key catalog'),
  }).pipe(
    Effect.map((rows) => {
      const actions = new Map(
        rows.map((row) => [
          `${String(row['relation'])}.${String(row['column_name'])}`,
          String(row['on_delete']),
        ])
      )
      return candidates.filter((candidate) => {
        const action = actions.get(`${candidate.relation}.${candidate.column}`)
        return action !== undefined && action !== PG_SET_NULL
      })
    })
  )

/**
 * SQLite counterpart. `pragma_foreign_key_list` is a table-valued function that
 * takes ONE relation, so this fans out per candidate relation — bounded by the
 * app's own table count, run once at boot on the shared handle, each call a
 * single in-memory schema read.
 */
const probeSqliteDrift = (
  candidates: readonly UserForeignKeyCandidate[]
): Effect.Effect<readonly UserForeignKeyCandidate[], SchemaInitializationError> =>
  Effect.forEach(candidates, (candidate) =>
    Effect.tryPromise({
      try: () =>
        executeRaw(
          db,
          sql`SELECT on_delete FROM pragma_foreign_key_list(${candidate.relation})
              WHERE "from" = ${candidate.column}`
        ),
      catch: asSchemaError(`read the foreign keys of ${candidate.relation}`),
    }).pipe(
      Effect.map((rows) => {
        const action = rows[0]?.['on_delete']
        return action !== undefined && String(action) !== SQLITE_SET_NULL ? [candidate] : []
      })
    )
  ).pipe(Effect.map((nested) => nested.flat()))

/**
 * The corrected key, taken from the ONE generator that emits it, so the
 * reconciled constraint can never diverge from the one `CREATE TABLE` writes.
 */
const correctedConstraint = (candidate: Readonly<UserForeignKeyCandidate>): string | undefined =>
  generateForeignKeyConstraints(
    candidate.table.name,
    candidate.table.fields.filter((field) => isUserField(field) && field.name === candidate.column)
  )[0]

/**
 * Swap one drifted Postgres key in a SINGLE `ALTER TABLE`.
 *
 * Existing keys on the column are dropped BY NAME read from the catalog rather
 * than by the name the generator would produce: Postgres does not rename a
 * constraint when its column is renamed, so a long-lived deployment can carry
 * the key under a stale name (the same reason `syncForeignKeyConstraints` drops
 * by column).
 *
 * Drop and add ride one statement so the relation is never momentarily left
 * without the key, and so both take their locks once.
 */
const repairPostgresKey = (
  candidate: Readonly<UserForeignKeyCandidate>
): Effect.Effect<void, SchemaInitializationError> =>
  Effect.gen(function* () {
    const constraint = correctedConstraint(candidate)
    if (constraint === undefined) return

    const existing = yield* Effect.tryPromise({
      try: () =>
        executeRaw(
          db,
          sql`SELECT con.conname AS name
              FROM pg_constraint con
              JOIN pg_class cl ON cl.oid = con.conrelid
              JOIN pg_namespace ns ON ns.oid = cl.relnamespace
              JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
              WHERE con.contype = 'f'
                AND ns.nspname = 'public'
                AND cl.relname = ${candidate.relation}
                AND att.attname = ${candidate.column}`
        ),
      catch: asSchemaError(`name the foreign keys on ${candidate.relation}.${candidate.column}`),
    })
    const drops = existing.map((row) => sql`DROP CONSTRAINT ${sql.identifier(String(row['name']))}`)
    if (drops.length === 0) return

    yield* Effect.tryPromise({
      try: () =>
        executeRaw(
          db,
          sql`ALTER TABLE ${sql.identifier(candidate.relation)} ${sql.join(drops, sql.raw(', '))}, ADD ${sql.raw(constraint)} NOT VALID`
        ),
      catch: asSchemaError(`replace the foreign key on ${candidate.relation}.${candidate.column}`),
    })
  })

/**
 * Rebuild one drifted table so its inline constraints match the config.
 *
 * SQLite declares foreign keys inline in `CREATE TABLE` and offers no way to
 * alter one, so the repair goes through the SAME recreate-and-copy the migration
 * path already uses for a constraint-only change. Regenerating the DDL from the
 * config (rather than patching the stored text) also means every other
 * constraint on the table lands in its declared form.
 */
const repairSqliteTable = (
  tx: TransactionLike,
  candidate: Readonly<UserForeignKeyCandidate>,
  maps: GeneratorMaps
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    const existingColumns = yield* getExistingColumns(tx, candidate.table.name)
    yield* recreateTableWithDataEffect({
      tx,
      table: candidate.table,
      existingColumns,
      ...maps,
    })
  })

/**
 * Rebuild every drifted table inside one SQLite transaction, on a dedicated DDL
 * connection — the same plumbing `executeSchemaInit` uses, so a failure rolls
 * back and never leaves a half-copied table behind.
 */
const repairSqlite = (
  drifted: readonly UserForeignKeyCandidate[],
  path: string,
  maps: GeneratorMaps
): Effect.Effect<void, SchemaInitializationError> =>
  Effect.gen(function* () {
    const runtime = yield* Effect.context<never>()
    const client = openSqliteDdlDatabase(path)
    yield* Effect.tryPromise({
      try: () =>
        runSqliteSchemaTransaction(client, (tx) =>
          Effect.runPromiseWith(runtime)(
            Effect.forEach(drifted, (candidate) => repairSqliteTable(tx, candidate, maps), {
              discard: true,
            })
          )
        ),
      catch: asSchemaError('rebuild the tables whose keys drifted'),
    }).pipe(Effect.ensuring(Effect.sync(() => client.close())))
  })

/**
 * Report keys this step could neither verify nor repair.
 *
 * The relations and the CONSEQUENCE ride the MESSAGE rather than the structured
 * attributes, deliberately: attributes travel only on the exported OTLP record,
 * and an operator reading a boot log on a self-hosted box must be able to act
 * without a telemetry backend. Naming the consequence is the point — "a
 * constraint was not altered" is not something an operator can weigh, whereas
 * "these accounts cannot be erased" is.
 */
const warnReconcileFailed = (
  affected: readonly UserForeignKeyCandidate[],
  error: Readonly<SchemaInitializationError>
): Effect.Effect<void, never> =>
  Effect.sync(() =>
    logWarning(
      `[schema] could not put ON DELETE SET NULL on the user foreign key(s) ` +
        `${affected.map((c) => `${c.relation}.${c.column}`).join(', ')}: ${error.message}. ` +
        `Until this succeeds, erasing an account that is assigned on a record written by ` +
        `somebody else fails and the account cannot be deleted at all.`,
      { relations: affected.map((candidate) => candidate.relation).join(',') }
    )
  )

/** Announce the repair, so an upgrade that changed the schema says so. */
const logReconciled = (drifted: readonly UserForeignKeyCandidate[]): Effect.Effect<void, never> =>
  Effect.sync(() =>
    logInfo(
      `[schema] put ON DELETE SET NULL on ${drifted.length} user foreign key(s) ` +
        `(${drifted.map((c) => `${c.relation}.${c.column}`).join(', ')}) so an assigned ` +
        `account stays erasable`,
      { relations: drifted.map((candidate) => candidate.relation).join(',') }
    )
  )

/**
 * Post-schema startup step: bring every `type: 'user'` foreign key onto
 * `ON DELETE SET NULL`, so an account assigned on another author's record can be
 * erased.
 *
 * Never fails the boot: a repair that cannot be applied is reported and startup
 * continues (see the module docstring).
 */
export const reconcileUserForeignKeys = (app: Readonly<App>): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const candidates = collectUserForeignKeyCandidates(app)
    if (candidates.length === 0) return

    const config = parseDatabaseDialectConfig()
    const drifted = yield* (config.dialect === 'sqlite' ? probeSqliteDrift : probePostgresDrift)(
      candidates
    )
    if (drifted.length === 0) return

    yield* config.dialect === 'sqlite'
      ? repairSqlite(drifted, config.path, buildGeneratorMaps(app))
      : Effect.forEach(drifted, repairPostgresKey, { discard: true })

    yield* logReconciled(drifted)
  }).pipe(Effect.catch((error) => warnReconcileFailed(collectUserForeignKeyCandidates(app), error)))
