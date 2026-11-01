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

import { COMPONENT_LENGTH_RULES } from '@/domain/models/app/pages/components/component-types/component-xor-rules'
import { satisfiesFieldCondition } from '@/domain/models/app/tables/condition-operators'
import { componentField, entryAsComponent, rewriteComponent } from './component-rewrite'
import { walkComponentSlots, type ComponentListEntry } from './component-slot-walk'
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
  node: object | string,
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
export function filterChildrenForRecord<T extends object | string>(
  children: readonly T[],
  record: Readonly<Record<string, unknown>>
): readonly T[] {
  return children.filter((child) => isVisibleForRecord(child, record))
}

/**
 * The label lists that name a node's `children` by position (`tabs.panels`,
 * `stepper.steps`, read from the rule that holds them to one length), each
 * without the labels of the children `isKept` refuses. A dropped body must take
 * its label with it, or every later body slides under the wrong one and the
 * label of a withheld body still reaches the page. Pass the labels as
 * substituted. A list of another length is not aligned, and is left out.
 */
export function labelsFollowingChildren<T>(
  node: object,
  children: readonly T[],
  isKept: (child: T) => boolean
): Readonly<Record<string, unknown>> {
  const fields = node as Readonly<Record<string, unknown>>
  return Object.fromEntries(
    COMPONENT_LENGTH_RULES.filter(
      (rule) => rule.type === fields['type'] && rule.keys[1] === 'children'
    ).flatMap((rule) => {
      const labels = fields[rule.keys[0]]
      return Array.isArray(labels) && labels.length === children.length
        ? [[rule.keys[0], labels.filter((_, index) => isKept(children[index] as T))]]
        : []
    })
  )
}

/** {@link labelsFollowingChildren} for the children `record` keeps. */
export const labelsFollowingRecord = (
  node: object,
  children: readonly (object | string)[],
  record: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> =>
  labelsFollowingChildren(node, children, (child) => isVisibleForRecord(child, record))

/**
 * Drop every node holding a `visibility.record` gate, for a page that hands its
 * components no record to read: no match without a record, whatever the
 * operator, and `isEmpty` or `neq` would otherwise pass against nothing.
 *
 * A named template can carry a gate onto such a page, where decoding could not
 * refuse it. The walk reads children, slots and breakpoint children, and stops
 * at a node holding its own `dataSource`, whose descendants read that binding's
 * rows; the node's OWN gate is still matched here, since a binding never gates
 * itself.
 */
export function omitRecordGatedEntries(
  entries: readonly ComponentListEntry[]
): readonly ComponentListEntry[] {
  return entries
    .filter(hasNoRecordGate)
    .map((entry) =>
      typeof entry === 'string' ? entry : omitRecordGatesBelow(entryAsComponent(entry))
    )
}

const omitRecordGatesBelow = (component: Component): Component => {
  if (componentField(component, 'dataSource') !== undefined) return component
  const { children } = component
  return rewriteComponent(component, {
    ...walkComponentSlots(component, omitRecordGatedEntries),
    ...(children === undefined
      ? {}
      : {
          children: omitRecordGatedEntries(children),
          ...labelsFollowingChildren(component, children, hasNoRecordGate),
        }),
  })
}

const hasNoRecordGate = (entry: object | string): boolean =>
  typeof entry === 'string' || readRecordCondition(entry) === undefined

/**
 * Drop the children of one repeat copy that `visibility.item` keeps out: the
 * PER-ELEMENT gate, matched against the element the copy is drawn from, with
 * the same matcher `visibility.record` spends. A node declaring no item gate is
 * always kept. Only the binding pass of a page bound to one record expands a
 * repeat with it; the decode rule refuses the gate everywhere else.
 */
export function filterChildrenForElement<T extends object | string>(
  children: readonly T[],
  element: unknown
): readonly T[] {
  return children.filter((child) => isVisibleForElement(child, element))
}

/** {@link labelsFollowingChildren} for the children the copy drawn from `element` keeps. */
export const labelsFollowingElement = (
  node: object,
  children: readonly (object | string)[],
  element: unknown
): Readonly<Record<string, unknown>> =>
  labelsFollowingChildren(node, children, (child) => isVisibleForElement(child, element))

/** True when a node may render in the copy drawn from `element`. */
function isVisibleForElement(node: object | string, element: unknown): boolean {
  const fields =
    typeof element === 'object' && element !== null && !Array.isArray(element)
      ? (element as Readonly<Record<string, unknown>>)
      : {}
  return (
    typeof node === 'string' || satisfiesFieldCondition(readRecordCondition(node, 'item'), fields)
  )
}
