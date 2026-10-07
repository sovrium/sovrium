/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { findDuplicate } from '@/domain/models/app/tables/fields/field-types/validation-utils'
import { SPECIAL_FIELDS } from './table-formula-validation'
import { isPublicView } from './views/view-read-service'

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
): ReadonlyArray<{
  readonly field: string
  readonly operator: string
  readonly value: unknown
}> => {
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
      const invalidFields = referencedFields.filter(
        (fieldName) => !fieldNames.has(fieldName) && !SPECIAL_FIELDS.has(fieldName)
      )
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
      const invalidFields = view.fields.filter(
        (fieldName) => !fieldNames.has(fieldName) && !SPECIAL_FIELDS.has(fieldName)
      )
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
 * Validate that every level of a view's groupBy — the primary field and each
 * nested `thenBy` level — references an existing field of the table.
 *
 * @param views - Array of views to validate
 * @param fieldNames - Set of valid field names in the table
 * @returns Error object if validation fails, undefined if valid
 */
const validateViewGroupBy = (
  views: ReadonlyArray<{
    readonly id: string | number
    readonly groupBy?: {
      readonly field: string
      readonly thenBy?: ReadonlyArray<{ readonly field: string }>
    }
  }>,
  fieldNames: ReadonlySet<string>
): { readonly message: string; readonly path: ReadonlyArray<string> } | undefined => {
  const missing = views
    .flatMap((view) =>
      view.groupBy === undefined
        ? []
        : [view.groupBy.field, ...(view.groupBy.thenBy ?? []).map((level) => level.field)]
    )
    .find((field) => !fieldNames.has(field) && !SPECIAL_FIELDS.has(field))

  if (missing !== undefined) {
    return {
      message: `groupBy references non-existent field '${missing}' - field not found in table`,
      path: ['views'],
    }
  }

  return undefined
}

/**
 * Validate that view sorts reference existing fields in the table.
 *
 * @param views - Array of views to validate
 * @param fieldNames - Set of valid field names in the table
 * @returns Error object if validation fails, undefined if valid
 */
const validateViewSorts = (
  views: ReadonlyArray<{
    readonly id: string | number
    readonly sorts?: ReadonlyArray<{ readonly field: string; readonly direction: string }>
  }>,
  fieldNames: ReadonlySet<string>
): { readonly message: string; readonly path: ReadonlyArray<string> } | undefined => {
  const invalidView = views
    .filter(
      (
        view
      ): view is typeof view & {
        readonly sorts: ReadonlyArray<{ readonly field: string; readonly direction: string }>
      } => view.sorts !== undefined && view.sorts.length > 0
    )
    .flatMap((view) => {
      const invalidFields = view.sorts.filter(
        (sort) => !fieldNames.has(sort.field) && !SPECIAL_FIELDS.has(sort.field)
      )
      return invalidFields.map((sort) => ({ view, invalidField: sort.field }))
    })
    .at(0)

  if (invalidView) {
    return {
      message: `Sort references non-existent field '${invalidView.invalidField}' - field not found in table`,
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
export const validateViews = (
  views: ReadonlyArray<{ readonly id: string | number; readonly isDefault?: boolean }>,
  fields: ReadonlyArray<{ readonly name: string; readonly type: string }>,
  fieldNames: ReadonlySet<string>
): { readonly message: string; readonly path: ReadonlyArray<string> } | undefined => {
  return (
    validateViewIds(views) ??
    validateDefaultViews(views) ??
    validateViewFields(views, fieldNames) ??
    validateViewFilters(views, fieldNames) ??
    validateViewSorts(views, fieldNames) ??
    validateViewGroupBy(views, fieldNames) ??
    validateFilterOperatorCompatibility(views, fields)
  )
}

type PublicViewCandidate = {
  readonly id: string | number
  readonly fields?: ReadonlyArray<string>
  readonly permissions?: unknown
}

/**
 * The two shapes a PUBLIC view cannot keep its promise in.
 *
 * `{ public: true }` serves visitors with no account exactly the columns the
 * view lists, so:
 *  - a public view must list them — no `fields`, or an empty list, would leave
 *    "every column" as the answer by omission, the one answer it must never give;
 *  - it cannot sit on a table with `rowLevelPermissions` — the view-records
 *    read does not apply the row guard, and a visitor has no identity for a
 *    `$currentUser` predicate to match, so it would serve every row.
 *
 * @param views - Views of one table
 * @param hasRowLevelPermissions - Whether that table declares `rowLevelPermissions`
 * @returns Error object if a public view breaks either rule, undefined if valid
 */
export const validatePublicViews = (
  views: ReadonlyArray<PublicViewCandidate>,
  hasRowLevelPermissions: boolean
): { readonly message: string; readonly path: ReadonlyArray<string> } | undefined => {
  const publicViews = views.filter(isPublicView)
  const withoutFields = publicViews.find((view) => (view.fields?.length ?? 0) === 0)
  if (withoutFields) {
    return {
      message: `view '${String(withoutFields.id)}' is public but declares no \`fields\` — a public view serves exactly the columns it lists`,
      path: ['views'],
    }
  }
  const [firstPublic] = publicViews
  if (firstPublic && hasRowLevelPermissions) {
    return {
      message: `view '${String(firstPublic.id)}' is public but its table declares \`rowLevelPermissions\` — a visitor has no identity for a row rule to scope, so a public view would serve every row`,
      path: ['views'],
    }
  }
  return undefined
}
