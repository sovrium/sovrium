/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Component } from '@/domain/models/app/pages/components'

/**
 * Extracts $record.fieldName references from a string.
 */
const extractFieldRefsFromString = (s: string): readonly string[] =>
  [...s.matchAll(/\$record\.([a-zA-Z0-9_]+)/g)].map((m) => m[1] as string)

/**
 * Extracts the set of field names referenced via $record.* in a component's content and props.
 */
function extractRecordFieldRefs(component: Component): readonly string[] {
  const contentRefs =
    typeof component.content === 'string' ? extractFieldRefsFromString(component.content) : []

  const propRefs = component.props
    ? Object.values(component.props).flatMap((v) =>
        typeof v === 'string' ? extractFieldRefsFromString(v) : []
      )
    : []

  return [...contentRefs, ...propRefs]
}

/**
 * Determines which fields the current user role is NOT allowed to read,
 * based on the table's field-level permissions configuration.
 */
export function getRestrictedFields(
  tablePermissions:
    | { readonly fields?: readonly { readonly field: string; readonly read?: unknown }[] }
    | undefined,
  userRole: string
): ReadonlySet<string> {
  if (!tablePermissions?.fields) return new Set()

  return new Set(
    tablePermissions.fields
      .filter((fp) => {
        if (!fp.read) return false
        if (fp.read === 'all') return false
        if (fp.read === 'authenticated') return false
        if (Array.isArray(fp.read)) return !fp.read.includes(userRole)
        return false
      })
      .map((fp) => fp.field)
  )
}

/**
 * Filters children of a component to remove those that reference restricted fields.
 * Also filters the requested fields list to exclude restricted fields from DB queries.
 */
export function applyFieldLevelPermissions(
  component: Component,
  requestedFields: readonly string[] | undefined,
  restrictedFields: ReadonlySet<string>
): { readonly component: Component; readonly fields: readonly string[] | undefined } {
  if (restrictedFields.size === 0) return { component, fields: requestedFields }

  const filteredFields = requestedFields
    ? requestedFields.filter((f) => !restrictedFields.has(f))
    : requestedFields

  const filteredChildren = component.children
    ? component.children.filter((child: Component | string) => {
        if (typeof child === 'string') return true
        const childRefs = extractRecordFieldRefs(child)
        return !childRefs.some((ref) => restrictedFields.has(ref))
      })
    : component.children

  return {
    component: { ...component, children: filteredChildren },
    fields: filteredFields,
  }
}
