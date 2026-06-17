/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { SQL } from 'bun'
import { Effect, Layer, Runtime } from 'effect'
import {
  SchemaMigrator,
  SchemaMigrationError,
  type SchemaMigrationResult,
} from '@/application/ports/services/schema-migrator'
import { parseDatabaseDialectConfig } from '@/domain/models/env/database/database-dialect'
import {
  classifySchemaMigration,
  type SchemaMigrationPlan,
} from '@/domain/services/schema-migration-plan'
import { logDebug } from '@/infrastructure/logging/logger'
import { buildColumnStatements } from '../schema-migration/column-detection'
import { openSqliteDdlDatabase, runSqliteSchemaTransaction } from '../sql/dialect-ddl'
import { executeSQLStatements, type TransactionLike } from '../sql/sql-execution'
import { createNewTableEffect } from '../table-operations'
import type { App } from '@/domain/models/app'
import type { DatabaseDialectConfig } from '@/domain/models/env/database/database-dialect'

type ApplyContext = {
  readonly hasAuthConfig: boolean
  readonly tablePrimaryKeyTypes: ReadonlyMap<string, string | undefined>
}

const applyAdditivePlan = (
  tx: TransactionLike,
  plan: SchemaMigrationPlan,
  ctx: ApplyContext
): Effect.Effect<void, unknown, never> =>
  Effect.gen(function* () {
    const { hasAuthConfig, tablePrimaryKeyTypes } = ctx
    yield* Effect.forEach(
      plan.tablesToCreate,
      (table) => createNewTableEffect({ tx, table, hasAuthConfig, tablePrimaryKeyTypes }),
      { discard: true }
    )

    yield* Effect.forEach(
      plan.columnsToAddByTable,
      (entry) => {
        const primaryKeyFields =
          entry.table.primaryKey?.type === 'composite' ? (entry.table.primaryKey.fields ?? []) : []
        const { addStatements } = buildColumnStatements({
          tableName: entry.table.name,
          columnsToDrop: [],
          columnsToAdd: [...entry.fields],
          primaryKeyFields,
          allFields: entry.table.fields,
          tablePrimaryKeyTypes,
        })
        return executeSQLStatements(tx, addStatements)
      },
      { discard: true }
    )
  })

const buildLivePrimaryKeyTypesMap = (app: App): ReadonlyMap<string, string | undefined> => {
  const scopeTableNames = new Set(app.auth?.scopeTables ?? [])
  return new Map(
    (app.tables ?? []).map((table) => {
      const explicitType = table.primaryKey?.type
      if (explicitType !== undefined) return [table.name, explicitType] as const
      return [table.name, scopeTableNames.has(table.name) ? 'text' : undefined] as const
    })
  )
}

const builtApplied = (plan: SchemaMigrationPlan): SchemaMigrationResult['applied'] => [
  ...plan.addedTables,
  ...plan.addedColumns,
]

const runPostgres = (
  config: Extract<DatabaseDialectConfig, { dialect: 'postgres' }>,
  plan: SchemaMigrationPlan,
  ctx: ApplyContext,
  runtime: Runtime.Runtime<never>
): Effect.Effect<void, SchemaMigrationError, never> =>
  Effect.gen(function* () {
    const db = new SQL({ url: config.databaseUrl, max: 1 })
    try {
      yield* Effect.tryPromise({
        try: async () => {
          await db.begin(async (tx) => {
            await Runtime.runPromise(runtime)(
              applyAdditivePlan(tx, plan, ctx) as Effect.Effect<void, never, never>
            )
          })
        },
        catch: (cause) =>
          new SchemaMigrationError({
            message: `Live additive migration failed: ${String(cause)}`,
            cause,
          }),
      })
    } finally {
      yield* Effect.promise(() => db.close())
    }
  })

const runSqlite = (
  config: Extract<DatabaseDialectConfig, { dialect: 'sqlite' }>,
  plan: SchemaMigrationPlan,
  ctx: ApplyContext,
  runtime: Runtime.Runtime<never>
): Effect.Effect<void, SchemaMigrationError, never> =>
  Effect.gen(function* () {
    const db = openSqliteDdlDatabase(config.path)
    try {
      yield* Effect.tryPromise({
        try: () =>
          runSqliteSchemaTransaction(db, async (tx) => {
            await Runtime.runPromise(runtime)(
              applyAdditivePlan(tx, plan, ctx) as Effect.Effect<void, never, never>
            )
          }),
        catch: (cause) =>
          new SchemaMigrationError({
            message: `Live additive migration failed: ${String(cause)}`,
            cause,
          }),
      })
    } finally {
      db.close()
    }
  })

const applyAdditive = (
  previous: App,
  next: App
): Effect.Effect<SchemaMigrationResult, SchemaMigrationError> =>
  Effect.gen(function* () {
    const plan = classifySchemaMigration(previous, next)
    const result: SchemaMigrationResult = {
      applied: builtApplied(plan),
      deferred: plan.deferred,
    }

    if (plan.tablesToCreate.length === 0 && plan.columnsToAddByTable.length === 0) {
      return result
    }

    const config = parseDatabaseDialectConfig()
    const ctx: ApplyContext = {
      hasAuthConfig: !!next.auth,
      tablePrimaryKeyTypes: buildLivePrimaryKeyTypesMap(next),
    }
    const runtime = yield* Effect.runtime<never>()

    logDebug(
      `[live-migrator] applying additive DDL: ${plan.addedTables.length} table(s), ${plan.addedColumns.length} column(s)`
    )

    yield* config.dialect === 'sqlite'
      ? runSqlite(config, plan, ctx, runtime)
      : runPostgres(config, plan, ctx, runtime)

    return result
  })

export const SchemaMigratorLive = Layer.succeed(
  SchemaMigrator,
  SchemaMigrator.of({ applyAdditive })
)
