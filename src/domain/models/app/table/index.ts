/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TableIdSchema } from '@/domain/models/app/common/branded-ids'
import { detectCycles } from './cycle-detection'
import { findDuplicate } from './field-types/validation-utils'
import { FieldsSchema } from './fields'
import { IndexesSchema } from './indexes'
import { NameSchema } from './name'
import { TablePermissionsSchema } from './permissions'
import { PrimaryKeySchema } from './primary-key'
import { UniqueConstraintsSchema } from './unique-constraints'
import { ViewSchema } from './views'

/**
 * Table Schema
 *
 * Defines a single database table entity with its structure, fields, and constraints.
 * Each table represents a distinct entity (e.g., users, products, orders) with fields
 * that define the data schema. Tables support primary keys, unique constraints, and
 * indexes for efficient data access and integrity.
 *
 * @example
 * ```typescript
 * const userTable = {
 *   id: 1,
 *   name: 'users',
 *   fields: [
 *     { id: 1, name: 'email', type: 'email', required: true },
 *     { id: 2, name: 'name', type: 'single-line-text', required: true }
 *   ],
 *   primaryKey: { fields: ['id'] },
 *   uniqueConstraints: [{ fields: ['email'] }]
 * }
 * ```
 *
 * @see docs/specifications/roadmap/tables.md for full specification
 */

/**
 * Common SQL/formula keywords and functions that should be excluded from field references.
 * Defined as a constant to avoid recreating the Set on every function call.
 */
const FORMULA_KEYWORDS = new Set([
  'if',
  'then',
  'else',
  'and',
  'or',
  'not',
  'concat',
  'round',
  'sum',
  'avg',
  'max',
  'min',
  'count',
  'true',
  'false',
  'null',
  'case',
  'when',
  'end',
  'ceil',
  'floor',
  'abs',
  'current_date',
  'current_time',
  'current_timestamp',
  'now',
  'upper',
  'lower',
  'trim',
  'length',
  'substr',
  'substring',
  'replace',
  'coalesce',
  'nullif',
  'cast',
  'extract',
  'date_add',
  'date_sub',
  'date_diff',
  'year',
  'month',
  'day',
  'hour',
  'minute',
  'second',
  'power',
  'sqrt',
  'mod',
  'greatest',
  'least',
  'exp',
  'trunc',
  'log',
  'ln',
  'sign',
])

/**
 * Validate formula syntax to detect common syntax errors.
 * Checks for patterns that would cause SQL syntax errors.
 *
 * @param formula - The formula expression to validate
 * @returns Error message if invalid, undefined if valid
 */
const validateFormulaSyntax = (formula: string): string | undefined => {
  // Check for consecutive operators (e.g., "* *", "+ +", "- -")
  if (/[+\-*/%]\s*[+\-*/%]/.test(formula)) {
    return 'Invalid formula syntax: consecutive operators detected'
  }

  // Check for unmatched parentheses
  const openParens = (formula.match(/\(/g) || []).length
  const closeParens = (formula.match(/\)/g) || []).length
  if (openParens !== closeParens) {
    return 'Invalid formula syntax: unmatched parentheses'
  }

  // Check for empty parentheses
  if (/\(\s*\)/.test(formula)) {
    return 'Invalid formula syntax: empty parentheses'
  }

  return undefined
}

/**
 * Extract potential field references from a formula expression.
 * This is a simplified parser that extracts identifiers (words) from the formula.
 * It doesn't handle complex syntax but catches common field reference patterns.
 *
 * @param formula - The formula expression to parse
 * @returns Array of field names referenced in the formula
 */
const extractFieldReferences = (formula: string): ReadonlyArray<string> => {
  // Match word characters (field names) - exclude function names and operators
  // This regex matches identifiers that could be field names
  const identifierPattern = /\b([a-z_][a-z0-9_]*)\b/gi
  const matches = formula.match(identifierPattern) || []

  return matches
    .map((match) => match.toLowerCase())
    .filter((identifier) => !FORMULA_KEYWORDS.has(identifier))
}

/**
 * Default roles available in Sovrium.
 * These are the standard roles defined by the organization plugin.
 */
const DEFAULT_ROLES = new Set(['owner', 'admin', 'member', 'viewer'])

/**
 * Validate formula fields in a table (syntax, field references, circular dependencies).
 *
 * @param fields - Array of fields to validate
 * @returns Error object if invalid, undefined if valid
 */
const validateFormulaFields = (
  fields: ReadonlyArray<{ readonly name: string; readonly type: string; readonly formula?: string }>
): { readonly message: string; readonly path: ReadonlyArray<string> } | undefined => {
  const fieldNames = new Set(fields.map((field) => field.name))
  const formulaFields = fields.filter(
    (field): field is typeof field & { readonly formula: string } =>
      field.type === 'formula' && typeof field.formula === 'string'
  )

  // Validate formula syntax first (before checking field references)
  const syntaxError = formulaFields
    .map((formulaField) => ({
      field: formulaField,
      error: validateFormulaSyntax(formulaField.formula),
    }))
    .find((result) => result.error !== undefined)

  if (syntaxError?.error) {
    return {
      message: syntaxError.error,
      path: ['fields'],
    }
  }

  // Find the first invalid field reference across all formula fields
  const invalidReference = formulaFields
    .flatMap((formulaField) => {
      const referencedFields = extractFieldReferences(formulaField.formula)
      const invalidField = referencedFields.find((refField) => !fieldNames.has(refField))
      return invalidField ? [{ formulaField, invalidField }] : []
    })
    .at(0)

  if (invalidReference) {
    return {
      message: `Invalid field reference: field '${invalidReference.invalidField}' not found in formula '${invalidReference.formulaField.formula}'`,
      path: ['fields'],
    }
  }

  // Detect circular dependencies in formula fields
  const circularFields = detectCircularDependencies(fields)
  if (circularFields.length > 0) {
    return {
      message: `Circular dependency detected in formula fields: ${circularFields.join(' -> ')}`,
      path: ['fields'],
    }
  }

  return undefined
}

/**
 * Validate organizationScoped configuration requires organization_id field with correct type.
 *
 * @param table - Table to validate
 * @returns Error object if invalid, undefined if valid
 */
const validateOrganizationScoped = (table: {
  readonly fields: ReadonlyArray<{ readonly name: string; readonly type: string }>
  readonly permissions?: { readonly organizationScoped?: boolean }
}): { readonly message: string; readonly path: ReadonlyArray<string> } | undefined => {
  if (table.permissions?.organizationScoped !== true) {
    return undefined
  }

  const organizationIdField = table.fields.find((field) => field.name === 'organization_id')
  if (!organizationIdField) {
    return {
      message: 'organizationScoped requires organization_id field',
      path: ['permissions', 'organizationScoped'],
    }
  }

  // Validate organization_id field type (must be text-based for Better Auth compatibility)
  const validTypes = ['single-line-text', 'long-text', 'email', 'url', 'phone-number']
  if (!validTypes.includes(organizationIdField.type)) {
    return {
      message: `organization_id field must be a text type (single-line-text, long-text, email, url, or phone-number), got: ${organizationIdField.type}`,
      path: ['fields'],
    }
  }

  return undefined
}

/**
 * Validate owner permissions reference existing fields in the table.
 *
 * @param permissions - Table permissions to validate
 * @param fields - Table fields for validation
 * @param fieldNames - Set of valid field names in the table
 * @returns Error object if validation fails, undefined if valid
 */
const validateOwnerPermissions = (
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
 * Validate table permissions including field permissions, record permissions, and roles.
 *
 * @param permissions - Table permissions to validate
 * @param fields - Table fields for validation
 * @param fieldNames - Set of valid field names
 * @returns Validation error object if invalid, undefined if valid
 */
const validateTablePermissions = (
  permissions: {
    readonly organizationScoped?: boolean
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
  // Validate organizationScoped requires organization_id field
  if (permissions.organizationScoped === true) {
    const orgValidationError = validateOrganizationScoped({ fields, permissions })
    if (orgValidationError) {
      return orgValidationError
    }
  }

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

  // Validate that all roles referenced in permissions exist
  const referencedRoles = extractRoleReferences(permissions)
  const invalidRoles = [...referencedRoles].filter((role) => !DEFAULT_ROLES.has(role))

  if (invalidRoles.length > 0) {
    const roleList = invalidRoles.map((r) => `'${r}'`).join(', ')
    return {
      message: `Invalid role ${roleList} not found. Available roles: ${[...DEFAULT_ROLES].map((r) => `'${r}'`).join(', ')}`,
      path: ['permissions'],
    }
  }

  return undefined
}

/**
 * Extract all role references from table permissions.
 * Checks table-level and field-level permissions for role references.
 *
 * @param permissions - Table permissions configuration
 * @returns Set of role names referenced in permissions
 */
const extractRoleReferences = (permissions: {
  readonly read?: { readonly type: string; readonly roles?: ReadonlyArray<string> }
  readonly create?: { readonly type: string; readonly roles?: ReadonlyArray<string> }
  readonly update?: { readonly type: string; readonly roles?: ReadonlyArray<string> }
  readonly delete?: { readonly type: string; readonly roles?: ReadonlyArray<string> }
  readonly fields?: ReadonlyArray<{
    readonly field: string
    readonly read?: { readonly type: string; readonly roles?: ReadonlyArray<string> }
    readonly write?: { readonly type: string; readonly roles?: ReadonlyArray<string> }
  }>
}): ReadonlySet<string> => {
  // Check table-level permissions
  const tableLevelPermissions = [
    permissions.read,
    permissions.create,
    permissions.update,
    // eslint-disable-next-line drizzle/enforce-delete-with-where
    permissions.delete,
  ]
  const tableLevelRoles = tableLevelPermissions.flatMap((permission) =>
    permission?.type === 'roles' && permission.roles ? permission.roles : []
  )

  // Check field-level permissions
  const fieldLevelRoles = (permissions.fields || []).flatMap((fieldPermission) => [
    ...(fieldPermission.read?.type === 'roles' && fieldPermission.read.roles
      ? fieldPermission.read.roles
      : []),
    ...(fieldPermission.write?.type === 'roles' && fieldPermission.write.roles
      ? fieldPermission.write.roles
      : []),
  ])

  return new Set([...tableLevelRoles, ...fieldLevelRoles])
}

/**
 * Validate primary key configuration (field references, duplicates).
 *
 * @param primaryKey - Primary key configuration to validate
 * @param fieldNames - Set of valid field names in the table
 * @returns Error object if validation fails, undefined if valid
 */
const validatePrimaryKey = (
  primaryKey: { readonly type: string; readonly fields?: ReadonlyArray<string> } | undefined,
  fieldNames: ReadonlySet<string>
): { readonly message: string; readonly path: ReadonlyArray<string> } | undefined => {
  if (!primaryKey || primaryKey.type !== 'composite' || !primaryKey.fields) {
    return undefined
  }

  // Check for duplicate field references
  const duplicateField = findDuplicate(primaryKey.fields)

  if (duplicateField) {
    return {
      message: `Primary key field '${duplicateField}' is not unique - duplicate field references in composite primary key`,
      path: ['primaryKey', 'fields'],
    }
  }

  // Check for non-existent field references
  const invalidField = primaryKey.fields.find((field) => !fieldNames.has(field))

  if (invalidField) {
    return {
      message: `Primary key references non-existent field '${invalidField}' - field not found in table`,
      path: ['primaryKey', 'fields'],
    }
  }

  return undefined
}

/**
 * Validate that view IDs are unique within a table.
 *
 * @param views - Array of views to validate
 * @returns Error object if validation fails, undefined if valid
 */
const validateViewIds = (
  views: ReadonlyArray<{ readonly id: string | number }>
): { readonly message: string; readonly path: ReadonlyArray<string> } | undefined => {
  // Convert all view IDs to strings for comparison (ViewId can be number or string)
  const viewIds = views.map((view) => String(view.id))

  // Find duplicate view ID
  const duplicateId = findDuplicate(viewIds)

  if (duplicateId) {
    return {
      message: `Duplicate view id '${duplicateId}' - view id must be unique within the table`,
      path: ['views'],
    }
  }

  return undefined
}

/**
 * Validate that only one view is marked as default within a table.
 *
 * @param views - Array of views to validate
 * @returns Error object if validation fails, undefined if valid
 */
const validateDefaultViews = (
  views: ReadonlyArray<{ readonly id: string | number; readonly isDefault?: boolean }>
): { readonly message: string; readonly path: ReadonlyArray<string> } | undefined => {
  const defaultViews = views.filter((view) => view.isDefault === true)

  if (defaultViews.length > 1) {
    return {
      message: 'Only one default view is allowed per table - multiple default views found',
      path: ['views'],
    }
  }

  return undefined
}

/**
 * Extract field references from a filter node recursively.
 * Handles single conditions, AND groups, and OR groups.
 *
 * @param filterNode - The filter node to extract fields from
 * @returns Array of field names referenced in the filter
 */
const extractFieldReferencesFromFilter = (
  filterNode:
    | { readonly field: string; readonly operator: string; readonly value: unknown }
    | { readonly and: ReadonlyArray<unknown> }
    | { readonly or: ReadonlyArray<unknown> }
): ReadonlyArray<string> => {
  // Single condition - extract field name
  if ('field' in filterNode) {
    return [filterNode.field]
  }

  // AND group - recursively extract from all conditions
  if ('and' in filterNode && Array.isArray(filterNode.and)) {
    return filterNode.and.flatMap((node) =>
      extractFieldReferencesFromFilter(
        node as
          | { readonly field: string; readonly operator: string; readonly value: unknown }
          | { readonly and: ReadonlyArray<unknown> }
          | { readonly or: ReadonlyArray<unknown> }
      )
    )
  }

  // OR group - recursively extract from all conditions
  if ('or' in filterNode && Array.isArray(filterNode.or)) {
    return filterNode.or.flatMap((node) =>
      extractFieldReferencesFromFilter(
        node as
          | { readonly field: string; readonly operator: string; readonly value: unknown }
          | { readonly and: ReadonlyArray<unknown> }
          | { readonly or: ReadonlyArray<unknown> }
      )
    )
  }

  return []
}

/**
 * Extract filter conditions from a filter node recursively.
 * Returns array of conditions with field, operator, and value.
 *
 * @param filterNode - The filter node to extract conditions from
 * @returns Array of filter conditions
 */
const extractFilterConditions = (
  filterNode:
    | { readonly field: string; readonly operator: string; readonly value: unknown }
    | { readonly and: ReadonlyArray<unknown> }
    | { readonly or: ReadonlyArray<unknown> }
): ReadonlyArray<{ readonly field: string; readonly operator: string; readonly value: unknown }> => {
  // Single condition - return as array
  if ('field' in filterNode) {
    return [filterNode]
  }

  // AND group - recursively extract from all conditions
  if ('and' in filterNode && Array.isArray(filterNode.and)) {
    return filterNode.and.flatMap((node) =>
      extractFilterConditions(
        node as
          | { readonly field: string; readonly operator: string; readonly value: unknown }
          | { readonly and: ReadonlyArray<unknown> }
          | { readonly or: ReadonlyArray<unknown> }
      )
    )
  }

  // OR group - recursively extract from all conditions
  if ('or' in filterNode && Array.isArray(filterNode.or)) {
    return filterNode.or.flatMap((node) =>
      extractFilterConditions(
        node as
          | { readonly field: string; readonly operator: string; readonly value: unknown }
          | { readonly and: ReadonlyArray<unknown> }
          | { readonly or: ReadonlyArray<unknown> }
      )
    )
  }

  return []
}

/**
 * Operator compatibility rules for field types.
 * Maps field types to their valid operators.
 * Only enforces restrictions for specific field types (e.g., checkbox cannot use 'contains').
 * Other operators are allowed by default to avoid breaking valid use cases.
 */
const FIELD_TYPE_OPERATORS: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  // Checkbox: only boolean operators allowed
  ['checkbox', new Set(['equals', 'isTrue', 'isFalse'])],
])

/**
 * Validate that filter operators are compatible with field types.
 *
 * @param views - Array of views to validate
 * @param fields - Array of fields in the table
 * @returns Error object if validation fails, undefined if valid
 */
const validateFilterOperatorCompatibility = (
  views: ReadonlyArray<{
    readonly id: string | number
    readonly filters?:
      | { readonly field: string; readonly operator: string; readonly value: unknown }
      | { readonly and: ReadonlyArray<unknown> }
      | { readonly or: ReadonlyArray<unknown> }
  }>,
  fields: ReadonlyArray<{ readonly name: string; readonly type: string }>
): { readonly message: string; readonly path: ReadonlyArray<string> } | undefined => {
  const fieldTypeMap = new Map(fields.map((field) => [field.name, field.type]))

  const incompatibleFilter = views
    .filter((view) => view.filters !== undefined)
    .flatMap((view) => {
      const conditions = extractFilterConditions(view.filters!)
      return conditions.flatMap((condition) => {
        const fieldType = fieldTypeMap.get(condition.field)
        if (!fieldType) {
          return []
        }

        const validOperators = FIELD_TYPE_OPERATORS.get(fieldType)
        if (!validOperators) {
          // No restrictions defined for this field type
          return []
        }

        if (!validOperators.has(condition.operator)) {
          return [{ view, condition, fieldType }]
        }

        return []
      })
    })
    .at(0)

  if (incompatibleFilter) {
    return {
      message: `Incompatible operator '${incompatibleFilter.condition.operator}' for field '${incompatibleFilter.condition.field}' with type '${incompatibleFilter.fieldType}' - operator is invalid for checkbox field type`,
      path: ['views'],
    }
  }

  return undefined
}

/**
 * Validate that view filters reference existing fields in the table.
 *
 * @param views - Array of views to validate
 * @param fieldNames - Set of valid field names in the table
 * @returns Error object if validation fails, undefined if valid
 */
const validateViewFilters = (
  views: ReadonlyArray<{
    readonly id: string | number
    readonly filters?:
      | { readonly field: string; readonly operator: string; readonly value: unknown }
      | { readonly and: ReadonlyArray<unknown> }
      | { readonly or: ReadonlyArray<unknown> }
  }>,
  fieldNames: ReadonlySet<string>
): { readonly message: string; readonly path: ReadonlyArray<string> } | undefined => {
  const invalidView = views
    .filter((view) => view.filters !== undefined)
    .flatMap((view) => {
      const referencedFields = extractFieldReferencesFromFilter(view.filters!)
      const invalidFields = referencedFields.filter((fieldName) => !fieldNames.has(fieldName))
      return invalidFields.map((invalidField) => ({ view, invalidField }))
    })
    .at(0)

  if (invalidView) {
    return {
      message: `Filter references non-existent field '${invalidView.invalidField}' - field not found in table`,
      path: ['views'],
    }
  }

  return undefined
}

/**
 * Validate that view fields reference existing fields in the table.
 *
 * @param views - Array of views to validate
 * @param fieldNames - Set of valid field names in the table
 * @returns Error object if validation fails, undefined if valid
 */
const validateViewFields = (
  views: ReadonlyArray<{ readonly id: string | number; readonly fields?: ReadonlyArray<string> }>,
  fieldNames: ReadonlySet<string>
): { readonly message: string; readonly path: ReadonlyArray<string> } | undefined => {
  const invalidView = views
    .filter(
      (view): view is typeof view & { readonly fields: ReadonlyArray<string> } =>
        view.fields !== undefined && view.fields.length > 0
    )
    .flatMap((view) => {
      const invalidFields = view.fields.filter((fieldName) => !fieldNames.has(fieldName))
      return invalidFields.map((invalidField) => ({ view, invalidField }))
    })
    .at(0)

  if (invalidView) {
    return {
      message: `View field '${invalidView.invalidField}' not found - view fields must reference existing table fields (non-existent field in view)`,
      path: ['views'],
    }
  }

  return undefined
}

/**
 * Validate that view groupBy references existing fields in the table.
 *
 * @param views - Array of views to validate
 * @param fieldNames - Set of valid field names in the table
 * @returns Error object if validation fails, undefined if valid
 */
const validateViewGroupBy = (
  views: ReadonlyArray<{
    readonly id: string | number
    readonly groupBy?: { readonly field: string }
  }>,
  fieldNames: ReadonlySet<string>
): { readonly message: string; readonly path: ReadonlyArray<string> } | undefined => {
  const invalidView = views
    .filter(
      (view): view is typeof view & { readonly groupBy: { readonly field: string } } =>
        view.groupBy !== undefined
    )
    .find((view) => !fieldNames.has(view.groupBy.field))

  if (invalidView) {
    return {
      message: `groupBy references non-existent field '${invalidView.groupBy.field}' - field not found in table`,
      path: ['views'],
    }
  }

  return undefined
}

/**
 * Validate views configuration (IDs, default views, field references, filter references).
 *
 * @param views - Array of views to validate
 * @param fields - Array of fields in the table
 * @param fieldNames - Set of valid field names in the table
 * @returns Error object if validation fails, undefined if valid
 */
const validateViews = (
  views: ReadonlyArray<{ readonly id: string | number; readonly isDefault?: boolean }>,
  fields: ReadonlyArray<{ readonly name: string; readonly type: string }>,
  fieldNames: ReadonlySet<string>
): { readonly message: string; readonly path: ReadonlyArray<string> } | undefined => {
  const viewsValidationError = validateViewIds(views)
  if (viewsValidationError) {
    return viewsValidationError
  }

  const defaultViewsValidationError = validateDefaultViews(views)
  if (defaultViewsValidationError) {
    return defaultViewsValidationError
  }

  const viewFieldsValidationError = validateViewFields(views, fieldNames)
  if (viewFieldsValidationError) {
    return viewFieldsValidationError
  }

  const viewFiltersValidationError = validateViewFilters(views, fieldNames)
  if (viewFiltersValidationError) {
    return viewFiltersValidationError
  }

  const viewGroupByValidationError = validateViewGroupBy(views, fieldNames)
  if (viewGroupByValidationError) {
    return viewGroupByValidationError
  }

  const operatorCompatibilityError = validateFilterOperatorCompatibility(views, fields)
  if (operatorCompatibilityError) {
    return operatorCompatibilityError
  }

  return undefined
}

/**
 * Validate table schema including fields, permissions, views, and roles.
 * Extracted to reduce cyclomatic complexity of the Schema.filter function.
 *
 * @param table - Table to validate
 * @returns Validation error object if invalid, true if valid
 */
const validateTableSchema = (table: {
  readonly fields: ReadonlyArray<{
    readonly name: string
    readonly type: string
    readonly formula?: string
  }>
  readonly primaryKey?: { readonly type: string; readonly fields?: ReadonlyArray<string> }
  readonly views?: ReadonlyArray<{ readonly id: string | number; readonly isDefault?: boolean }>
  readonly permissions?: {
    readonly organizationScoped?: boolean
    readonly read?: { readonly type: string; readonly roles?: ReadonlyArray<string> }
    readonly create?: { readonly type: string; readonly roles?: ReadonlyArray<string> }
    readonly update?: { readonly type: string; readonly roles?: ReadonlyArray<string> }
    readonly delete?: { readonly type: string; readonly roles?: ReadonlyArray<string> }
    readonly fields?: ReadonlyArray<{
      readonly field: string
      readonly read?: { readonly type: string; readonly roles?: ReadonlyArray<string> }
      readonly write?: { readonly type: string; readonly roles?: ReadonlyArray<string> }
    }>
    readonly records?: ReadonlyArray<{ readonly action: string; readonly condition: string }>
  }
}): { readonly message: string; readonly path: ReadonlyArray<string> } | true => {
  const fieldNames = new Set(table.fields.map((field) => field.name))

  // Validate formula fields
  const formulaValidationError = validateFormulaFields(table.fields)
  if (formulaValidationError) {
    return formulaValidationError
  }

  // Validate primary key if present
  if (table.primaryKey) {
    const primaryKeyValidationError = validatePrimaryKey(table.primaryKey, fieldNames)
    if (primaryKeyValidationError) {
      return primaryKeyValidationError
    }
  }

  // Validate permissions if present
  if (table.permissions) {
    const permissionsValidationError = validateTablePermissions(
      table.permissions,
      table.fields,
      fieldNames
    )
    if (permissionsValidationError) {
      return permissionsValidationError
    }
  }

  // Validate views if present
  if (table.views && table.views.length > 0) {
    const viewsValidationError = validateViews(table.views, table.fields, fieldNames)
    if (viewsValidationError) {
      return viewsValidationError
    }
  }

  return true
}

/**
 * Validate that field permissions reference existing fields and don't have duplicates.
 *
 * @param fieldPermissions - Array of field permissions to validate
 * @param fieldNames - Set of valid field names in the table
 * @returns Error object if validation fails, undefined if valid
 */
const validateFieldPermissions = (
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
 * Validate that record permissions reference existing fields in their conditions.
 *
 * @param recordPermissions - Array of record permissions to validate
 * @param fieldNames - Set of valid field names in the table
 * @returns Error object if validation fails, undefined if valid
 */
const validateRecordPermissions = (
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
  const variableKeywords = new Set(['userid', 'organizationid', 'roles'])

  const invalidPermission = recordPermissions.find((permission) => {
    const fieldRefs = extractFieldReferencesFromCondition(permission.condition)
    const invalidField = fieldRefs.find(
      (fieldRef) => !fieldNames.has(fieldRef) && !variableKeywords.has(fieldRef)
    )
    return invalidField !== undefined
  })

  if (invalidPermission) {
    const fieldRefs = extractFieldReferencesFromCondition(invalidPermission.condition)
    const invalidField = fieldRefs.find(
      (fieldRef) => !fieldNames.has(fieldRef) && !variableKeywords.has(fieldRef)
    )
    return {
      message: `Record permission references non-existent field '${invalidField}' - field does not exist in table`,
      path: ['permissions', 'records'],
    }
  }

  return undefined
}

/**
 * Detect circular dependencies in formula fields using depth-first search.
 * A circular dependency exists when a formula field references itself directly or indirectly
 * through a chain of other formula fields.
 *
 * @param fields - Array of fields to validate
 * @returns Array of field names involved in circular dependencies, or empty array if none found
 */
const detectCircularDependencies = (
  fields: ReadonlyArray<{ readonly name: string; readonly type: string; readonly formula?: string }>
): ReadonlyArray<string> => {
  // Build dependency graph: field name -> fields it references
  const dependencyGraph: ReadonlyMap<string, ReadonlyArray<string>> = new Map(
    fields
      .filter(
        (field): field is typeof field & { formula: string } =>
          'formula' in field && typeof field.formula === 'string'
      )
      .map((field) => [field.name, extractFieldReferences(field.formula)] as const)
  )

  // Use shared cycle detection utility
  return detectCycles(dependencyGraph)
}

export const TableSchema = Schema.Struct({
  id: Schema.optional(TableIdSchema),
  name: NameSchema,
  fields: FieldsSchema,
  primaryKey: Schema.optional(PrimaryKeySchema),
  uniqueConstraints: Schema.optional(UniqueConstraintsSchema),
  indexes: Schema.optional(IndexesSchema),
  views: Schema.optional(Schema.Array(ViewSchema)),

  /**
   * Table-level permissions (high-level RBAC abstraction).
   *
   * Automatically generates RLS policies based on permission configuration.
   * Supports public, authenticated, role-based, and owner-based access control.
   *
   * @example Role-based permissions
   * ```typescript
   * permissions: {
   *   read: { type: 'roles', roles: ['member'] },
   *   create: { type: 'roles', roles: ['admin'] },
   *   update: { type: 'authenticated' },
   *   delete: { type: 'roles', roles: ['admin'] },
   * }
   * ```
   *
   * @example Owner-based access
   * ```typescript
   * permissions: {
   *   read: { type: 'owner', field: 'user_id' },
   *   update: { type: 'owner', field: 'user_id' },
   *   delete: { type: 'owner', field: 'user_id' },
   * }
   * ```
   *
   * @see TablePermissionsSchema for full configuration options
   */
  permissions: Schema.optional(TablePermissionsSchema),
}).pipe(
  Schema.filter(validateTableSchema),
  Schema.annotations({
    title: 'Table',
    description:
      'A database table that defines the structure of an entity in your application. Contains fields, constraints, and indexes to organize and validate data.',
    examples: [
      {
        id: 1,
        name: 'users',
        fields: [
          { id: 1, name: 'email', type: 'email' as const, required: true },
          { id: 2, name: 'name', type: 'single-line-text' as const, required: true },
        ],
      },
      {
        id: 2,
        name: 'products',
        fields: [
          { id: 1, name: 'title', type: 'single-line-text' as const, required: true },
          {
            id: 2,
            name: 'price',
            type: 'currency' as const,
            required: true,
            currency: 'USD',
          },
          { id: 3, name: 'description', type: 'long-text' as const, required: false },
        ],
        primaryKey: { type: 'composite', fields: ['id'] },
      },
    ],
  })
)

export type Table = Schema.Schema.Type<typeof TableSchema>

// Re-export all table model schemas and types for convenient imports
export * from './id'
export * from './field-name'
export * from './name'
export * from './fields'
export * from './primary-key'
export * from './unique-constraints'
export * from './indexes'
export * from './field-types'
export * from './views'
export * from './permissions'
