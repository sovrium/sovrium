/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import {
  generateArrayConstraints,
  generateBarcodeConstraints,
  generateColorConstraints,
  generateCustomCheckConstraints,
  generateEnumConstraints,
  generateMultiSelectConstraints,
  generateMultipleAttachmentsConstraints,
  generateNumericConstraints,
  generateProgressConstraints,
  generateRichTextConstraints,
  generateStatusConstraints,
} from './sql-check-constraints'
import {
  generateForeignKeyConstraints,
  generatePrimaryKeyConstraint,
  generateUniqueConstraints,
} from './sql-key-constraints'
import type { Table } from '@/domain/models/app/tables'

export { mapFieldTypeToPostgres } from './sql-type-mappings'

export {
  isFieldNotNull,
  isRelationshipField,
  isUserField,
  isUserReferenceField,
} from './sql-field-predicates'

export { generateColumnDefinition } from './sql-column-generators'

export { generateForeignKeyConstraints, generateUniqueConstraints } from './sql-key-constraints'

export {
  generateJunctionTableDDL,
  generateJunctionTableName,
  toSingular,
} from './sql-junction-tables'

export const generateTableConstraints = (
  table: Table,
  tableUsesView?: ReadonlyMap<string, boolean>,
  skipForeignKeys?: boolean
): readonly string[] => [
  ...generateArrayConstraints(table.fields),
  ...generateMultipleAttachmentsConstraints(table.fields),
  ...generateNumericConstraints(table.fields),
  ...generateProgressConstraints(table.fields),
  ...generateEnumConstraints(table.fields),
  ...generateMultiSelectConstraints(table.fields),
  ...generateStatusConstraints(table.fields),
  ...generateRichTextConstraints(table.fields),
  ...generateBarcodeConstraints(table.fields),
  ...generateColorConstraints(table.fields),
  ...generateCustomCheckConstraints(table.constraints),
  ...generatePrimaryKeyConstraint(table),
  ...generateUniqueConstraints(table.name, table.fields),
  ...(skipForeignKeys
    ? []
    : generateForeignKeyConstraints(table.name, table.fields, tableUsesView, table.foreignKeys)),
]
