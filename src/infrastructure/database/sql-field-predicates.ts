/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Fields } from '@/domain/models/app/table/fields'

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
 * Auto-managed fields (created-at, updated-at, created-by, updated-by) and required fields are NOT NULL
 * Note: When hasAuthConfig is false, created-by and updated-by become NULLABLE (NULL when no auth)
 * Note: deleted-by is always nullable because it's only set during soft-delete
 * Exported for use in schema-migration-helpers for nullability change detection
 *
 * @param hasAuthConfig - Whether auth is configured (default true). When false, auto-populated
 *   user fields (created-by, updated-by) become nullable to support apps without authentication.
 */
export const isFieldNotNull = (
  field: Fields[number],
  isPrimaryKey: boolean,
  hasAuthConfig: boolean = true
): boolean => {
  // Auto-managed timestamp fields are always NOT NULL (created-at, updated-at)
  if (isAutoTimestampField(field)) return true
  // Auto-populated user fields (created-by, updated-by) are NOT NULL only when auth is configured
  // deleted-by is excluded because it's only populated during soft-delete
  if (isAutoPopulatedUserField(field)) return hasAuthConfig
  // Primary key fields are always NOT NULL
  if (isPrimaryKey) return true
  // Check required property
  return 'required' in field && field.required === true
}
