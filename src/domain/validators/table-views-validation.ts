/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { findDuplicate } from '@/domain/models/app/tables/fields/field-types/validation-utils'
import { SPECIAL_FIELDS } from './table-formula-validation'

const validateViewIds = (
  views: ReadonlyArray<{ readonly id: string | number }>
): { readonly message: string; readonly path: ReadonlyArray<string> } | undefined => {
  const viewIds = views.map((view) => String(view.id))

  const duplicateId = findDuplicate(viewIds)

  if (duplicateId) {
    return {
      message: `Duplicate view id '${duplicateId}' - view id must be unique within the table`,
      path: ['views'],
    }
  }

  return undefined
}

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

const extractFieldReferencesFromFilter = (
  filterNode:
    | { readonly field: string; readonly operator: string; readonly value: unknown }
    | { readonly and: ReadonlyArray<unknown> }
    | { readonly or: ReadonlyArray<unknown> }
): ReadonlyArray<string> => {
  if ('field' in filterNode) {
    return [filterNode.field]
  }

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
  if ('field' in filterNode) {
    return [filterNode]
  }

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

const FIELD_TYPE_OPERATORS: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ['checkbox', new Set(['equals', 'isTrue', 'isFalse'])],
])

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
    .find((view) => !fieldNames.has(view.groupBy.field) && !SPECIAL_FIELDS.has(view.groupBy.field))

  if (invalidView) {
    return {
      message: `groupBy references non-existent field '${invalidView.groupBy.field}' - field not found in table`,
      path: ['views'],
    }
  }

  return undefined
}

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
