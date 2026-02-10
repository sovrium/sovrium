/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { findDuplicate } from './field-types/validation-utils'

/**
 * Validate that field permissions reference existing fields and don't have duplicates.
 *
 * @param fieldPermissions - Array of field permissions to validate
 * @param fieldNames - Set of valid field names in the table
 * @returns Error object if validation fails, undefined if valid
 */
export const validateFieldPermissions = (
  fieldPermissions: ReadonlyArray<{ readonly field: string }>,
  fieldNames: ReadonlySet<string>
): { readonly message: string; readonly path: ReadonlyArray<string> } | undefined => {
  // Check for duplicate field permissions
  const fieldPermissionNames = fieldPermissions.map((fp) => fp.field)
  const duplicateField = findDuplicate(fieldPermissionNames)

  if (duplicateField) {
    return {
      message: `Duplicate field permission for field '${duplicateField}' - conflicting permission definitions`,
      path: ['permissions', 'fields'],
    }
  }

  // Check for non-existent field references
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

/**
 * Validate table permissions including field permissions.
 *
 * With the simplified 3-format permission system ('all', 'authenticated', role array),
 * table-level CRUD permissions are validated by the schema itself.
 * This function handles cross-field validation (field permissions referencing table fields).
 *
 * @param permissions - Table permissions to validate
 * @param _fields - Table fields (unused, kept for interface compatibility)
 * @param fieldNames - Set of valid field names
 * @returns Validation error object if invalid, undefined if valid
 */
export const validateTablePermissions = (
  permissions: {
    readonly fields?: ReadonlyArray<{
      readonly field: string
    }>
  },
  _fields: ReadonlyArray<{ readonly name: string; readonly type: string }>,
  fieldNames: ReadonlySet<string>
): { readonly message: string; readonly path: ReadonlyArray<string> } | undefined => {
  // Validate field permissions reference existing fields
  if (permissions.fields) {
    const fieldPermissionsError = validateFieldPermissions(permissions.fields, fieldNames)
    if (fieldPermissionsError) {
      return fieldPermissionsError
    }
  }

  return undefined
}
