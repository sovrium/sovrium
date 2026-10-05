/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isResolvableColumnName } from '@/domain/models/app/tables/system-fields'

/** The part of a composite `foreignKeys` entry the reference check reads. */
interface ForeignKeyForValidation {
  readonly name: string
  readonly fields: ReadonlyArray<string>
  readonly referencedTable: string
  readonly referencedFields: ReadonlyArray<string>
}

/** The part of a table the reference check reads. */
interface TableForValidation {
  readonly name: string
  readonly fields: ReadonlyArray<{ readonly name: string }>
  readonly foreignKeys?: ReadonlyArray<ForeignKeyForValidation>
}

/** The columns a table can be referenced by: its declared fields and the system columns. */
const resolvesOn = (table: TableForValidation, column: string): boolean =>
  isResolvableColumnName(new Set(table.fields.map((field) => field.name)), column)

/** What is wrong with one composite foreign key, or `undefined` when it holds. */
const checkForeignKey = (
  table: TableForValidation,
  foreignKey: ForeignKeyForValidation,
  tablesByName: ReadonlyMap<string, TableForValidation>
): string | undefined => {
  const subject = `Foreign key "${foreignKey.name}" on table "${table.name}"`
  const missingField = foreignKey.fields.find((field) => !resolvesOn(table, field))
  if (missingField !== undefined) {
    return `${subject}: field "${missingField}" does not exist on the table`
  }
  const referenced = tablesByName.get(foreignKey.referencedTable)
  if (referenced === undefined) {
    return `${subject}: referencedTable "${foreignKey.referencedTable}" does not exist`
  }
  const missingReferenced = foreignKey.referencedFields.find(
    (field) => !resolvesOn(referenced, field)
  )
  if (missingReferenced !== undefined) {
    return `${subject}: referenced field "${missingReferenced}" does not exist on table "${referenced.name}"`
  }
  if (foreignKey.fields.length !== foreignKey.referencedFields.length) {
    return `${subject}: fields lists ${foreignKey.fields.length} column(s) but referencedFields lists ${foreignKey.referencedFields.length}; they are matched by position`
  }
  return undefined
}

/**
 * Check that every composite `foreignKeys` entry names columns and a table that
 * exist in the config.
 *
 * The entry reaches the `CREATE TABLE` as identifiers, and its schema constrains
 * none of `fields`, `referencedTable` or `referencedFields` beyond being
 * non-empty — so a misspelt table surfaced as a driver error at boot, and a
 * crafted one as whatever SQL it spelled. Requiring each name to resolve against
 * the config refuses both at decode, with a message naming the entry. The
 * generator also quotes them; this is the half that says what is wrong.
 *
 * `referencedTable` is a CONFIG table name, like a relationship's `relatedTable`.
 * Returns the first problem found, or `undefined`.
 */
export const validateCompositeForeignKeys = (
  tables: ReadonlyArray<TableForValidation>
): string | undefined => {
  const tablesByName = new Map(tables.map((table) => [table.name, table]))
  return tables
    .flatMap((table) =>
      (table.foreignKeys ?? []).map((foreignKey) =>
        checkForeignKey(table, foreignKey, tablesByName)
      )
    )
    .find((problem) => problem !== undefined)
}
