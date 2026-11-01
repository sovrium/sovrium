/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The migration steps schema initialization runs inside one transaction
 * (Steps 0-13), and the helpers each step needs.
 *
 * Split out of `schema-initializer.ts`, which keeps the fast path, the
 * dialect resolution and the error policy. The view steps live in
 * `schema-view-steps.ts`.
 */

import { Effect } from 'effect'
import {
  NO_AUTHORED_TABLE_IDS,
  type AuthoredTableIds,
} from '@/domain/models/app/tables/authored-table-ids-service'
import { logDebug } from '@/infrastructure/logging/logger'
import {
  needsUsersTable,
  needsUpdatedByTrigger,
  ensureBetterAuthUsersTable,
  ensureUpdatedByTriggerFunction,
  BetterAuthUsersTableRequired,
} from '../auth/auth-validation'
import * as lookupViewGenerators from '../lookup/lookup-view-generators'
import {
  dropObsoleteTables,
  reconcileViewTopology,
  renameTablesIfNeeded,
  splitSharedLinkTables,
  syncForeignKeyConstraints,
} from '../schema-migration'
import { dropStrandedRenamedTriggers } from '../schema-migration/renamed-relation-triggers'
import { tableExists, SQLExecutionError, type TransactionLike } from '../sql/sql-execution'
import { createOrMigrateTableEffect, buildTablePrimaryKeyTypesMap } from '../table-operations'
import * as viewGenerators from '../views/view-generators'
import { applySchemaDefaults } from './apply-schema-defaults'
import { dropCommandSearchFtsObjects } from './command-search-fts-clear'
import { ensureCommentReadStateTable } from './comment-read-state-table'
import { recomputeFormulasForOlderEngine } from './formula-engine-recompute'
import { collectJunctionTableSpecs, createJunctionTables } from './junction-tables-step'
import {
  getPreviousSchema,
  recordMigration,
  storeSchemaChecksum,
  validateStoredChecksum,
} from './migration-audit-trail'
import {
  detectCircularDependenciesWithOptionalFK,
  sortTablesByDependencies,
} from './schema-dependency-sorting'
import { createAllViews } from './schema-view-steps'
import { ensureUserAccessTable } from './user-access-table'
import { ensureWebhookDeliveriesTable } from './webhook-deliveries-table'
import type { App } from '@/domain/models/app'
import type { Table } from '@/domain/models/app/tables'

/**
 * Ensure Better Auth prerequisites exist (users table + updated-by trigger).
 *
 * The error channel NAMES {@link BetterAuthUsersTableRequired} because
 * `ensureBetterAuthUsersTable` is documented to throw it, this module re-exports
 * it as something a caller can handle, and `SchemaError` below has listed it as
 * a member since that union was written. Wrapping the call in `Effect.promise`
 * declared the channel `never`, which turned the throw into a DEFECT and left
 * the union member unreachable — a misconfigured app got an unhandled fiber
 * failure where an actionable, designed error was on offer. Both calls are now
 * `Effect.tryPromise`, with a catch that keeps the designed error apart from the
 * catalog query merely failing.
 */
const ensureAuthPrerequisites = (
  tx: TransactionLike,
  tables: readonly Table[],
  hasAuthConfig: boolean
): Effect.Effect<void, BetterAuthUsersTableRequired | SQLExecutionError, never> =>
  Effect.gen(function* () {
    const needs = needsUsersTable(tables)

    // Only enforce users table existence if auth is configured
    // If auth is NOT configured, authorship fields will be NULL
    if (needs && hasAuthConfig) {
      yield* Effect.tryPromise({
        try: () => ensureBetterAuthUsersTable(tx, tx.dialect),
        // The designed error passes through UNCHANGED. Anything else is the
        // catalog query itself failing, which is an ordinary SQL failure and
        // must not be reported to an operator as a misconfiguration.
        catch: (error) =>
          error instanceof BetterAuthUsersTableRequired
            ? error
            : new SQLExecutionError({
                message: `Better Auth users table check failed: ${String(error)}`,
                cause: error,
              }),
      })
    } else if (needs && !hasAuthConfig) {
      logDebug('[schema] user fields present but auth not configured — authorship will be NULL')
    }

    if (needsUpdatedByTrigger(tables)) {
      yield* Effect.tryPromise({
        try: () => ensureUpdatedByTriggerFunction(tx, tx.dialect),
        catch: (error) =>
          new SQLExecutionError({
            message: `set_updated_by trigger function setup failed: ${String(error)}`,
            cause: error,
          }),
      })
    }
  })

/** Build map of which tables use VIEWs (have lookup fields) */
const buildTableUsesViewMap = (
  tables: readonly Table[],
  lookupViewModule: typeof lookupViewGenerators
): ReadonlyMap<string, boolean> =>
  new Map(tables.map((table) => [table.name, lookupViewModule.shouldUseView(table)]))

/**
 * Put the stored schema snapshot into the SAME vocabulary as the tables it will
 * be compared against.
 *
 * The snapshot is `app.tables` VERBATIM — written before `applySchemaDefaults`
 * runs (see `createSchemaSnapshot`), while the tables the migrate path compares
 * it against are the POST-defaults ones. So the two sides described the same
 * table differently: an `auth.scopeTables` member reads `primaryKey: undefined`
 * on the stored side and `primaryKey: { type: 'text' }` on the live side. Every
 * such table therefore looked "changed" on every boot, forever, and was
 * reconciled by a full drop-and-recreate that had nothing to do.
 *
 * The STORED FORMAT is deliberately left alone: rewriting it would re-interpret
 * snapshots written by older binaries. Defaults are resolved against the CURRENT
 * app because that is the only config on hand — an approximation that can only
 * ever over-report a change, which is the safe direction ("changed" ⇒
 * reconcile). A snapshot the defaults cannot process falls back to its raw form
 * for the same reason.
 *
 * Scoped to the COMPARISON path alone. Table rename and drop detection (Steps
 * 3.5 and 4) keep the raw snapshot: they match on table identity, for which the
 * defaults are irrelevant and where a decoding surprise would be a silent
 * data-loss decision rather than a redundant rebuild.
 */
const normalizePreviousSchemaForComparison = (
  previousSchema: { readonly tables: readonly object[] } | undefined,
  app: App
): { readonly tables: readonly object[] } | undefined => {
  if (!previousSchema) return undefined
  try {
    return { tables: applySchemaDefaults(previousSchema.tables as readonly Table[], app) }
  } catch {
    return previousSchema
  }
}

// Configuration for createMigrateTables
type CreateMigrateTablesConfig = {
  readonly tx: TransactionLike
  readonly sortedTables: readonly Table[]
  readonly tableUsesView: ReadonlyMap<string, boolean>
  readonly tablePrimaryKeyTypes: ReadonlyMap<string, string | undefined>
  readonly circularTables: ReadonlySet<string>
  readonly previousSchema: { readonly tables: readonly object[] } | undefined
  readonly lookupViewModule: typeof lookupViewGenerators
  readonly hasAuthConfig: boolean
}

/** Create or migrate each table in order; SQLite keeps a loop's keys inline (checked on write) */
const createMigrateTables = (
  config: CreateMigrateTablesConfig
): Effect.Effect<void, SQLExecutionError, never> =>
  Effect.gen(function* () {
    const {
      tx,
      sortedTables,
      tableUsesView,
      tablePrimaryKeyTypes,
      circularTables,
      previousSchema,
      lookupViewModule,
      hasAuthConfig,
    } = config
    for (const table of sortedTables) {
      const physicalTableName = lookupViewModule.getPhysicalTableName(table)
      const exists = yield* tableExists(tx, physicalTableName)
      logDebug('[schema] create/migrate table', { table: table.name, exists: String(exists) })
      yield* createOrMigrateTableEffect({
        tx,
        table,
        exists,
        tableUsesView,
        tablePrimaryKeyTypes,
        previousSchema,
        skipForeignKeys: circularTables.has(table.name) && tx.dialect !== 'sqlite',
        hasAuthConfig,
      })
    }
  })

/** Add foreign key constraints for tables with circular dependencies */
const addCircularFKConstraints = (
  tx: TransactionLike,
  sortedTables: readonly Table[],
  circularTables: ReadonlySet<string>,
  tableUsesView: ReadonlyMap<string, boolean>
): Effect.Effect<void, SQLExecutionError, never> =>
  Effect.gen(function* () {
    if (circularTables.size === 0) return
    logDebug('[schema] adding FK constraints for circular dependencies')
    for (const table of sortedTables.filter((t) => circularTables.has(t.name))) {
      yield* syncForeignKeyConstraints(
        tx,
        table,
        tableUsesView,
        lookupViewGenerators.getPhysicalTableName(table)
      )
    }
  })

/**
 * Create the conditional, config-gated system tables (Steps 11.5-11.7).
 *
 * Each is engine-managed runtime DDL (`CREATE TABLE IF NOT EXISTS`, idempotent)
 * and only materialized when the app opts into the owning feature — so a config
 * that uses none of them pays for none of them:
 *  - `user_access` when `auth.scopeTables` is declared (Z-1/Z-2).
 *  - `_webhook_deliveries` when any table declares outgoing webhooks.
 *  - `comment_read_state` when any table opts into `comments.readTracking`
 *    (the per-user comment read-state design per-user comment read/unread state).
 *
 * The MCP audit log (`system.ai_tool_calls`) is created via Drizzle migration
 * 0001 instead, so it is not included here.
 */
const ensureConditionalSystemTables = (
  tx: TransactionLike,
  app: App
): Effect.Effect<void, SQLExecutionError, never> =>
  Effect.gen(function* () {
    if (app.auth?.scopeTables && app.auth.scopeTables.length > 0) {
      yield* ensureUserAccessTable(tx)
    }
    if ((app.tables ?? []).some((t) => (t.webhooks ?? []).length > 0)) {
      yield* ensureWebhookDeliveriesTable(tx)
    }
    if ((app.tables ?? []).some((t) => t.comments?.readTracking === true)) {
      yield* ensureCommentReadStateTable(tx)
    }
  })

/**
 * Bring the SET of relations in line with the config, before any table is
 * created or altered (Steps 3.5, 4 and 5.5, in that order):
 *
 *  - 3.5 rename tables whose name changed under an id the author wrote, then
 *    give each many-to-many field its own link table (`link-table-splits.ts`);
 *  - 4 drop the tables the config no longer owns — the `_base` table behind a
 *    view-backed table and every many-to-many junction table ARE owned, and a
 *    table that still holds rows is refused unless the one-shot
 *    `sovrium migrate --allow-destructive` consented;
 *  - 5.5 move rows between `<name>` and `<name>_base` by RENAME when a table
 *    gains its first or loses its last computed field, then drop the engine
 *    triggers an earlier release's rename left written for the other name.
 * Every view is dropped first and rebuilt in Steps 9-11 (`dropEveryView`).
 */
const reconcileRelationSet = (
  tx: TransactionLike,
  tables: readonly Table[],
  previousSchema: { readonly tables: readonly object[] } | undefined,
  options: SchemaInitOptions
): Effect.Effect<void, SQLExecutionError, never> =>
  Effect.gen(function* () {
    yield* viewGenerators.dropEveryView(tx)
    const authoredTableIds = options.authoredTableIds ?? NO_AUTHORED_TABLE_IDS
    yield* renameTablesIfNeeded(tx, tables, previousSchema, authoredTableIds)
    yield* splitSharedLinkTables(tx, tables, previousSchema)
    yield* dropObsoleteTables(tx, tables, options, previousSchema)
    yield* reconcileViewTopology(tx, tables)
    yield* dropStrandedRenamedTriggers(tx, tables)
  })

/**
 * What a caller may consent to on this run, and what the decode knew. The boot
 * passes no consent, so it can never drop a table that still holds rows;
 * `sovrium migrate --allow-destructive` is the only caller that sets
 * `allowDestructive`.
 */
export interface SchemaInitOptions {
  readonly allowDestructive?: boolean
  /**
   * The ids the author WROTE, as `decodeAppConfigObject` returned them beside
   * the config: only a name change under one of these is a rename. Omitted, no
   * id reads as written — a rename is then refused as a populated drop, never
   * guessed.
   */
  readonly authoredTableIds?: AuthoredTableIds
}

/**
 * Step 5 of a migration: which tables are view-backed, which sit in a
 * foreign-key cycle, and the dependency order tables are created in.
 */
const planTableOrder = (
  tables: readonly Table[]
): {
  readonly tableUsesView: ReadonlyMap<string, boolean>
  readonly circularTables: ReadonlySet<string>
  readonly sortedTables: readonly Table[]
} => {
  const tableUsesView = buildTableUsesViewMap(tables, lookupViewGenerators)
  const circularTables = detectCircularDependenciesWithOptionalFK(tables)
  if (circularTables.size > 0) {
    logDebug('[schema] circular dependencies detected', {
      tables: Array.from(circularTables).join(', '),
    })
  }
  // Sort and log table creation order
  const sortedTables = sortTablesByDependencies(tables)
  logDebug('[schema] table creation order', {
    order: sortedTables.map((t) => t.name).join(' → '),
  })
  return { tableUsesView, circularTables, sortedTables }
}

/** Execute all migration steps within a transaction */
export const executeMigrationSteps = (
  tx: TransactionLike,
  tables: readonly Table[],
  app: App,
  options: SchemaInitOptions
): Effect.Effect<void, SQLExecutionError | BetterAuthUsersTableRequired, never> =>
  Effect.gen(function* () {
    // Step 0: Validate stored checksum to detect tampering
    yield* validateStoredChecksum(tx)

    // Step 0.5: Clear the command-palette search structures before ANY table
    // DDL — on BOTH engines. SQLite aborts a rebuild whose triggers would be
    // left dangling; PostgreSQL's GIN index is an expression over
    // `coalesce(col,'')`, so a column changing type aborts the migration.
    // Rebuilt by `reconcileCommandSearchIndexes` once the migration commits.
    yield* dropCommandSearchFtsObjects(tx)

    // Steps 1-2: Ensure Better Auth prerequisites
    yield* ensureAuthPrerequisites(tx, tables, !!app.auth)

    // Step 3: Load previous schema for field rename detection
    const previousSchema = yield* getPreviousSchema(tx)
    const previousSchemaForComparison = normalizePreviousSchemaForComparison(previousSchema, app)

    // Steps 3.5, 4 and 5.5: renames, obsolete tables, view topology
    yield* reconcileRelationSet(tx, tables, previousSchema, options)

    // Step 5: Build view map, detect circular dependencies, sort tables
    const { tableUsesView, circularTables, sortedTables } = planTableOrder(tables)

    // Apply schema-author-friendly defaults: scope-table TEXT PKs (Z-1/Z-2)
    // + JSONB upgrade for form-referenced single-attachment columns.
    // PK-type map is built from this list (post-defaults) so scope-table
    // parents resolve relationship FK columns to TEXT.
    const tablesForCreation = applySchemaDefaults(sortedTables, app)

    // Step 6: Create or migrate tables
    yield* createMigrateTables({
      tx,
      sortedTables: tablesForCreation,
      tableUsesView,
      tablePrimaryKeyTypes: buildTablePrimaryKeyTypesMap(tablesForCreation),
      circularTables,
      previousSchema: previousSchemaForComparison,
      lookupViewModule: lookupViewGenerators,
      hasAuthConfig: !!app.auth,
    })

    yield* recomputeFormulasForOlderEngine(tx, tablesForCreation) // Step 6.5

    // Step 7: Add FK constraints for circular dependencies
    yield* addCircularFKConstraints(tx, tablesForCreation, circularTables, tableUsesView)

    // Step 8: Create junction tables for many-to-many relationships
    const junctionTableSpecs = collectJunctionTableSpecs(
      tablesForCreation,
      tableUsesView,
      tx.dialect
    )
    yield* createJunctionTables(tx, junctionTableSpecs)

    // Steps 9-11: Create all views
    yield* createAllViews(tx, tablesForCreation, viewGenerators)

    // Steps 11.5-11.7: Create the config-gated engine-managed system tables
    // (user_access / _webhook_deliveries / comment_read_state).
    yield* ensureConditionalSystemTables(tx, app)

    // Steps 12-13: Record migration and store checksum
    yield* recordMigration(tx, app)
    yield* storeSchemaChecksum(tx, app)
  })
