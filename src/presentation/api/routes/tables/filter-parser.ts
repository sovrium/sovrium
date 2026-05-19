/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { validateFilterFieldPermissions } from '@/presentation/api/utils/filter-field-validator'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

export type FilterParameter =
  | {
      readonly and?: readonly {
        readonly field: string
        readonly operator: string
        readonly value: unknown
      }[]
    }
  | undefined

export type ParseFilterResult =
  | { success: true; filter: FilterParameter }
  | { success: false; error: Response }

const forbiddenFilterResponse = (c: Context, forbiddenField: string): Response =>
  c.json(
    {
      success: false,
      message: `Cannot filter by field: ${forbiddenField}`,
      code: 'FORBIDDEN',
    },
    403
  )

const checkFilterFieldPermissions = (config: {
  filter: unknown
  app: App
  tableName: string
  userRole: string
  c: Context
}): Response | undefined => {
  const { filter, app, tableName, userRole, c } = config
  const forbiddenFields = validateFilterFieldPermissions(
    app,
    tableName,
    userRole,
    filter as Parameters<typeof validateFilterFieldPermissions>[3]
  )
  if (forbiddenFields.length === 0 || forbiddenFields[0] === undefined) return undefined
  return forbiddenFilterResponse(c, forbiddenFields[0])
}

export function parseFilterParameter(config: {
  filterParam: string | undefined
  app: App
  tableName: string
  userRole: string
  c: Context
}): ParseFilterResult {
  const { filterParam, app, tableName, userRole, c } = config

  if (!filterParam) {
    return { success: true, filter: undefined }
  }

  try {
    const filter = JSON.parse(filterParam)
    const denied = checkFilterFieldPermissions({ filter, app, tableName, userRole, c })
    if (denied) return { success: false, error: denied }
    return { success: true, filter }
  } catch {
    const colonIdx = filterParam.indexOf(':')
    if (colonIdx > 0) {
      const field = filterParam.substring(0, colonIdx)
      const value = filterParam.substring(colonIdx + 1)
      const filter = { and: [{ field, operator: 'equals', value }] }

      const denied = checkFilterFieldPermissions({ filter, app, tableName, userRole, c })
      if (denied) return { success: false, error: denied }
      return { success: true, filter }
    }

    return {
      success: false,
      error: c.json(
        { success: false, message: 'Invalid filter parameter', code: 'BAD_REQUEST' },
        400
      ),
    }
  }
}
