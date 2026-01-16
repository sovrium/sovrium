/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { validateFilterFieldPermissions } from '@/presentation/api/utils/filter-field-validator'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

/**
 * Filter parameter type matching the expected shape
 */
export type FilterParameter =
  | {
      readonly and?: readonly {
        readonly field: string
        readonly operator: string
        readonly value: unknown
      }[]
    }
  | undefined

/**
 * Result of parsing filter parameter
 */
export type ParseFilterResult =
  | { success: true; filter: FilterParameter }
  | { success: false; error: Response }

/**
 * Parse and validate filter parameter from query string
 *
 * Handles JSON parsing and field-level permission validation
 * for filter parameters.
 *
 * @param config - Configuration object with filter details
 * @returns ParseFilterResult indicating success with filter or failure with error response
 */
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
    const forbiddenFields = validateFilterFieldPermissions(app, tableName, userRole, filter)

    if (forbiddenFields.length > 0) {
      return {
        success: false,
        error: c.json(
          { error: 'Forbidden', message: `Cannot filter by field: ${forbiddenFields[0]}` },
          403
        ),
      }
    }

    return { success: true, filter }
  } catch {
    return {
      success: false,
      error: c.json({ error: 'Bad Request', message: 'Invalid filter parameter' }, 400),
    }
  }
}
