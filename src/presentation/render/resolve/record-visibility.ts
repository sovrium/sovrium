/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * PER-ROW component visibility — `visibility.record`.
 *
 * The session-scoped gates (`when` / `roles` / `condition`) are applied by
 * `visibility-filter.ts` in `applyVisibilityToComponents`, which runs over the
 * page's TOP-LEVEL components before any data source has been resolved. Inside a
 * row template that is the wrong moment and the wrong subject twice over: there
 * is no record yet, and `condition.field` resolves `$user.*` against the SESSION,
 * so it returns the same answer on every row of the list.
 *
 * This module is the other half. It runs where the record exists — as each row
 * of a list / gallery / kanban / collection page is expanded from its template —
 * and OMITS a component whose predicate the row fails.
 *
 * OMITTED, NOT HIDDEN. `when`/`roles` inject `display: none` so the DOM survives
 * for client-side rehydration; there is nothing to rehydrate here, and a link
 * that must not exist for this record must not be findable in the page source
 * either.
 *
 * The predicate itself is `FieldConditionSchema` from
 * `@/domain/models/app/tables/condition-operators`, matched by the shared
 * `satisfiesFieldCondition` — the same pair a `table` action item's
 * `visibleWhen` and a `button` field's `visibleWhen` already spend, so the three
 * ways of saying "show this on some records and not others" cannot drift apart.
 */

import { satisfiesFieldCondition } from '@/domain/models/app/tables/condition-operators'
import type { Component } from '@/domain/models/app/pages/components'
import type { FieldCondition } from '@/domain/models/app/tables/condition-operators'

/**
 * The `visibility.record` predicate declared on a node, from either of the two
 * conventions the codebase carries: the component ROOT (where the schema spreads
 * `visibilityFields`) or `props.visibility` (the runtime convention
 * `visibility-filter.ts` reads). `isComponentHiddenForSession` tolerates both for
 * the same reason.
 */
function readRecordCondition(
  node: unknown,
  gate: 'record' | 'item' = 'record'
): FieldCondition | undefined {
  if (typeof node !== 'object' || node === null) return undefined
  const obj = node as {
    readonly visibility?: unknown
    readonly props?: Record<string, unknown>
  }
  const fromRoot = obj.visibility
  const fromProps = obj.props?.['visibility']
  const visibility = (typeof fromRoot === 'object' && fromRoot !== null ? fromRoot : fromProps) as
    Readonly<Record<string, unknown>> | undefined
  const condition = visibility?.[gate]
  return typeof condition === 'object' && condition !== null
    ? (condition as FieldCondition)
    : undefined
}

/**
 * True when a node may render for this record.
 *
 * A node declaring no `visibility.record` is always visible — the
 * backward-compatible default every already-shipped row template relies on.
 * A string child (raw text in a template) declares nothing and is never gated.
 */
export function isVisibleForRecord(
  node: Component | string,
  record: Readonly<Record<string, unknown>>
): boolean {
  if (typeof node === 'string') return true
  return satisfiesFieldCondition(readRecordCondition(node), record)
}

/**
 * Drop the children this record must not see, before the survivors are
 * substituted.
 *
 * Applied at every site that expands or substitutes a template against a record,
 * so the gate reaches ANY depth of a row template rather than only its immediate
 * children.
 */
export function filterChildrenForRecord(
  children: readonly (Component | string)[],
  record: Readonly<Record<string, unknown>>
): readonly (Component | string)[] {
  return children.filter((child) => isVisibleForRecord(child, record))
}

/**
 * Drop the children of one repeat copy that `visibility.item` keeps out: the
 * PER-ELEMENT gate, matched against the element the copy is drawn from, with
 * the same matcher `visibility.record` spends. A node declaring no item gate is
 * always kept. Only the binding pass of a page bound to one record expands a
 * repeat with it; the decode rule refuses the gate everywhere else.
 */
export function filterChildrenForElement(
  children: readonly (Component | string)[],
  element: unknown
): readonly (Component | string)[] {
  const fields =
    typeof element === 'object' && element !== null && !Array.isArray(element)
      ? (element as Readonly<Record<string, unknown>>)
      : {}
  return children.filter(
    (child) =>
      typeof child === 'string' ||
      satisfiesFieldCondition(readRecordCondition(child, 'item'), fields)
  )
}
