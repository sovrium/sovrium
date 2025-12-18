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
 * Check if field is an auto-populated user reference field (created-by, updated-by)
 * These fields are always NOT NULL because they're auto-populated on create/update
 * Note: deleted-by is NOT included because it's only set during soft-delete (nullable)
 */
export const isAutoPopulatedUserField = (field: Fields[number]): boolean =>
  field.type === 'created-by' || field.type === 'updated-by'

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
 * Note: deleted-by is nullable because it's only set during soft-delete
 * Exported for use in schema-migration-helpers for nullability change detection
 */
export const isFieldNotNull = (field: Fields[number], isPrimaryKey: boolean): boolean => {
  // Auto-managed fields are always NOT NULL (created-at, updated-at, created-by, updated-by)
  // deleted-by is excluded because it's only populated during soft-delete
  if (isAutoTimestampField(field) || isAutoPopulatedUserField(field)) return true
  // Primary key fields are always NOT NULL
  if (isPrimaryKey) return true
  // Check required property
  return 'required' in field && field.required === true
}
