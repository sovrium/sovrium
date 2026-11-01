/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { componentSlotsOf } from '@/domain/models/app/pages/components/component-types/component-type-union'
import { placementChildrenOf, placementSlotsOf } from './component-template-slot'
import type { Components } from '@/domain/models/app/components'
import type { Component } from '@/domain/models/app/pages/components'

type UnknownRecord = Record<string, unknown>

/** Reads a `{ component: 'name' }` / `{ $ref: 'name' }` reference name, if any. */
function referenceName(item: UnknownRecord): string | undefined {
  const ref = item['component'] ?? item['$ref']
  return typeof ref === 'string' ? ref : undefined
}

/**
 * The page components a node holds BESIDE its own `children`: a reference's
 * placement (its `children` and named `slots`, which the expansion drops into
 * the template), or a type's slots (a card's `footer`, a dialog's `footer`),
 * each a list or, for a single-component slot, one node.
 */
function slottedEntriesOf(item: UnknownRecord, isReference: boolean): readonly unknown[] {
  if (isReference) {
    return [...placementChildrenOf(item), ...Object.values(placementSlotsOf(item)).flat()]
  }
  const { type } = item
  if (typeof type !== 'string') return []
  return componentSlotsOf(type).flatMap((slot) => {
    const value = item[slot]
    return Array.isArray(value) ? value : [value]
  })
}

/**
 * Reference-aware component-tree search shared by every page-level feature
 * detector (island runtime, interactive `client.js`, no-FOUC color-scheme
 * script). Walks a page's component items AND descends into referenced
 * `app.components` templates — a shared `site-header` template hosting a
 * `dropdown-menu` / `theme-toggle` must trigger the same runtime injection as
 * the equivalent page-direct authoring.
 *
 * The components a page places into a template (a reference's `children` and
 * `slots`) and the ones a type holds in a slot (a card's `footer`) are walked
 * as `children` are: they are drawn on the page like any other, so an island
 * there needs the same runtime — the bundle and the script tag decide through
 * this one walk, which is what keeps the two in agreement.
 *
 * `visitedRefs` is path-scoped so a self-referencing (or mutually-referencing)
 * template cannot loop the walker; a repeated reference along one path is
 * simply skipped.
 *
 * @param items - Page component items (direct components, references, strings)
 * @param templates - `app.components` templates used to resolve references
 * @param predicate - Tested against every non-reference component node
 * @returns true when any node in the (reference-expanded) tree matches
 */
export function someComponentInTree(
  items: readonly unknown[] | undefined,
  templates: Components | undefined,
  predicate: (item: Component) => boolean,
  visitedRefs: ReadonlySet<string> = new Set<string>()
): boolean {
  if (!items || items.length === 0) return false
  return items.some((item) => {
    if (item === null || typeof item !== 'object') return false
    const record = item as UnknownRecord
    const name = referenceName(record)
    if (name !== undefined) {
      return someInReference(record, name, { templates, predicate, visitedRefs })
    }
    if (predicate(item as Component)) return true
    const { children } = record
    const inChildren =
      Array.isArray(children) && someComponentInTree(children, templates, predicate, visitedRefs)
    return (
      inChildren ||
      someComponentInTree(slottedEntriesOf(record, false), templates, predicate, visitedRefs)
    )
  })
}

/**
 * A reference: the components it places, then the template it names — tested
 * and descended with the reference marked visited along this path.
 */
function someInReference(
  reference: UnknownRecord,
  name: string,
  walk: {
    readonly templates: Components | undefined
    readonly predicate: (item: Component) => boolean
    readonly visitedRefs: ReadonlySet<string>
  }
): boolean {
  const { templates, predicate, visitedRefs } = walk
  const placed = slottedEntriesOf(reference, true)
  if (someComponentInTree(placed, templates, predicate, visitedRefs)) return true
  if (visitedRefs.has(name)) return false
  const template = templates?.find((t) => t.name === name)
  if (!template) return false
  return someComponentInTree([template], templates, predicate, new Set([...visitedRefs, name]))
}
