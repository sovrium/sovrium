/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Fields } from '@/domain/models/app/tables/fields'

/**
 * Check if field is a user reference field (created-by, updated-by, deleted-by)
 * Used to determine if Better Auth users table is required
 * Exported for use in schema-initializer
 */
export const isUserReferenceField = (field: Fields[number]): boolean =>
  field.type === 'created-by' || field.type === 'updated-by' || field.type === 'deleted-by'

/**
 * Check if field is an auto-populated user reference field (created-by only)
 * created-by is always NOT NULL because it's auto-populated on creation
 * Note: updated-by is NOT included because it's only set during update (nullable until first update)
 * Note: deleted-by is NOT included because it's only set during soft-delete (nullable)
 */
export const isAutoPopulatedUserField = (field: Fields[number]): boolean =>
  field.type === 'created-by'

/**
 * Check if field is a user field (type: 'user')
 * Used to generate FOREIGN KEY constraints to users table
 * Exported for use in schema-initializer
 */
export const isUserField = (field: Fields[number]): boolean => field.type === 'user'

/**
 * Check if field is a relationship field (type: 'relationship')
 * Used to generate FOREIGN KEY constraints to related tables
 */
export const isRelationshipField = (
  field: Fields[number]
): field is Fields[number] & { type: 'relationship'; relatedTable: string } =>
  field.type === 'relationship' && 'relatedTable' in field && typeof field.relatedTable === 'string'

/**
 * Check if a relationship field creates a foreign key constraint on the owning table.
 *
 * Only `many-to-one` relationships (and relationships without an explicit
 * `relationType`) place a FK column on the owning table. `one-to-many`
 * relationships store the FK on the related (child) table, and `many-to-many`
 * relationships use a junction table — neither creates a FK (nor a real table
 * dependency) on the owning side.
 *
 * Used both to generate FK constraints (`sql-key-constraints`, `index-generators`)
 * and to build the table-creation dependency graph (`schema-dependency-sorting`),
 * so the two stay consistent and phantom dependency edges are not introduced.
 */
export const relationshipFieldCreatesForeignKey = (field: Fields[number]): boolean =>
  !('relationType' in field) ||
  (field.relationType !== 'one-to-many' && field.relationType !== 'many-to-many')

/**
 * Check if field is an auto-timestamp field (created-at, updated-at)
 */
export const isAutoTimestampField = (field: Fields[number]): boolean =>
  field.type === 'created-at' || field.type === 'updated-at'

/**
 * Check if field should use SERIAL type
 */
export const shouldUseSerial = (field: Fields[number], isPrimaryKey: boolean): boolean =>
  field.type === 'autonumber' || (field.type === 'integer' && isPrimaryKey)

/**
 * Check if field should be NOT NULL
 * Auto-managed fields (created-at, updated-at, created-by) and required fields are NOT NULL
 * Note: When hasAuthConfig is false, created-by becomes NULLABLE (NULL when no auth)
 * Note: updated-by is always nullable because it's only set during update (NULL until first update)
 * Note: deleted-by is always nullable because it's only set during soft-delete
 * Exported for use in schema-migration-helpers for nullability change detection
 *
 * @param hasAuthConfig - Whether auth is configured (default true). When false, auto-populated
 *   user fields (created-by) become nullable to support apps without authentication.
 */
export const isFieldNotNull = (
  field: Fields[number],
  isPrimaryKey: boolean,
  hasAuthConfig: boolean = true
): boolean => {
  // Auto-managed timestamp fields are always NOT NULL (created-at, updated-at)
  if (isAutoTimestampField(field)) return true
  // Auto-populated user fields (created-by) are NOT NULL only when auth is configured
  // updated-by is excluded because it's only set during update (nullable until first update)
  // deleted-by is excluded because it's only populated during soft-delete
  if (isAutoPopulatedUserField(field)) return hasAuthConfig
  // Primary key fields are always NOT NULL
  if (isPrimaryKey) return true
  // Check required property
  return 'required' in field && field.required === true
}

/**
 * Check if field is a many-to-many relationship
 * Many-to-many relationships don't create columns in the table, they use junction tables instead
 */
export const isManyToManyRelationship = (
  field: Fields[number]
): field is Fields[number] & {
  type: 'relationship'
  relatedTable: string
  relationType: 'many-to-many'
} =>
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
 *
 * @param field - Field configuration from table schema
 * @returns true if field needs a database column, false if UI-only/virtual
 */
export const shouldCreateDatabaseColumn = (field: Fields[number]): boolean => {
  if (field.type === 'button' || field.type === 'count') {
    return false
  }

  // For one-to-many relationships, the foreign key is in the related table, not this table
  if (
    field.type === 'relationship' &&
    'relationType' in field &&
    field.relationType === 'one-to-many'
  ) {
    return false
  }

  // For many-to-many relationships, use junction table instead of column
  if (isManyToManyRelationship(field)) {
    return false
  }

  return true
}
