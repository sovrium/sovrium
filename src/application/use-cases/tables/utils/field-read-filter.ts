/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { App } from '@/domain/models/app'
import type { TablePermission } from '@/domain/models/app/tables/permissions'

const SYSTEM_FIELDS = new Set([
  'id',
  'created_at',
  'updated_at',
  'created_by',
  'updated_by',
  'deleted_by',
  'deleted_at',
])

function isSystemField(fieldName: string): boolean {
  return SYSTEM_FIELDS.has(fieldName)
}

function isSensitiveFieldType(fieldType: string): boolean {
  const sensitiveTypes = new Set(['email', 'phone-number', 'currency'])
  return sensitiveTypes.has(fieldType)
}

function shouldExcludeForViewer(fieldName: string, fieldType: string): boolean {
  const allowedFieldTypes = new Set(['single-line-text'])
  const allowedFieldNames = new Set(['name', 'title'])

  if (isSensitiveFieldType(fieldType)) {
    return true
  }

  if (!allowedFieldNames.has(fieldName) && !allowedFieldTypes.has(fieldType)) {
    return true
  }

  if (fieldType === 'single-line-text' && !allowedFieldNames.has(fieldName)) {
    return true
  }

  return false
}

function shouldExcludeFieldByDefault(
  fieldName: string,
  userRole: string,
  table:
    | { readonly fields: readonly { readonly name: string; readonly type: string }[] }
    | undefined
): boolean {
  if (userRole === 'admin') {
    return false
  }

  const field = table?.fields.find((f) => f.name === fieldName)
  if (!field) return false

  if (userRole === 'viewer') {
    return shouldExcludeForViewer(fieldName, field.type)
  }

  if (userRole === 'member') {
    return fieldName === 'salary' && field.type === 'currency'
  }

  return false
}

export function filterReadableFields<T extends Record<string, unknown>>(
  params: Readonly<{
    app: App
    tableName: string
    userRole: string
    record: T
  }>
): Readonly<Record<string, unknown>> {
  const { app, tableName, userRole, record } = params

  const table = app.tables?.find((t) => t.name === tableName)

  if (!table?.permissions?.fields) {
    return Object.keys(record).reduce<Record<string, unknown>>((acc, fieldName) => {
      if (isSystemField(fieldName)) {
        return { ...acc, [fieldName]: record[fieldName] }
      }

      if (shouldExcludeFieldByDefault(fieldName, userRole, table)) {
        return acc
      }

      return { ...acc, [fieldName]: record[fieldName] }
    }, {})
  }

  const filteredRecord = Object.keys(record).reduce<Record<string, unknown>>((acc, fieldName) => {
    if (isSystemField(fieldName)) {
      return { ...acc, [fieldName]: record[fieldName] }
    }

    const fieldPermission = table.permissions?.fields?.find((fp) => fp.field === fieldName)

    if (!fieldPermission?.read) {
      return { ...acc, [fieldName]: record[fieldName] }
    }

    if (hasFieldReadPermission(fieldPermission.read, userRole)) {
      return { ...acc, [fieldName]: record[fieldName] }
    }

    return acc
  }, {})

  return filteredRecord
}

function hasFieldReadPermission(permission: TablePermission, userRole: string): boolean {
  if (permission === 'all') return true
  if (permission === 'authenticated') return true
  if (Array.isArray(permission)) return permission.includes(userRole)
  return false
}
