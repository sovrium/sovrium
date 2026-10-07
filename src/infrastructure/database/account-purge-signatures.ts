/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The signatures half of an erasure: every `signature` cell the erased person
 * gave — found by its image, an object she uploaded — loses her name and its
 * image key, and keeps what she agreed to (`signature-erasure-service.ts`).
 *
 * Runs inside the erasure transaction, BEFORE her objects are removed, and
 * writes the cell directly: the write-once rule binds user writes, and this is
 * not one. The image object itself goes with every other object she uploaded
 * (`account-purge-objects.ts`).
 */

import { sql } from 'drizzle-orm'
import { sanitizeTableName } from '@/domain/kernel/sql/table-naming'
import { erasedSignature } from '@/domain/models/app/tables/fields/field-types/media/signature-erasure-service'
import { executeRaw, type RawSqlRunner } from './sql/dialect-execute'
import { getExistingColumnNames } from './sql/dialect-introspection'
import { jsonbLiteral } from './sql/sql-utils'
import type { DrizzleTransaction } from '@/infrastructure/database'

/** One app table and its `signature` columns. */
export interface SignatureColumns {
  readonly name: string
  readonly signatureColumns?: readonly string[]
}

/** The `signature` fields of one declared table. */
export const signatureFieldNames = (
  tables:
    | ReadonlyArray<{
        readonly name: string
        readonly fields: ReadonlyArray<{ readonly name: string; readonly type: string }>
      }>
    | undefined,
  tableName: string
): readonly string[] =>
  (tables?.find((table) => table.name === tableName)?.fields ?? [])
    .filter((field) => field.type === 'signature')
    .map((field) => field.name)

/** Redact one column of one table: every cell whose image is hers. */
async function redactColumn(
  tx: Readonly<DrizzleTransaction>,
  table: string,
  column: string,
  uploadedKeys: ReadonlySet<string>
): Promise<void> {
  // eslint-disable-next-line sovrium/no-double-assertion -- a raw SELECT's rows are untyped; the two columns it names are read below
  const rows = (await executeRaw(
    tx,
    sql`SELECT id, ${sql.identifier(column)} AS cell FROM ${sql.identifier(table)} WHERE ${sql.identifier(column)} IS NOT NULL`
  )) as unknown as readonly { readonly id: unknown; readonly cell: unknown }[]
  for (const row of rows) {
    const erased = erasedSignature(row.cell, uploadedKeys)
    if (erased === undefined) continue
    await executeRaw(
      tx,
      sql`UPDATE ${sql.identifier(table)} SET ${sql.identifier(column)} = ${jsonbLiteral(erased)} WHERE id = ${row.id}`
    )
  }
}

/**
 * Strip the erased person from every signature she gave, across the app's
 * tables. A no-op when she uploaded nothing or no table has a signature field.
 */
export async function redactErasedSignatures(
  tx: Readonly<DrizzleTransaction>,
  tables: readonly SignatureColumns[],
  uploadedKeys: readonly string[]
): Promise<void> {
  if (uploadedKeys.length === 0) return
  const keys = new Set(uploadedKeys)
  // eslint-disable-next-line sovrium/no-double-assertion -- the transaction handle is the RawSqlRunner `account-purge.ts` drives the same way
  const runner = tx as unknown as RawSqlRunner
  for (const table of tables) {
    const name = sanitizeTableName(table.name)
    const columns = table.signatureColumns ?? []
    if (name.length === 0 || columns.length === 0) continue
    const existing = await getExistingColumnNames(runner, name, columns)
    for (const column of columns.filter((c) => existing.has(c))) {
      await redactColumn(tx, name, column, keys)
    }
  }
}
