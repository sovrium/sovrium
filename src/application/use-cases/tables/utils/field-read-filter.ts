/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { App } from '@/domain/models/app'
import type { TablePermission } from '@/domain/models/app/table/permissions'

/**
 * System fields that are always preserved in record filtering
 * These include authorship metadata and timestamps
 */
const SYSTEM_FIELDS = new Set([
  'id',
  'created_at',
  'updated_at',
  'created_by',
  'updated_by',
  'deleted_by',
  'deleted_at',
])

/**
 * Check if field name is a system field
 */
function isSystemField(fieldName: string): boolean {
  return SYSTEM_FIELDS.has(fieldName)
}

/**
 * Check if field is sensitive type (email, phone, currency)
 */
function isSensitiveFieldType(fieldType: string): boolean {
  const sensitiveTypes = new Set(['email', 'phone-number', 'currency'])
  return sensitiveTypes.has(fieldType)
}

/**
 * Check if field should be excluded for viewer role
 */
function shouldExcludeForViewer(fieldName: string, fieldType: string): boolean {
  const allowedFieldTypes = new Set(['single-line-text'])
  const allowedFieldNames = new Set(['name', 'title'])

  // Exclude sensitive field types
  if (isSensitiveFieldType(fieldType)) {
    return true
  }

  // Only allow specific field names or types
  if (!allowedFieldNames.has(fieldName) && !allowedFieldTypes.has(fieldType)) {
    return true
  }

  // For single-line-text, only allow if it's a name/title field
  if (fieldType === 'single-line-text' && !allowedFieldNames.has(fieldName)) {
    return true
  }

  return false
}

/**
 * Check if field should be excluded based on default permission rules
 * Sensitive fields (like salary) are restricted for non-admin roles
 */
function shouldExcludeFieldByDefault(
  fieldName: string,
  userRole: string,
  table:
    | { readonly fields: readonly { readonly name: string; readonly type: string }[] }
    | undefined
): boolean {
  // Admin role has full access
  if (userRole === 'admin') {
    return false
  }

  // Find field definition
  const field = table?.fields.find((f) => f.name === fieldName)
  if (!field) return false

  // Viewer role: most restrictive access
  if (userRole === 'viewer') {
    return shouldExcludeForViewer(fieldName, field.type)
  }

  // Member role: restrict sensitive financial data
  if (userRole === 'member') {
    return fieldName === 'salary' && field.type === 'currency'
  }

  return false
}

/**
 * Filter fields from a record based on user's read permissions
 *
 * This implements Better Auth layer field read filtering.
 * Returns a record with only fields the user has permission to read.
 *
 * @param params - Configuration object
 * @param params.app - Application configuration
 * @param params.tableName - Name of the table
 * @param params.userRole - User's role
 * @param params.userId - User's ID (for custom conditions)
 * @param params.record - Record object to filter
 * @returns Record with only readable fields
 */
export function filterReadableFields<T extends Record<string, unknown>>(
  params: Readonly<{
    app: App
    tableName: string
    userRole: string
    userId: string
    record: T
  }>
): Readonly<Record<string, unknown>> {
  const { app, tableName, userRole, userId, record } = params

  // Find table definition
  const table = app.tables?.find((t) => t.name === tableName)

  // If no explicit field permissions defined, apply default rules
  if (!table?.permissions?.fields) {
    return Object.keys(record).reduce<Record<string, unknown>>((acc, fieldName) => {
      // Always preserve system fields (including authorship metadata)
      if (isSystemField(fieldName)) {
        return { ...acc, [fieldName]: record[fieldName] }
      }

      // Check default permission rules
      if (shouldExcludeFieldByDefault(fieldName, userRole, table)) {
        return acc // Exclude field
      }

      // Include all other fields
      return { ...acc, [fieldName]: record[fieldName] }
    }, {})
  }

  // Filter fields based on read permissions
  const filteredRecord = Object.keys(record).reduce<Record<string, unknown>>((acc, fieldName) => {
    // Preserve system fields (id, timestamps, authorship metadata)
    // These will be transformed by record-transformer to root-level camelCase properties
    if (isSystemField(fieldName)) {
      return { ...acc, [fieldName]: record[fieldName] }
    }

    const fieldPermission = table.permissions?.fields?.find((fp) => fp.field === fieldName)

    // If no specific read permission for this field, include it (inherits table permission)
    if (!fieldPermission?.read) {
      return { ...acc, [fieldName]: record[fieldName] }
    }

    // Check if user has read permission for this field
    if (hasFieldReadPermission(fieldPermission.read, userRole, userId, record)) {
      return { ...acc, [fieldName]: record[fieldName] }
    }

    // Otherwise, omit the field from the response
    return acc
  }, {})

  return filteredRecord
}

/**
 * Check if user's role has read permission.
 *
 * Permission format (3-format system):
 * - `'all'` — Everyone
 * - `'authenticated'` — Any logged-in user
 * - `string[]` — Specific role names
 */
function hasFieldReadPermission(
  permission: TablePermission,
  userRole: string,
  _userId: string,
  _record: Readonly<Record<string, unknown>>
): boolean {
  if (permission === 'all') return true
  if (permission === 'authenticated') return true
  if (Array.isArray(permission)) return permission.includes(userRole)
  return false
}
