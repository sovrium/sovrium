/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import type { Component } from '@/domain/models/app/pages/components'

interface OpenDrawerOnRowClick {
  readonly action: 'openDrawer'
  readonly component: string
}

function isOpenDrawerAction(value: unknown): value is OpenDrawerOnRowClick {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return record['action'] === 'openDrawer' && typeof record['component'] === 'string'
}

function collectIdsFromComponent(component: Component | string): readonly string[] {
  if (typeof component === 'string') return []
  const { onRowClick, children } = component as unknown as Record<string, unknown>
  const selfId = isOpenDrawerAction(onRowClick) ? [onRowClick.component] : []
  if (!Array.isArray(children)) return selfId
  const childIds = (children as readonly (Component | string)[]).flatMap(collectIdsFromComponent)
  return [...selfId, ...childIds]
}

function collectDispatchedDrawerIds(components: readonly Component[]): ReadonlySet<string> {
  return new Set(components.flatMap(collectIdsFromComponent))
}

function tagDrawerIfDispatched(
  component: Component,
  dispatchedIds: ReadonlySet<string>
): Component {
  const { type, id, props } = component as unknown as Record<string, unknown>
  if (type !== 'drawer') return component
  if (typeof id !== 'string' || !dispatchedIds.has(id)) return component
  const existingProps = (props as Record<string, unknown> | undefined) ?? {}
  return {
    ...component,
    props: { ...existingProps, _openDrawerDispatchedById: id },
  } as Component
}

function mapTree(
  components: readonly Component[],
  dispatchedIds: ReadonlySet<string>
): Component[] {
  return components.map((component) => {
    const tagged = tagDrawerIfDispatched(component, dispatchedIds)
    const { children } = tagged as unknown as Record<string, unknown>
    if (!Array.isArray(children)) return tagged
    const mappedChildren = mapTree(children as readonly Component[], dispatchedIds)
    return { ...tagged, children: mappedChildren } as Component
  })
}

export function resolveOpenDrawerDispatches(
  components: readonly Component[]
): readonly Component[] {
  const dispatchedIds = collectDispatchedDrawerIds(components)
  if (dispatchedIds.size === 0) return components
  return mapTree(components, dispatchedIds)
}
