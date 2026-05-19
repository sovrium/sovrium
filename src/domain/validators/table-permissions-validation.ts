/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { findDuplicate } from '@/domain/models/app/tables/fields/field-types/validation-utils'

export const validateFieldPermissions = (
  fieldPermissions: ReadonlyArray<{ readonly field: string }>,
  fieldNames: ReadonlySet<string>
): { readonly message: string; readonly path: ReadonlyArray<string> } | undefined => {
  const fieldPermissionNames = fieldPermissions.map((fp) => fp.field)
  const duplicateField = findDuplicate(fieldPermissionNames)

  if (duplicateField) {
    return {
      message: `Duplicate field permission for field '${duplicateField}' - conflicting permission definitions`,
      path: ['permissions', 'fields'],
    }
  }

  const invalidFieldPermission = fieldPermissions.find(
    (fieldPermission) => !fieldNames.has(fieldPermission.field)
  )

  if (invalidFieldPermission) {
    return {
      message: `Field permission references non-existent field '${invalidFieldPermission.field}' - field does not exist in table`,
      path: ['permissions', 'fields'],
    }
  }

  return undefined
}

export const validateTablePermissions = (
  permissions: {
    readonly fields?: ReadonlyArray<{
      readonly field: string
    }>
  },
  _fields: ReadonlyArray<{ readonly name: string; readonly type: string }>,
  fieldNames: ReadonlySet<string>
): { readonly message: string; readonly path: ReadonlyArray<string> } | undefined => {
  if (permissions.fields) {
    const fieldPermissionsError = validateFieldPermissions(permissions.fields, fieldNames)
    if (fieldPermissionsError) {
      return fieldPermissionsError
    }
  }

  return undefined
}
