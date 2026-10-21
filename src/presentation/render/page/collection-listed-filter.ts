/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { readRowsForCaller } from '@/presentation/render/resolve/record-read-gate'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { Page } from '@/domain/models/app/pages'
import type { DataFilter } from '@/domain/models/app/pages/components/data-source'
import type { DataSourceDb } from '@/presentation/render/resolve/data-source-contracts'
import type { RowLevelReadCheck } from '@/presentation/render/resolve/row-rule-read-check'

/** The part of a collection's read gate the filter check reads and extends. */
interface ListedFilterGate {
  readonly refuseRecord?: true
  readonly rowLevelReadCheck?: RowLevelReadCheck
}

/**
 * The gate, with the collection's filter also judged as the visitor's records
 * list judges it wherever it names a count or lookup her list reads narrowed
 * (`db.readQueryMasks`): a record that list leaves out answers as a missing
 * one, as the feed, the sitemap and the list leave it out. A filter naming no
 * such field is judged on the stored row alone, as before.
 */
export function withListedFilter<G extends ListedFilterGate>(
  gate: G,
  ctx: {
    readonly page: Page
    readonly app: App
    readonly session: SessionInfo | undefined
    readonly db: DataSourceDb
  }
): G {
  const { page, app, session, db } = ctx
  const filter = page.collection?.filter as readonly DataFilter[] | undefined
  const readMasks = db.readQueryMasks
  if (gate.refuseRecord === true || page.collection === undefined) return gate
  if (filter === undefined || filter.length === 0 || readMasks === undefined) return gate
  const tableName = page.collection.table
  const listed = async (record: Readonly<Record<string, unknown>>): Promise<boolean> => {
    const masks = await readMasks(app, tableName, session, { filter })
    if (masks.length === 0) return true
    const own = { field: 'id', operator: 'in' as const, value: [String(record['id'])] }
    const query = { filter: [...filter, own], pageSize: 1, page: 1 }
    // The masks just read steer the one-row read too: computed once per record.
    const steered = { ...db, readQueryMasks: () => Promise.resolve(masks) }
    return (
      (await readRowsForCaller({ app, tableName, session, db: steered, query })).rows.length > 0
    )
  }
  const rowCheck = gate.rowLevelReadCheck
  return {
    ...gate,
    rowLevelReadCheck: async (record) =>
      (await listed(record)) && (rowCheck === undefined || (await rowCheck(record))),
  }
}
