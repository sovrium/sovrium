/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isUserListField } from '@/domain/models/app/tables/user-list-field-service'
import { getPhysicalTableName } from '@/infrastructure/database/lookup/lookup-view-generators'
import { logDebug } from '@/infrastructure/logging/logger'
import {
  findDriftedFormulaColumns,
  findOneAccountListColumns,
} from '../schema-migration/type-utils'
import type { Table } from '@/domain/models/app/tables'

/**
 * Whether every column a past version stored in another shape is of the type
 * this version declares — the checksum hashes the config alone, so a deployment
 * left that way would otherwise take the fast path on every boot:
 *   - a formula column an earlier version converted to TEXT
 *     (`findDriftedFormulaColumns`);
 *   - a `user` field holding several people that an older binary stored as ONE
 *     account (`findOneAccountListColumns`). The full migration makes it a list,
 *     rebuilding the table's view around the change, which the boot-time
 *     reconciler cannot do for a view-backed table.
 * One catalog read serves both; it is empty on SQLite, which has neither drift.
 */
export const columnTypesCurrent = async (
  liveColumnTypes: () => Promise<ReadonlyMap<string, ReadonlyMap<string, string>>>,
  tables: readonly Table[]
): Promise<boolean> => {
  const checked = tables.filter((table) =>
    table.fields.some((field) => field.type === 'formula' || isUserListField(field))
  )
  if (checked.length === 0) return true
  const live = await liveColumnTypes()
  const drifted = checked.find((table) => {
    const types = live.get(getPhysicalTableName(table)) ?? new Map<string, string>()
    return (
      findDriftedFormulaColumns(table.fields, types).length > 0 ||
      findOneAccountListColumns(table.fields, types).length > 0
    )
  })?.name
  if (drifted === undefined) return true
  logDebug(
    '[schema] checksum matches but a column is not of the type this version declares — full migration',
    { table: drifted }
  )
  return false
}
