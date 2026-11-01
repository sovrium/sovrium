/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The `--dry-run` plan for Step 4: the tables the config no longer declares,
 * each a `drop`, refused when it still holds rows and the run did not consent.
 *
 * Split out of `schema-dry-run.ts`.
 */

import { Effect } from 'effect'
import {
  findObsoleteTables,
  obsoleteTableDropStatement,
  type ObsoleteTable,
} from '../schema-migration'
import {
  formatPopulatedDropRefusal,
  storedTableIdentityFor,
} from '../schema-migration/table-classification'
import { type TableRenameStep } from '../schema-migration/table-operations'
import type { PlanOptions, TableChange } from './schema-dry-run'
import type { TransactionLike } from '../sql/sql-execution'
import type { Table } from '@/domain/models/app/tables'
import type { DatabaseDialect } from '@/domain/models/process-env/database/database-dialect'

/** A `drop` change for one obsolete table, refused when it holds rows and was not consented to. */
const planDrop = (
  entry: ObsoleteTable,
  options: PlanOptions,
  previousSchema: { readonly tables: readonly object[] } | undefined,
  dialect: DatabaseDialect
): TableChange => ({
  table: entry.table,
  rows: entry.rows,
  kind: 'drop',
  statements: [obsoleteTableDropStatement(entry.table, dialect)],
  unsimulated: false,
  refusals:
    entry.rows > 0 && options.allowDestructive !== true
      ? [
          formatPopulatedDropRefusal(
            entry.table,
            entry.rows,
            storedTableIdentityFor(entry.table, previousSchema)
          ),
        ]
      : [],
})

/**
 * The drops Step 4 would run. The same read the apply path makes
 * (`findObsoleteTables`), so the plan names exactly the drop the migration would
 * run — or refuse.
 *
 * A failure to LIST the tables is reported as a refusal rather than as an empty
 * list: "nothing would be dropped" is a claim, and a planner that could not look
 * cannot make it.
 */
export const planDrops = (
  tx: TransactionLike,
  tables: readonly Table[],
  options: PlanOptions,
  context: {
    readonly previousSchema: { readonly tables: readonly object[] } | undefined
    readonly renames: readonly TableRenameStep[]
  }
): Effect.Effect<readonly TableChange[], never> =>
  findObsoleteTables(tx, tables).pipe(
    Effect.map((obsolete) =>
      obsolete
        // A relation Step 3.5 renames is gone before Step 4 lists the leftovers.
        .filter(
          (entry) =>
            !entry.engineManaged && !context.renames.some((step) => step.from === entry.table)
        )
        .map((entry) => planDrop(entry, options, context.previousSchema, tx.dialect))
    ),
    Effect.catch((error) =>
      Effect.succeed([
        {
          table: '(tables no longer in the config)',
          kind: 'drop' as const,
          statements: [],
          unsimulated: true,
          refusals: [`Could not list the tables the config no longer declares: ${error.message}`],
        },
      ])
    )
  )
