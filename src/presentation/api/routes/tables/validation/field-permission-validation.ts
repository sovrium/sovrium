/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isFieldReadableByRole } from '@/application/use-cases/tables/utils/field-read-filter'
import type { FilterStructure, FilterLeaf, FilterNode } from '../record/row-level-read-helpers'
import type { App } from '@/domain/models/app'
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

type FieldAccessContext = {
  readonly app: App
  readonly tableName: string
  readonly userRole: string
  readonly c: Context
}

function fieldPermissionDenied(c: Context) {
  return c.json(
    {
      success: false,
      message: 'Resource not found',
      code: 'NOT_FOUND',
    },
    404
  )
}

export function validateFilterParam(filter: FilterStructure, access: FieldAccessContext) {
  const { app, tableName, userRole, c } = access

  if (!filter) return undefined

  const filterFields = filter.and?.filter(isFilterLeaf).map((leaf) => leaf.field) ?? []

  const inaccessibleField = filterFields.find(
    (fieldName) => !isFieldReadableByRole(app, tableName, userRole, fieldName)
  )

  if (inaccessibleField) return fieldPermissionDenied(c)

  return undefined
}

export function validateFieldsParam(
  fields: string | undefined,
  table:
    { readonly fields: readonly { readonly name: string; readonly type: string }[] } | undefined,
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

export function validateGroupByParam(groupBy: string | undefined, access: FieldAccessContext) {
  const { app, tableName, userRole, c } = access

  if (!groupBy) return undefined

  const fieldName = groupBy.trim()
  if (fieldName.length === 0) return undefined

  const table = app.tables?.find((t) => t.name === tableName)

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

  if (!isFieldReadableByRole(app, tableName, userRole, fieldName)) {
    return fieldPermissionDenied(c)
  }

  return undefined
}

export function validateAggregateParam(
  aggregate: AggregateParams | undefined,
  access: FieldAccessContext
) {
  const { app, tableName, userRole, c } = access

  if (!aggregate) return undefined

  const aggregateFields = [
    ...(aggregate.sum ?? []),
    ...(aggregate.avg ?? []),
    ...(aggregate.min ?? []),
    ...(aggregate.max ?? []),
  ]

  const inaccessibleField = aggregateFields.find(
    (fieldName) => !isFieldReadableByRole(app, tableName, userRole, fieldName)
  )

  if (inaccessibleField) return fieldPermissionDenied(c)

  return undefined
}
