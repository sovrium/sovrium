/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isAdminEquivalent } from '@/domain/models/app'
import { hasPermission } from '@/domain/models/app/tables/permissions'
import type { App } from '@/domain/models/app'

export function validateFieldWritePermissions(
  app: App,
  tableName: string,
  userRole: string,
  fields: Readonly<Record<string, unknown>>
): readonly string[] {
  const table = app.tables?.find((t) => t.name === tableName)
  if (!table) {
    return []
  }

  if (isAdminEquivalent(userRole, app)) {
    return []
  }

  const forbiddenFields = Object.keys(fields)
    .map((fieldName) => {
      const fieldPermission = table.permissions?.fields?.find((fp) => fp.field === fieldName)
      if (fieldPermission?.write) {
        if (!hasPermission(fieldPermission.write, userRole)) {
          return fieldName
        }
        return undefined
      }

      return undefined
    })
    .filter((field): field is string => field !== undefined)

  return forbiddenFields
}
