/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The view rebuilds `sovrium migrate --dry-run` reports — split from
 * `schema-dry-run.ts` as its relation half was (`schema-dry-run-relations.ts`).
 */

import { Effect } from 'effect'
import { quoteSqlIdentifier } from '@/domain/kernel/sql/sql-formatting'
import { sanitizeTableName } from '@/domain/kernel/sql/table-naming'
import * as lookupViewGenerators from '../lookup/lookup-view-generators'
import { SQLExecutionError } from '../sql/sql-execution'
import { generateSchemaChecksum, getStoredChecksum } from './migration-audit-trail'
import { findStaleViewDefinition } from './view-definition-drift'
import type { TableChange } from './schema-dry-run'
import type { TransactionLike } from '../sql/sql-execution'
import type { App } from '@/domain/models/app'
import type { Table } from '@/domain/models/app/tables'
import type { DatabaseDialectConfig } from '@/domain/models/process-env/database/database-dialect'

/**
 * Whether every installed view (and its `INSTEAD OF` objects) is the one this
 * binary generates — the same comparison the apply path's fast path makes
 * (`view-definition-drift.ts`). A comparison that cannot run (a PostgreSQL role
 * without `TEMP`) answers `false`, as the apply path does: it runs the full
 * migration then.
 */
const installedViewsCurrent = (
  tx: TransactionLike,
  tables: readonly Table[],
  dialect: DatabaseDialectConfig['dialect']
): Effect.Effect<boolean, never> =>
  Effect.tryPromise({
    try: () => findStaleViewDefinition(tx, tables, dialect),
    catch: (cause) =>
      new SQLExecutionError({ message: 'Could not compare the installed views', cause }),
  }).pipe(
    Effect.map((stale) => stale === undefined),
    // effect-swallow: the apply path declines its fast path when it cannot compare, so "not current" (every view rebuilt) is the faithful plan, not a hidden failure.
    Effect.orElseSucceed(() => false)
  )

/**
 * The lookup VIEWs a full migration would rebuild — every view-backed table's,
 * because Step 5.5 drops them all before the base tables change.
 *
 * Empty when the migration would take the checksum fast path: the stored
 * checksum equals this config's AND every installed view is the one this
 * binary writes. An upgrade that changes how a view is written runs the full
 * migration on an unchanged config, so the plan names those rebuilds too. A
 * stored checksum that cannot be read counts as "differs": the apply path
 * would run the full migration in that case too.
 */
export const planViewRebuilds = (
  tx: TransactionLike,
  app: App,
  tables: readonly Table[],
  dialect: DatabaseDialectConfig['dialect']
): Effect.Effect<readonly TableChange[], never> =>
  Effect.gen(function* () {
    const stored = yield* getStoredChecksum(tx).pipe(
      // effect-swallow: an unreadable stored checksum is the pre-upgrade state (the checksum table does not exist yet), and the apply path reads it the same way — as "run the full migration" — so "differs" is the faithful answer, not a hidden failure.
      Effect.orElseSucceed(() => undefined)
    )
    if (
      stored === generateSchemaChecksum(app) &&
      (yield* installedViewsCurrent(tx, tables, dialect))
    )
      return []
    return tables
      .filter((table) => lookupViewGenerators.shouldUseView(table))
      .map((table): TableChange => ({
        table: table.name,
        kind: 'view',
        statements: [
          `DROP VIEW IF EXISTS ${quoteSqlIdentifier(sanitizeTableName(table.name))}`,
          lookupViewGenerators.generateLookupViewSQL(table, tables),
        ],
        unsimulated: false,
        refusals: [],
      }))
  })
