/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

const SYSTEM_FIELDS = new Set(['id', 'created_at', 'updated_at', 'deleted_at'])

export function canUserReadField(
  app: App,
  tableName: string,
  fieldName: string,
  userRole: string
): boolean {
  if (userRole === 'admin') {
    return true
  }

  const table = app.tables?.find((t) => t.name === tableName)
  const field = table?.fields?.find((f) => f.name === fieldName)

  if (!field) {
    return false
  }

  if (userRole === 'member') {
    const restrictedTypes = ['currency']
    return !restrictedTypes.includes(field.type)
  }

  if (userRole === 'viewer') {
    const allowedFieldTypes = ['single-line-text']
    const allowedFieldNames = ['name', 'title']
    return allowedFieldTypes.includes(field.type) && allowedFieldNames.includes(fieldName)
  }

  return true
}

export function validateSortPermission(config: {
  readonly sort: string | undefined
  readonly app: App
  readonly tableName: string
  readonly userRole: string
  readonly c: Context
}) {
  const { sort, app, tableName, userRole, c } = config

  if (!sort) return undefined

  const sortFields = sort
    .split(',')
    .map((s) => s.split(':')[0])
    .filter((field): field is string => field !== undefined && field !== '')

  const table = app.tables?.find((t) => t.name === tableName)

  const nonExistentField = sortFields.find(
    (field) => !SYSTEM_FIELDS.has(field) && !table?.fields?.find((f) => f.name === field)
  )

  if (nonExistentField) {
    return c.json(
      {
        success: false,
        message: `Invalid sort field: '${nonExistentField}'`,
        code: 'VALIDATION_ERROR',
        errors: [{ field: 'sort', message: `Invalid sort field: '${nonExistentField}'` }],
      },
      400
    )
  }

  const inaccessibleField = sortFields.find(
    (field) => !canUserReadField(app, tableName, field, userRole)
  )

  if (inaccessibleField) {
    return c.json(
      {
        success: false,
        message: 'Resource not found',
        code: 'NOT_FOUND',
      },
      404
    )
  }

  return undefined
}
