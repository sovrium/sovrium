/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Table FIELD-level permission rules, checked against ONE table.
 *
 * A table's `permissions.fields[]` names the fields whose read/write access is
 * narrowed. This module answers the two questions that need only that table to
 * answer: is any field named twice (conflicting definitions), and does every
 * named field exist on the table. It compares `fields[].field` against the
 * table's own field names and reads nothing else — not roles, not groups, not
 * `app`.
 *
 * **Not the same rule as `table-permission-groups-validation.ts`**, its sibling
 * in this directory. The two were a single letter apart before the layout
 * programme renamed them — this file was named `table-permissions-validation`
 * at the time, that one `table-permission-validation`, in different
 * directories — which is why both now say what they are. That one resolves `group:<name>` REFERENCES inside a
 * permission array against `app.auth.groups`, across every table; this one
 * resolves FIELD references within a single table. Neither calls the other, and
 * their call sites differ accordingly: this module is reached from
 * `tables/table.ts` (per-table refinement), that one from
 * `models/app/index.ts` (app-wide refinement).
 */

import { findDuplicate } from '@/domain/models/app/tables/fields/field-types/validation-utils'

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
