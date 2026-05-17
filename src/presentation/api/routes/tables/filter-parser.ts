/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
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
 * Build a canonical 403 response for a forbidden filter field. Extracted so
 * both the JSON-filter and the simple `field:value` branches return the
 * exact same envelope.
 */
const forbiddenFilterResponse = (c: Context, forbiddenField: string): Response =>
  c.json(
    {
      success: false,
      message: `Cannot filter by field: ${forbiddenField}`,
      code: 'FORBIDDEN',
    },
    403
  )

/**
 * Validate that the user can filter by every field referenced in `filter`.
 * Returns `undefined` when allowed, or a 403 response when any field is
 * forbidden.
 */
const checkFilterFieldPermissions = (config: {
  filter: unknown
  app: App
  tableName: string
  userRole: string
  c: Context
}): Response | undefined => {
  const { filter, app, tableName, userRole, c } = config
  // filter has been parsed via the FilterParameter shape upstream; the
  // permission validator's local `Filter` interface is structurally identical.
  const forbiddenFields = validateFilterFieldPermissions(
    app,
    tableName,
    userRole,
    filter as Parameters<typeof validateFilterFieldPermissions>[3]
  )
  if (forbiddenFields.length === 0 || forbiddenFields[0] === undefined) return undefined
  return forbiddenFilterResponse(c, forbiddenFields[0])
}

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
    const denied = checkFilterFieldPermissions({ filter, app, tableName, userRole, c })
    if (denied) return { success: false, error: denied }
    return { success: true, filter }
  } catch {
    // Try field:value simple equality format (e.g., "priority:high")
    const colonIdx = filterParam.indexOf(':')
    if (colonIdx > 0) {
      const field = filterParam.substring(0, colonIdx)
      const value = filterParam.substring(colonIdx + 1)
      const filter = { and: [{ field, operator: 'equals', value }] }

      // Apply the same field-level permission check as the JSON branch.
      // Without this, a user with read access to ?filter={"and":[...]} blocked
      // by role could bypass the check via ?filter=hiddenField:value.
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
