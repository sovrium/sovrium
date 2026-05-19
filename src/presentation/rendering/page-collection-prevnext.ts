/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'
import type { DataFilter } from '@/domain/models/app/pages/components/data-source'
import type { DataSourceDb } from '@/presentation/rendering/data-source-resolver'

export interface CollectionAdjacency {
  readonly previous: Readonly<Record<string, unknown>> | undefined
  readonly next: Readonly<Record<string, unknown>> | undefined
}

export async function fetchCollectionAdjacency(
  collection: NonNullable<Page['collection']>,
  resolvedRecord: Record<string, unknown>,
  db: DataSourceDb
): Promise<CollectionAdjacency> {
  const records = await db.fetchRecords(collection.table, {
    filter: collection.filter as readonly DataFilter[] | undefined,
    sort: [{ field: 'id', direction: 'asc' }],
  })

  const slugValue = resolvedRecord[collection.slugField]
  const index = records.findIndex((r) => r[collection.slugField] === slugValue)
  if (index < 0) return { previous: undefined, next: undefined }

  const previous = index > 0 ? records[index - 1] : undefined
  const next = index < records.length - 1 ? records[index + 1] : undefined
  return { previous, next }
}

export function substituteCollectionVars(text: string, adjacency: CollectionAdjacency): string {
  return text.replace(
    /\$collection\.(previous|next)\.([a-zA-Z0-9_]+)/g,
    (_, side: 'previous' | 'next', fieldName: string) => {
      const record = side === 'previous' ? adjacency.previous : adjacency.next
      if (record === undefined) return ''
      const value = record[fieldName]
      return value !== undefined ? String(value) : ''
    }
  )
}

function detectCollectionSides(text: string): ReadonlySet<'previous' | 'next'> {
  const matches = [...text.matchAll(/\$collection\.(previous|next)\./g)]
  return new Set(matches.map((m) => m[1] as 'previous' | 'next'))
}

function gatherCollectionSides(component: Component): ReadonlySet<'previous' | 'next'> {
  const contentSides =
    typeof component.content === 'string' ? [...detectCollectionSides(component.content)] : []
  const propSides = component.props
    ? Object.values(component.props).flatMap((value) =>
        typeof value === 'string' ? [...detectCollectionSides(value)] : []
      )
    : []
  return new Set([...contentSides, ...propSides])
}

function componentRefsNullSide(component: Component, adjacency: CollectionAdjacency): boolean {
  const sides = gatherCollectionSides(component)
  if (sides.has('previous') && adjacency.previous === undefined) return true
  if (sides.has('next') && adjacency.next === undefined) return true
  return false
}

function substituteCollectionInProps(
  props: Record<string, unknown>,
  adjacency: CollectionAdjacency
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(props).map(([key, value]) => [
      key,
      typeof value === 'string' ? substituteCollectionVars(value, adjacency) : value,
    ])
  )
}

export function substituteCollectionInComponent(
  component: Component,
  adjacency: CollectionAdjacency
): Component | undefined {
  if (componentRefsNullSide(component, adjacency)) return undefined

  const filteredChildren = component.children
    ?.map((child: Component | string): Component | string | undefined =>
      typeof child === 'string'
        ? substituteCollectionVars(child, adjacency)
        : substituteCollectionInComponent(child, adjacency)
    )
    .filter(
      (child: Component | string | undefined): child is Component | string => child !== undefined
    )

  return {
    ...component,
    props: component.props
      ? substituteCollectionInProps(component.props, adjacency)
      : component.props,
    content:
      typeof component.content === 'string'
        ? substituteCollectionVars(component.content, adjacency)
        : component.content,
    ...(filteredChildren !== undefined ? { children: filteredChildren } : {}),
  }
}

export function substituteCollectionInPageComponents(
  components: Page['components'],
  adjacency: CollectionAdjacency
): Page['components'] {
  if (!components) return components
  return components
    .map((item) => {
      if ('component' in item || '$ref' in item) return item
      return substituteCollectionInComponent(item as Component, adjacency)
    })
    .filter((item): item is NonNullable<typeof item> => item !== undefined)
}

export function substituteCollectionInMeta(
  meta: Page['meta'],
  adjacency: CollectionAdjacency
): Page['meta'] {
  if (meta === undefined) return meta
  return {
    ...meta,
    ...(meta.title !== undefined ? { title: substituteCollectionVars(meta.title, adjacency) } : {}),
    ...(meta.description !== undefined
      ? { description: substituteCollectionVars(meta.description, adjacency) }
      : {}),
    ...(meta.keywords !== undefined
      ? { keywords: substituteCollectionVars(meta.keywords, adjacency) }
      : {}),
  }
}
