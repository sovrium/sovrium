/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Component } from '@/domain/models/app/pages/components'

const extractFieldRefsFromString = (s: string): readonly string[] =>
  [...s.matchAll(/\$record\.([a-zA-Z0-9_]+)/g)].map((m) => m[1] as string)

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
