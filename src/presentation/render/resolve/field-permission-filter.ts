/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { recordFieldRefsIn } from '@/domain/models/app/pages/substitute-record-vars'
import type { Component } from '@/domain/models/app/pages/components'

/**
 * Extracts $record.fieldName references from a string — through the one reader
 * the substitutor's grammar owns, so an escaped `\$record.x` (printed as text,
 * never filled) is not counted as a reference to `x`.
 */
const extractFieldRefsFromString = recordFieldRefsIn

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
 * The template children less every node that names a restricted field, at any
 * depth. A node carrying its own `dataSource` is an inner template over its own
 * rows — its `$record.` names THEIR fields — so it is judged on its own content
 * and props only, and its children are left for its own pass.
 */
function withoutRestrictedRefs(
  children: Component['children'],
  restrictedFields: ReadonlySet<string>
): Component['children'] {
  if (!children) return children
  return children
    .filter((child: Component | string) => {
      if (typeof child === 'string') return true
      return !extractRecordFieldRefs(child).some((ref) => restrictedFields.has(ref))
    })
    .map((child: Component | string) =>
      typeof child === 'string' || child.dataSource !== undefined || !child.children
        ? child
        : { ...child, children: withoutRestrictedRefs(child.children, restrictedFields) }
    )
}

/**
 * Filters children of a component to remove those that reference restricted
 * fields — however deep in the row template they sit, so a salary line inside
 * a card's container is dropped exactly as a direct child naming it is.
 * Also filters the requested fields list to exclude restricted fields from DB queries.
 *
 * `restrictedFields` comes from the composed read plan
 * (`ReadAccessPlan.restrictedColumns`). This module owns only the
 * COMPONENT-TREE half of the job — which `$record.*` references to drop — and
 * does not decide what is restricted.
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

  return {
    component: {
      ...component,
      children: withoutRestrictedRefs(component.children, restrictedFields),
    },
    fields: filteredFields,
  }
}
