/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Components } from '@/domain/models/app/components'

type UnknownRecord = Record<string, unknown>

/** Reads a `{ component: 'name' }` / `{ $ref: 'name' }` reference name, if any. */
function referenceName(item: UnknownRecord): string | undefined {
  const ref = item['component'] ?? item['$ref']
  return typeof ref === 'string' ? ref : undefined
}

/**
 * Reference-aware component-tree search shared by every page-level feature
 * detector (island runtime, interactive `client.js`, no-FOUC color-scheme
 * script). Walks a page's component items AND descends into referenced
 * `app.components` templates — a shared `site-header` template hosting a
 * `dropdown-menu` / `theme-toggle` must trigger the same runtime injection as
 * the equivalent page-direct authoring.
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
  predicate: (item: UnknownRecord) => boolean,
  visitedRefs: ReadonlySet<string> = new Set<string>()
): boolean {
  if (!items || items.length === 0) return false
  return items.some((item) => {
    if (item === null || typeof item !== 'object') return false
    const record = item as UnknownRecord
    const name = referenceName(record)
    if (name !== undefined) {
      if (visitedRefs.has(name)) return false
      const template = templates?.find((t) => t.name === name)
      if (!template) return false
      // The template node is itself a component (type/children/...) — test it
      // and descend, with the reference marked visited along this path.
      return someComponentInTree(
        [template],
        templates,
        predicate,
        new Set<string>([...visitedRefs, name])
      )
    }
    if (predicate(record)) return true
    const { children } = record
    return Array.isArray(children)
      ? someComponentInTree(children, templates, predicate, visitedRefs)
      : false
  })
}
