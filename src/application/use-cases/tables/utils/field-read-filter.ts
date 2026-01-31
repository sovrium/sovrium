/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { App } from '@/domain/models/app'
import type { TablePermission } from '@/domain/models/app/table/permissions'

/**
 * Check if field should be excluded based on default permission rules
 * Sensitive fields (like salary) are restricted for non-admin/owner roles
 */
function shouldExcludeFieldByDefault(
  fieldName: string,
  userRole: string,
  table:
    | { readonly fields: readonly { readonly name: string; readonly type: string }[] }
    | undefined
): boolean {
  // Admin and owner roles have full access
  if (userRole === 'admin' || userRole === 'owner') {
    return false
  }

  // Find field definition
  const field = table?.fields.find((f) => f.name === fieldName)
  if (!field) return false

  // Viewer role: most restrictive access (only name and basic text fields)
  if (userRole === 'viewer') {
    // Viewer can only read basic name/title fields
    const allowedFieldTypes = ['single-line-text']
    const allowedFieldNames = ['name', 'title']

    // Exclude email, phone, salary, and other sensitive fields
    if (field.type === 'email' || field.type === 'phone-number' || field.type === 'currency') {
      return true
    }

    // Only allow specific field names or types
    if (!allowedFieldNames.includes(fieldName) && !allowedFieldTypes.includes(field.type)) {
      return true
    }

    // For single-line-text, only allow if it's a name/title field
    if (field.type === 'single-line-text' && !allowedFieldNames.includes(fieldName)) {
      return true
    }
  }

  // Member role: restrict sensitive financial data
  if (userRole === 'member') {
    // Restrict salary fields for member roles
    if (fieldName === 'salary' && field.type === 'currency') {
      return true
    }
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
): Record<string, unknown> {
  const { app, tableName, userRole, userId, record } = params

  // Find table definition
  const table = app.tables?.find((t) => t.name === tableName)

  // If no explicit field permissions defined, apply default rules
  if (!table?.permissions?.fields) {
    return Object.keys(record).reduce<Record<string, unknown>>((acc, fieldName) => {
      // Always preserve system fields
      if (fieldName === 'id' || fieldName === 'created_at' || fieldName === 'updated_at') {
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
    // Preserve system fields (id, created_at, updated_at) for root-level properties
    // These will be transformed by record-transformer to root-level createdAt/updatedAt
    // BUT if they're also defined as table fields, they should be included in fields object
    if (fieldName === 'id') {
      return { ...acc, [fieldName]: record[fieldName] }
    }

    // For created_at and updated_at, always include them if they're in the record
    // They may be both system fields AND user-defined fields
    if (fieldName === 'created_at' || fieldName === 'updated_at') {
      return { ...acc, [fieldName]: record[fieldName] }
    }

    const fieldPermission = table.permissions?.fields?.find((fp) => fp.field === fieldName)

    // If no specific read permission for this field, include it (inherits table permission)
    if (!fieldPermission?.read) {
      return { ...acc, [fieldName]: record[fieldName] }
    }

    // Check if user has read permission for this field
    if (hasReadPermission(fieldPermission.read, userRole, userId, record)) {
      return { ...acc, [fieldName]: record[fieldName] }
    }

    // Otherwise, omit the field from the response
    return acc
  }, {})

  return filteredRecord
}

/**
 * Check if user's role has read permission
 */
function hasReadPermission(
  permission: TablePermission,
  userRole: string,
  userId: string,
  record: Record<string, unknown>
): boolean {
  switch (permission.type) {
    case 'public':
      return true

    case 'authenticated':
      return true // User is authenticated (has session)

    case 'roles':
      return permission.roles?.includes(userRole) ?? false

    case 'owner':
      // Check if user owns the record
      return record[permission.field] === userId

    case 'custom':
      // For custom conditions, check if user owns the record (simplified for owner_id pattern)
      // Full custom condition evaluation would require parsing the condition
      // For now, we check if the condition matches {userId} = owner_id pattern
      if (permission.condition.includes('{userId}') && permission.condition.includes('owner_id')) {
        return record.owner_id === userId
      }
      return false

    default:
      return false
  }
}
