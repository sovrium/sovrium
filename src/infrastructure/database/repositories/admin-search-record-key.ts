/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The index key of a record: its table and its id. The search index is unique
 * on `(type, entity_id)`, and record ids repeat across tables — every table's
 * first record is `1` — so a bare id let one table's row overwrite another's.
 * The table name holds no `:` (it is a sanitized identifier), so the key
 * splits back unambiguously.
 */
export const recordIndexKey = (tableName: string, id: string): string => `${tableName}:${id}`

/** The id a search hit answers with: a record's own id, any other entity's key as stored. */
export const entityIdOfIndexRow = (type: unknown, storedId: string): string =>
  type === 'record' ? storedId.slice(storedId.indexOf(':') + 1) : storedId
