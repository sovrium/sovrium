/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * SQL Generators - PostgreSQL DDL Generation for Sovrium Tables
 *
 * This module coordinates SQL generation for table creation, constraints, and relationships.
 * Implementation is split across focused modules:
 * - sql-type-mappings.ts: Field type → PostgreSQL type conversions
 * - sql-field-predicates.ts: Field type checking functions
 * - sql-column-generators.ts: Column definition generation
 * - sql-check-constraints.ts: CHECK constraint generation
 * - sql-key-constraints.ts: UNIQUE, FOREIGN KEY, PRIMARY KEY constraints
 * - sql-junction-tables.ts: Many-to-many relationship tables
 */

import {
  generateArrayConstraints,
  generateBarcodeConstraints,
  generateColorConstraints,
  generateCustomCheckConstraints,
  generateEnumConstraints,
  generateMultipleAttachmentsConstraints,
  generateNumericConstraints,
  generateProgressConstraints,
  generateRichTextConstraints,
  generateStatusConstraints,
} from './sql-check-constraints'
import {
  generateCompositeUniqueConstraints,
  generateForeignKeyConstraints,
  generatePrimaryKeyConstraint,
  generateUniqueConstraints,
} from './sql-key-constraints'
import type { Table } from '@/domain/models/app/table'

// Re-export from sql-type-mappings
export { mapFieldTypeToPostgres } from './sql-type-mappings'

// Re-export from sql-field-predicates
export {
  isFieldNotNull,
  isRelationshipField,
  isUserField,
  isUserReferenceField,
} from './sql-field-predicates'

// Re-export from sql-column-generators
export { generateColumnDefinition } from './sql-column-generators'

// Re-export from sql-key-constraints
export { generateForeignKeyConstraints, generateUniqueConstraints } from './sql-key-constraints'

// Re-export from sql-junction-tables
export {
  generateJunctionTableDDL,
  generateJunctionTableName,
  toSingular,
} from './sql-junction-tables'

/**
 * Generate table constraints (CHECK constraints, UNIQUE constraints, FOREIGN KEY, primary key, etc.)
 */
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
  ...generateStatusConstraints(table.fields),
  ...generateRichTextConstraints(table.fields),
  ...generateBarcodeConstraints(table.fields),
  ...generateColorConstraints(table.fields),
  ...generateCustomCheckConstraints(table.constraints),
  ...generatePrimaryKeyConstraint(table),
  ...generateUniqueConstraints(table.name, table.fields),
  ...generateCompositeUniqueConstraints(table),
  ...(skipForeignKeys
    ? []
    : generateForeignKeyConstraints(table.name, table.fields, tableUsesView, table.foreignKeys)),
]
