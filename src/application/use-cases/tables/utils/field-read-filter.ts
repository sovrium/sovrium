/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isAdminEquivalent } from '@/domain/models/app/auth/roles'
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

type FieldBearingTable = {
  readonly fields: readonly { readonly name: string; readonly type: string }[]
}

function isFieldExcludedByDefaultRules(
  fieldName: string,
  userRole: string,
  table: FieldBearingTable | undefined
): boolean {
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

export function isFieldReadableByRole(
  app: App,
  tableName: string,
  userRole: string,
  fieldName: string
): boolean {
  if (isAdminEquivalent(userRole, app)) return true

  if (isSystemField(fieldName)) return true

  const table = app.tables?.find((t) => t.name === tableName)

  if (table?.permissions?.fields) {
    const fieldPermission = table.permissions.fields.find((fp) => fp.field === fieldName)

    if (!fieldPermission?.read) return true

    return hasFieldReadPermission(fieldPermission.read, userRole)
  }

  return !isFieldExcludedByDefaultRules(fieldName, userRole, table)
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

  return Object.keys(record).reduce<Record<string, unknown>>((acc, fieldName) => {
    if (!isFieldReadableByRole(app, tableName, userRole, fieldName)) {
      return acc
    }
    return { ...acc, [fieldName]: record[fieldName] }
  }, {})
}

function hasFieldReadPermission(permission: TablePermission, userRole: string): boolean {
  if (permission === 'all') return true
  if (permission === 'authenticated') return true
  if (Array.isArray(permission)) return permission.includes(userRole)
  return false
}
