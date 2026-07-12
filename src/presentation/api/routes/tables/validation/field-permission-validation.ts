/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { FilterStructure, FilterLeaf, FilterNode } from '../record/row-level-read-helpers'
import type { Context } from 'hono'

type AggregateParams = {
  readonly count?: boolean
  readonly sum?: readonly string[]
  readonly avg?: readonly string[]
  readonly min?: readonly string[]
  readonly max?: readonly string[]
}

const isFilterLeaf = (node: FilterNode): node is FilterLeaf =>
  'field' in node && typeof node.field === 'string'

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

export function shouldExcludeFieldByDefault(
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

export function validateFilterParam(
  filter: FilterStructure,
  table:
    | { readonly fields: readonly { readonly name: string; readonly type: string }[] }
    | undefined,
  userRole: string,
  c: Context
) {
  if (!filter) return undefined

  const filterFields = filter.and?.filter(isFilterLeaf).map((leaf) => leaf.field) ?? []

  const inaccessibleField = filterFields.find((fieldName) =>
    shouldExcludeFieldByDefault(fieldName, userRole, table)
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

export function validateFieldsParam(
  fields: string | undefined,
  table:
    | { readonly fields: readonly { readonly name: string; readonly type: string }[] }
    | undefined,
  c: Context
) {
  if (!fields) return undefined

  const requestedFields = fields.split(',').map((f) => f.trim())
  const tableFieldNames = new Set(table?.fields.map((f) => f.name) ?? [])
  const systemFields = new Set(['id'])

  const invalidField = requestedFields.find(
    (fieldName) => !systemFields.has(fieldName) && !tableFieldNames.has(fieldName)
  )

  if (invalidField) {
    return c.json(
      {
        success: false,
        message: `Invalid field name: '${invalidField}'`,
        code: 'VALIDATION_ERROR',
      },
      400
    )
  }

  return undefined
}

export function validateGroupByParam(
  groupBy: string | undefined,
  table:
    | { readonly fields: readonly { readonly name: string; readonly type: string }[] }
    | undefined,
  userRole: string,
  c: Context
) {
  if (!groupBy) return undefined

  const fieldName = groupBy.trim()
  if (fieldName.length === 0) return undefined

  const fieldExists = table?.fields.some((f) => f.name === fieldName) ?? false
  if (!fieldExists) {
    return c.json(
      {
        success: false,
        message: `Invalid groupBy field: '${fieldName}'`,
        code: 'VALIDATION_ERROR',
      },
      400
    )
  }

  if (shouldExcludeFieldByDefault(fieldName, userRole, table)) {
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

export function validateAggregateParam(
  aggregate: AggregateParams | undefined,
  table:
    | { readonly fields: readonly { readonly name: string; readonly type: string }[] }
    | undefined,
  userRole: string,
  c: Context
) {
  if (!aggregate) return undefined

  const aggregateFields = [
    ...(aggregate.sum ?? []),
    ...(aggregate.avg ?? []),
    ...(aggregate.min ?? []),
    ...(aggregate.max ?? []),
  ]

  const inaccessibleField = aggregateFields.find((fieldName) =>
    shouldExcludeFieldByDefault(fieldName, userRole, table)
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
