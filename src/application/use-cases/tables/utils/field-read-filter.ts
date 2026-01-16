/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { App } from '@/domain/models/app'
import type { TablePermission } from '@/domain/models/app/table/permissions'

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
export function filterReadableFields<T extends Record<string, unknown>>(params: {
  app: App
  tableName: string
  userRole: string
  userId: string
  record: T
}): Record<string, unknown> {
  const { app, tableName, userRole, userId, record } = params

  // Find table definition
  const table = app.tables?.find((t) => t.name === tableName)
  if (!table?.permissions?.fields) {
    return record // No field permissions defined, return all fields
  }

  // Filter fields based on read permissions
  const filteredRecord = Object.keys(record).reduce<Record<string, unknown>>((acc, fieldName) => {
    // Always preserve system fields required for API response
    if (fieldName === 'id' || fieldName === 'created_at' || fieldName === 'updated_at') {
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
