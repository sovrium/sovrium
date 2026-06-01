/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { App } from '@/domain/models/app'

export const hasPageSearchComponent = (app: App): boolean => {
  const sharedComponents = app.components ?? []
  const sharedByName = new Map<string, unknown>(
    sharedComponents.map((component) => [component.name, component])
  )

  return (app.pages ?? []).some((page) =>
    componentTreeHasPageSearch(page.components, sharedByName, new Set())
  )
}

const readRefName = (node: Record<string, unknown>): string | undefined => {
  if (typeof node.$ref === 'string') return node.$ref
  if (typeof node.component === 'string') return node.component
  return undefined
}

const recurseChildren = (
  node: Record<string, unknown>,
  sharedByName: ReadonlyMap<string, unknown>,
  visiting: ReadonlySet<string>
): boolean => {
  const { children } = node
  return Array.isArray(children)
    ? componentTreeHasPageSearch(children, sharedByName, visiting)
    : false
}

const inspectReferencedComponent = (
  refName: string,
  sharedByName: ReadonlyMap<string, unknown>,
  visiting: ReadonlySet<string>
): boolean => {
  if (visiting.has(refName)) return false
  const target = sharedByName.get(refName)
  if (target === null || typeof target !== 'object') return false
  const targetNode = target as Record<string, unknown>
  if (targetNode.type === 'pageSearch') return true
  const nextVisiting = new Set([...visiting, refName])
  return recurseChildren(targetNode, sharedByName, nextVisiting)
}

const inspectNode = (
  item: unknown,
  sharedByName: ReadonlyMap<string, unknown>,
  visiting: ReadonlySet<string>
): boolean => {
  if (item === null || typeof item !== 'object') return false
  const node = item as Record<string, unknown>

  const refName = readRefName(node)
  if (refName !== undefined) {
    return inspectReferencedComponent(refName, sharedByName, visiting)
  }

  if (node.type === 'pageSearch') return true
  return recurseChildren(node, sharedByName, visiting)
}

function componentTreeHasPageSearch(
  items: readonly unknown[],
  sharedByName: ReadonlyMap<string, unknown>,
  visiting: ReadonlySet<string>
): boolean {
  return items.some((item) => inspectNode(item, sharedByName, visiting))
}
