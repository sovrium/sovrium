/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Components } from '@/domain/models/app/components'

type UnknownRecord = Record<string, unknown>

function referenceName(item: UnknownRecord): string | undefined {
  const ref = item['component'] ?? item['$ref']
  return typeof ref === 'string' ? ref : undefined
}

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
