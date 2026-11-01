/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isRecord } from '@/domain/kernel/config-parsing/plain-object'
import { componentSlotsOf } from '@/domain/models/app/pages/components/component-types/component-type-union'
import { componentFields, type ComponentEntry } from './component-rewrite'
import type { Component } from '@/domain/models/app/pages/components'

/** One entry of a component list: a component, an unexpanded reference, or a string child. */
export type ComponentListEntry = ComponentEntry

/**
 * A component's SLOTS — the component lists a type holds beside `children`
 * (a card's `footer`, a sidebar's `header`) — each passed through `walk`, the
 * same function a tree pass applies to `children`.
 *
 * A pass that rewrites a tree before it is drawn (the page record's `$record.*`,
 * a row's) must reach a slot exactly as it reaches `children`: the renderer
 * lays the slots out beside the children only at draw time
 * (`elements/slot-children.ts`), so a pass that walks `children` alone leaves
 * every token in a slot printed literally. The slot list is read from the
 * component-type union, never restated, so a type gaining a slot is walked
 * without a second edit here.
 *
 * Returns a PARTIAL holding only the slots the component carries. A slot that
 * holds ONE component (`card.action`) is walked as a one-entry list and comes
 * back as its single entry, or `undefined` when `walk` dropped it (a
 * `visibility.record` gate, for instance). A value that is neither a list nor a
 * component is returned untouched rather than guessed at.
 *
 * Each `responsive.<breakpoint>.children` is one more such list: the renderer
 * swaps it in for `children` at draw time, so a pass walking `children` alone
 * would leave it unfilled and ungated. The partial then holds `responsive`.
 */
export function walkComponentSlots(
  component: Component,
  walk: (entries: readonly ComponentListEntry[]) => readonly ComponentListEntry[]
): Readonly<Record<string, unknown>> {
  const source = componentFields(component)
  const slots = Object.fromEntries(
    componentSlotsOf(component.type)
      .filter((slot) => source[slot] !== undefined)
      .map((slot): readonly [string, unknown] => {
        const value = source[slot]
        if (Array.isArray(value)) return [slot, walk(value as readonly ComponentListEntry[])]
        if (typeof value !== 'object' || value === null) return [slot, value]
        return [slot, walk([value as ComponentListEntry])[0]]
      })
  )
  const { responsive } = source
  return isRecord(responsive)
    ? { ...slots, responsive: walkBreakpointChildren(responsive, walk) }
    : slots
}

/**
 * Every component list a node holds: `children`, its slots (a one-component slot
 * as a one-entry list) and each breakpoint's `children`. The lists
 * {@link walkComponentSlots} walks, for a pass that only reads them.
 */
export function componentEntryLists(
  component: Component
): readonly (readonly ComponentListEntry[])[] {
  const source = componentFields(component)
  const slots = componentSlotsOf(component.type).flatMap((slot) => {
    const value = source[slot]
    if (Array.isArray(value)) return [value as readonly ComponentListEntry[]]
    return typeof value === 'object' && value !== null ? [[value as ComponentListEntry]] : []
  })
  const { responsive } = source
  const breakpoints = isRecord(responsive)
    ? Object.values(responsive).flatMap((override) =>
        isRecord(override) && Array.isArray(override['children'])
          ? [override['children'] as readonly ComponentListEntry[]]
          : []
      )
    : []
  return [component.children ?? [], ...slots, ...breakpoints]
}

/** Each breakpoint with its `children` passed through `walk`; every other override untouched. */
const walkBreakpointChildren = (
  responsive: Readonly<Record<string, unknown>>,
  walk: (entries: readonly ComponentListEntry[]) => readonly ComponentListEntry[]
): Readonly<Record<string, unknown>> =>
  Object.fromEntries(
    Object.entries(responsive).map(([breakpoint, override]) => [
      breakpoint,
      isRecord(override) && Array.isArray(override['children'])
        ? { ...override, children: walk(override['children'] as readonly ComponentListEntry[]) }
        : override,
    ])
  )
