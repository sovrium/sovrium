/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { findDuplicate } from './field-types/validation-utils'
import { extractFieldReferences } from './table-formula-validation'

/**
 * Validate owner permissions reference existing fields in the table.
 *
 * @param permissions - Table permissions to validate
 * @param fields - Table fields for validation
 * @param fieldNames - Set of valid field names in the table
 * @returns Error object if validation fails, undefined if valid
 */
export const validateOwnerPermissions = (
  permissions: {
    readonly read?: { readonly type: string; readonly field?: string }
    readonly create?: { readonly type: string; readonly field?: string }
    readonly update?: { readonly type: string; readonly field?: string }
    readonly delete?: { readonly type: string; readonly field?: string }
  },
  fields: ReadonlyArray<{ readonly name: string; readonly type: string }>,
  fieldNames: ReadonlySet<string>
): { readonly message: string; readonly path: ReadonlyArray<string> } | undefined => {
  // Check table-level permissions for owner type
  const tableLevelPermissions = [
    { name: 'read', permission: permissions.read },
    { name: 'create', permission: permissions.create },
    { name: 'update', permission: permissions.update },
    // eslint-disable-next-line drizzle/enforce-delete-with-where
    { name: 'delete', permission: permissions.delete },
  ]

  // User-type fields that can be used for owner permissions
  const userTypeFields = new Set(['user', 'created-by', 'updated-by'])

  const invalidOwnerPermission = tableLevelPermissions.find(
    ({ permission }) =>
      permission?.type === 'owner' && permission.field && !fieldNames.has(permission.field)
  )

  if (invalidOwnerPermission?.permission?.field) {
    return {
      message: `Owner field '${invalidOwnerPermission.permission.field}' does not exist in table - field not found`,
      path: ['permissions', invalidOwnerPermission.name],
    }
  }

  // Check that owner permission fields are user types
  const nonUserTypeOwnerPermission = tableLevelPermissions.find(({ permission }) => {
    if (permission?.type !== 'owner' || !permission.field) {
      return false
    }
    const field = fields.find((f) => f.name === permission.field)
    return field && !userTypeFields.has(field.type)
  })

  if (nonUserTypeOwnerPermission?.permission?.field) {
    const field = fields.find((f) => f.name === nonUserTypeOwnerPermission.permission?.field)
    return {
      message: `Owner permission field '${nonUserTypeOwnerPermission.permission.field}' must be a user type (user, created-by, or updated-by), but field has type '${field?.type}'`,
      path: ['permissions', nonUserTypeOwnerPermission.name],
    }
  }

  return undefined
}

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
 * Extract field references from a condition string, excluding string literals.
 * Removes quoted strings before extracting identifiers to avoid treating
 * literal values as field names.
 *
 * @param condition - The condition expression
 * @returns Array of field names referenced in the condition
 */
const extractFieldReferencesFromCondition = (condition: string): ReadonlyArray<string> => {
  // Remove single-quoted and double-quoted string literals
  // This prevents treating 'draft' or "admin" as field names
  const withoutStringLiterals = condition
    .replace(/'[^']*'/g, '') // Remove single-quoted strings
    .replace(/"[^"]*"/g, '') // Remove double-quoted strings

  return extractFieldReferences(withoutStringLiterals)
}

/**
 * Validate RLS condition syntax to detect common SQL syntax errors.
 * Checks for patterns that would cause PostgreSQL syntax errors.
 *
 * @param condition - The condition expression to validate
 * @returns Error message if invalid, undefined if valid
 */
const validateConditionSyntax = (condition: string): string | undefined => {
  // Check for JavaScript-style double equals (==) which is invalid in SQL
  if (/==/.test(condition)) {
    return 'Invalid condition syntax: use single = for equality, not =='
  }

  // Check for consecutive comparison operators (e.g., "= =", "> >")
  if (/[=<>!]\s*[=<>!](?![=])/.test(condition)) {
    return 'Invalid condition syntax: consecutive comparison operators detected'
  }

  return undefined
}

/**
 * Helper to check if a field reference is a user property (e.g., from {user.department}).
 * The condition string "{user.department} = department" extracts both 'user' and 'department'.
 * We need to allow 'user' as it's part of the {user.property} syntax.
 *
 * @param condition - The full condition string
 * @param fieldRef - The field reference to check
 * @returns True if field reference is part of {user.property} syntax
 */
const isUserPropertyReference = (condition: string, fieldRef: string): boolean => {
  // Check if the field reference appears immediately before a dot in the condition
  // This handles patterns like "{user.department}" or "{user.role}"
  const userPropPattern = new RegExp(`\\{\\s*${fieldRef}\\s*\\.\\s*\\w+\\s*\\}`, 'i')
  return userPropPattern.test(condition)
}

/**
 * Validate that record permissions reference existing fields in their conditions.
 *
 * @param recordPermissions - Array of record permissions to validate
 * @param fieldNames - Set of valid field names in the table
 * @returns Error object if validation fails, undefined if valid
 */
export const validateRecordPermissions = (
  recordPermissions: ReadonlyArray<{ readonly action: string; readonly condition: string }>,
  fieldNames: ReadonlySet<string>
): { readonly message: string; readonly path: ReadonlyArray<string> } | undefined => {
  // Validate condition syntax first (before checking field references)
  const syntaxError = recordPermissions
    .map((permission) => ({
      permission,
      error: validateConditionSyntax(permission.condition),
    }))
    .find((result) => result.error !== undefined)

  if (syntaxError?.error) {
    return {
      message: syntaxError.error,
      path: ['permissions', 'records'],
    }
  }

  // Variable keywords that are allowed in conditions (RLS variables)
  // Supports:
  // - {userId}, {roles}
  // - {user.property} for custom user properties (e.g., {user.department})
  const variableKeywords = new Set(['userid', 'roles', 'user'])

  const invalidPermission = recordPermissions.find((permission) => {
    const fieldRefs = extractFieldReferencesFromCondition(permission.condition)
    const invalidField = fieldRefs.find((fieldRef) => {
      if (fieldNames.has(fieldRef) || variableKeywords.has(fieldRef)) {
        return false
      }
      // Allow field if it's part of {user.property} syntax
      if (isUserPropertyReference(permission.condition, fieldRef)) {
        return false
      }
      return true
    })
    return invalidField !== undefined
  })

  if (invalidPermission) {
    const fieldRefs = extractFieldReferencesFromCondition(invalidPermission.condition)
    const invalidField = fieldRefs.find((fieldRef) => {
      if (fieldNames.has(fieldRef) || variableKeywords.has(fieldRef)) {
        return false
      }
      // Allow field if it's part of {user.property} syntax
      if (isUserPropertyReference(invalidPermission.condition, fieldRef)) {
        return false
      }
      return true
    })
    return {
      message: `Record permission references non-existent field '${invalidField}' - field does not exist in table`,
      path: ['permissions', 'records'],
    }
  }

  return undefined
}

/**
 * Validate table permissions including field permissions, record permissions, and roles.
 *
 * @param permissions - Table permissions to validate
 * @param fields - Table fields for validation
 * @param fieldNames - Set of valid field names
 * @returns Validation error object if invalid, undefined if valid
 */
export const validateTablePermissions = (
  permissions: {
    readonly read?: {
      readonly type: string
      readonly roles?: ReadonlyArray<string>
      readonly field?: string
    }
    readonly create?: {
      readonly type: string
      readonly roles?: ReadonlyArray<string>
      readonly field?: string
    }
    readonly update?: {
      readonly type: string
      readonly roles?: ReadonlyArray<string>
      readonly field?: string
    }
    readonly delete?: {
      readonly type: string
      readonly roles?: ReadonlyArray<string>
      readonly field?: string
    }
    readonly fields?: ReadonlyArray<{
      readonly field: string
      readonly read?: { readonly type: string; readonly roles?: ReadonlyArray<string> }
      readonly write?: { readonly type: string; readonly roles?: ReadonlyArray<string> }
    }>
    readonly records?: ReadonlyArray<{ readonly action: string; readonly condition: string }>
  },
  fields: ReadonlyArray<{ readonly name: string; readonly type: string }>,
  fieldNames: ReadonlySet<string>
): { readonly message: string; readonly path: ReadonlyArray<string> } | undefined => {
  // Validate owner permissions reference existing fields
  const ownerPermissionsError = validateOwnerPermissions(permissions, fields, fieldNames)
  if (ownerPermissionsError) {
    return ownerPermissionsError
  }

  // Validate field permissions reference existing fields
  if (permissions.fields) {
    const fieldPermissionsError = validateFieldPermissions(permissions.fields, fieldNames)
    if (fieldPermissionsError) {
      return fieldPermissionsError
    }
  }

  // Validate record permissions reference existing fields
  if (permissions.records) {
    const recordPermissionsError = validateRecordPermissions(permissions.records, fieldNames)
    if (recordPermissionsError) {
      return recordPermissionsError
    }
  }

  // Note: Role validation disabled - allow custom roles beyond the default set
  // Default roles: owner, admin, member, viewer
  // Custom roles can be added by applications (e.g., 'hr', 'manager', 'finance_admin')

  return undefined
}
