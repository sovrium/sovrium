/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { planViewTopology, type ViewTopologyStep } from '../schema-migration'
import {
  detectAmbiguousTableRenames,
  detectTableRenames,
} from '../schema-migration/rename-detection'
import { planTableRenames, type TableRenameStep } from '../schema-migration/table-operations'
import { getExistingTableNames, getExistingViews } from '../sql/sql-execution'
import type { TransactionLike } from '../sql/sql-execution'
import type { Table } from '@/domain/models/app/tables'
import type { AuthoredTableIds } from '@/domain/models/app/tables/authored-table-ids-service'

/** The live table and view names, as the migration's steps read them. */
interface Catalog {
  readonly tables: ReadonlySet<string>
  readonly views: ReadonlySet<string>
}

/** The catalog once Step 3.5 has run: each renamed relation under its new name. */
const afterTableRenames = (catalog: Catalog, renames: readonly TableRenameStep[]): Catalog => {
  const from = new Set(renames.map((step) => step.from))
  const droppedViews = new Set(renames.flatMap((step) => step.droppedView ?? []))
  return {
    tables: new Set([
      ...[...catalog.tables].filter((name) => !from.has(name)),
      ...renames.map((step) => step.to),
    ]),
    views: new Set([...catalog.views].filter((name) => !droppedViews.has(name))),
  }
}

/** What Steps 3.5 and 5.5 would do to the SET of relations, before any table changes. */
export interface RelationPlan {
  /** Step 3.5. Empty when the renames form a cycle, which {@link ambiguous} names. */
  readonly renames: readonly TableRenameStep[]
  /** Tables exchanging names in one edit: the migration refuses them. */
  readonly ambiguous: readonly string[]
  /** Step 5.5, planned over the catalog as Step 3.5 leaves it. */
  readonly steps: readonly ViewTopologyStep[]
  /** Why the catalog could not be read, when it could not. */
  readonly failure?: string
}

/**
 * The Step 3.5 renames and Step 5.5 topology steps this migration would run,
 * from the SAME pure decisions the apply path executes (`planTableRenames`,
 * `planViewTopology`), over the same live table and view names — so the plan
 * cannot name a rename the migration would not run, or miss one it would.
 *
 * Renames are detected with `authoredIds`, the ids the author WROTE, which the
 * decode returns beside the config — not read off the decoded table OBJECTS,
 * where a copy made on the way (`applySchemaDefaults`) reads as "no id
 * written", so a rename under an authored id would be reported by `--dry-run`
 * and `--check`, and refused by the `--watch` pre-flight, as a drop of a
 * populated table. An id in `authoredIds` survives the copy.
 *
 * A failure to read the catalog is reported rather than read as "no rename":
 * the planner that could not look cannot claim the rows stay put.
 */
export const planRelationSet = (
  tx: TransactionLike,
  tables: readonly Table[],
  previousSchema: { readonly tables: readonly object[] } | undefined,
  authoredIds: AuthoredTableIds
): Effect.Effect<RelationPlan, never> =>
  Effect.gen(function* () {
    const catalog: Catalog = {
      tables: new Set(yield* getExistingTableNames(tx)),
      views: new Set(yield* getExistingViews(tx)),
    }
    const ambiguous = detectAmbiguousTableRenames(tables, previousSchema, authoredIds)
    const renames =
      ambiguous.length > 0
        ? []
        : planTableRenames(detectTableRenames(tables, previousSchema, authoredIds), catalog, tables)
    return {
      renames,
      ambiguous,
      steps: planViewTopology(tables, afterTableRenames(catalog, renames)),
    }
  }).pipe(
    Effect.catch((error) =>
      Effect.succeed({ renames: [], ambiguous: [], steps: [], failure: error.message })
    )
  )
