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

/**
 * The attribute stamped on a node whose children the page record gates.
 *
 * A gated child is OMITTED, so once a write moves the record the branch it now
 * calls for is not in the document at all, and the page keeps offering the
 * branch the record has left (a Disable beside a link already disabled). The
 * parent is the smallest node that holds both branches, so it is the region a
 * write has to redraw: every `onSuccess.refetch` on the page names it too, and
 * the browser re-reads it from a fresh render
 * (`islands/runtime/refetch-server-rendered-region.ts`), where the server
 * decides the gates again rather than the browser re-deciding them.
 *
 * The region keeps the author's `id`, or takes one derived from its position in
 * the AUTHORED tree, which names the same node in every render whatever the
 * record decides.
 */
export const RECORD_GATED_REGION_ATTRIBUTE = 'data-record-region'

/**
 * Stamp {@link RECORD_GATED_REGION_ATTRIBUTE} (and an `id` when the author gave
 * none) on every node of a page bound to one record that has a child gated on
 * that record, and add those ids to every `onSuccess.refetch` on the page. Run
 * on the tree as authored, before the gates drop anything. Stops at a node
 * holding its own `dataSource`, whose rows its gates read instead, and at an
 * unexpanded reference. A page with no gated child is returned as it was.
 */
export function markRecordGatedRegions(
  entries: readonly ComponentListEntry[]
): readonly ComponentListEntry[] {
  const stamped = stampRegions(entries, 'record-region')
  const ids = regionIdsOf(stamped)
  return ids.length === 0 ? entries : (withRegionRefetch(stamped, ids) as typeof entries)
}

function stampRegions(
  entries: readonly ComponentListEntry[],
  path: string
): readonly ComponentListEntry[] {
  return entries.map((entry, index) =>
    typeof entry === 'string' || 'component' in entry || '$ref' in entry
      ? entry
      : stampRegion(entryAsComponent(entry), `${path}-${index}`)
  )
}

const stampRegion = (component: Component, path: string): Component => {
  const { children } = component
  if (children === undefined || componentField(component, 'dataSource') !== undefined)
    return component
  const props = (componentField(component, 'props') ?? {}) as Readonly<Record<string, unknown>>
  return rewriteComponent(component, {
    children: stampRegions(children, path),
    ...(children.every(hasNoRecordGate)
      ? {}
      : { props: { id: path, ...props, [RECORD_GATED_REGION_ATTRIBUTE]: '' } }),
  })
}

/** The ids of the stamped regions, in document order. */
const regionIdsOf = (value: unknown): readonly string[] => {
  if (Array.isArray(value)) return value.flatMap(regionIdsOf)
  if (typeof value !== 'object' || value === null) return []
  const { props, children } = value as { readonly props?: unknown; readonly children?: unknown }
  const own =
    typeof props === 'object' && props !== null && RECORD_GATED_REGION_ATTRIBUTE in props
      ? [String((props as Readonly<Record<string, unknown>>)['id'])]
      : []
  return [...own, ...regionIdsOf(children)]
}

/** Every `onSuccess.refetch` below `value`, with the region ids added. */
const withRegionRefetch = (value: unknown, ids: readonly string[]): unknown => {
  if (Array.isArray(value)) return value.map((item) => withRegionRefetch(item, ids))
  if (typeof value !== 'object' || value === null) return value
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => {
      const refetch = key === 'onSuccess' ? keyOfRefetch(child) : undefined
      return [
        key,
        refetch === undefined
          ? withRegionRefetch(child, ids)
          : { ...(child as object), refetch: [...new Set([...[refetch].flat(), ...ids])] },
      ]
    })
  )
}

const keyOfRefetch = (onSuccess: unknown): string | readonly string[] | undefined =>
  typeof onSuccess === 'object' && onSuccess !== null
    ? ((onSuccess as { readonly refetch?: string | readonly string[] }).refetch ?? undefined)
    : undefined
