/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { componentSlotsOf } from '@/domain/models/app/pages/components/component-types/component-type-union'
import type { Component } from '@/domain/models/app/pages/components'

/** One entry of a component list: a component, or a string child. */
export type ComponentListEntry = Component | string

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
 */
export function walkComponentSlots(
  component: Component,
  walk: (entries: readonly ComponentListEntry[]) => readonly ComponentListEntry[]
): Partial<Component> {
  const source = component as Readonly<Record<string, unknown>>
  return Object.fromEntries(
    componentSlotsOf(component.type)
      .filter((slot) => source[slot] !== undefined)
      .map((slot): readonly [string, unknown] => {
        const value = source[slot]
        if (Array.isArray(value)) return [slot, walk(value as readonly ComponentListEntry[])]
        if (typeof value !== 'object' || value === null) return [slot, value]
        return [slot, walk([value as Component])[0]]
      })
  ) as Partial<Component>
}
