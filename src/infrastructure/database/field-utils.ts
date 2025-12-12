/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Fields } from '@/domain/models/app/table/fields'

/**
 * Check if field is a many-to-many relationship
 * Many-to-many relationships don't create columns in the table, they use junction tables instead
 */
export const isManyToManyRelationship = (
  field: Fields[number]
): field is Fields[number] & { type: 'relationship'; relatedTable: string; relationType: 'many-to-many' } =>
  field.type === 'relationship' &&
  'relatedTable' in field &&
  typeof field.relatedTable === 'string' &&
  'relationType' in field &&
  field.relationType === 'many-to-many'

/**
 * Check if field should create a database column
 *
 * Some field types are UI-only and don't need database columns:
 * - button: UI-only action field (no data stored)
 * - count: Virtual/computed field (calculated from relationships)
 * - relationship with relationType='one-to-many': Foreign key is in the related table, not this table
 * - relationship with relationType='many-to-many': Uses junction table, no column in this table
 *
 * This utility is used by:
 * - table-operations.ts: CREATE TABLE generation
 * - schema-migration-helpers.ts: ALTER TABLE generation
 * - field-permission-generators.ts: Column-level permission grants
 *
 * @param field - Field configuration from table schema
 * @returns true if field needs a database column, false if UI-only/virtual
 */
export const shouldCreateDatabaseColumn = (field: Fields[number]): boolean => {
  if (field.type === 'button' || field.type === 'count') {
    return false
  }

  // For one-to-many relationships, the foreign key is in the related table, not this table
  if (field.type === 'relationship' && 'relationType' in field && field.relationType === 'one-to-many') {
    return false
  }

  // For many-to-many relationships, use junction table instead of column
  if (isManyToManyRelationship(field)) {
    return false
  }

  return true
}
