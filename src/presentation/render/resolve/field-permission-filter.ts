/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { recordFieldRefsIn } from '@/domain/models/app/pages/substitute-record-vars'
import {
  componentField,
  entryAsComponent,
  rewriteComponent,
  type ComponentEntry,
} from './component-rewrite'
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
  const content = componentField(component, 'content')
  const contentRefs = typeof content === 'string' ? extractFieldRefsFromString(content) : []

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
  children: readonly ComponentEntry[] | undefined,
  restrictedFields: ReadonlySet<string>
): readonly ComponentEntry[] | undefined {
  if (!children) return children
  return children
    .filter((child) => {
      if (typeof child === 'string') return true
      const refs = extractRecordFieldRefs(entryAsComponent(child))
      return !refs.some((ref) => restrictedFields.has(ref))
    })
    .map((child) => {
      if (typeof child === 'string') return child
      const node = entryAsComponent(child)
      return componentField(node, 'dataSource') !== undefined || !node.children
        ? child
        : rewriteComponent(node, {
            children: withoutRestrictedRefs(node.children, restrictedFields),
          })
    })
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
    component: rewriteComponent(component, {
      children: withoutRestrictedRefs(component.children, restrictedFields),
    }),
    fields: filteredFields,
  }
}
