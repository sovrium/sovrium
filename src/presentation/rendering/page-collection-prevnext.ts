/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Collection prev/next adjacency resolution (US-PAGES-COLLECTION-PAGES-004).
 *
 * Lives in its own module so `page-collection-resolver.ts` stays below the
 * line cap. Two responsibilities:
 *
 *   1. Walk the same filtered + sorted record list the collection page
 *      uses to determine the previous / next record relative to the
 *      currently-resolved record (matched by `slugField`).
 *   2. Provide a substitution + filter pass that:
 *        - replaces `$collection.previous.<field>` and
 *          `$collection.next.<field>` tokens in component props/content
 *          and in `meta` strings, and
 *        - drops link/text components whose tokens reference a `null`
 *          previous/next so the rendered DOM contains no prev/next link
 *          for boundary records (first record has `previous` null; last
 *          record has `next` null).
 *
 * Because the schema doesn't expose a `collection.sort` knob yet, we use
 * the same default `id ASC` order PostgreSQL gives when no `ORDER BY` is
 * supplied — matched by passing `[{ field: 'id', direction: 'asc' }]` as
 * an explicit sort to `db.fetchRecords`. This keeps the order
 * deterministic across runs without requiring a schema change.
 */

import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'
import type { DataFilter } from '@/domain/models/app/pages/components/data-source'
import type { DataSourceDb } from '@/presentation/rendering/data-source-resolver'

/**
 * Adjacent records relative to the resolved collection record.
 *
 * Either side is `undefined` for boundary records:
 *   - `previous` is undefined when the resolved record is the first in
 *     the filtered + sorted list.
 *   - `next` is undefined when the resolved record is the last.
 */
export interface CollectionAdjacency {
  readonly previous: Readonly<Record<string, unknown>> | undefined
  readonly next: Readonly<Record<string, unknown>> | undefined
}

/**
 * Fetches all records that match the collection filter, sorted by `id`
 * ascending, then locates the index of the currently-resolved record by
 * its slug field. Returns previous / next neighbours (or undefined for
 * boundaries).
 *
 * Returns `{ previous: undefined, next: undefined }` when the resolved
 * record can't be located in the list (defensive — should not happen in
 * practice because the caller already fetched the same record via
 * `fetchSingleRecord`).
 */
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

/**
 * Replaces `$collection.previous.<field>` and `$collection.next.<field>`
 * placeholders in a string with the matching column values from the
 * adjacent records. Tokens whose target record is `undefined` resolve to
 * empty strings — but the component containing them is removed
 * altogether by `substituteCollectionInComponent`, so a stray empty
 * string never reaches the rendered DOM.
 */
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

/**
 * Detects which `$collection.<side>.<field>` tokens appear in a string.
 * Returns the set of sides referenced (`'previous'` and/or `'next'`) so
 * the caller can decide whether the component must be dropped because
 * the corresponding record is null.
 */
function detectCollectionSides(text: string): ReadonlySet<'previous' | 'next'> {
  const matches = [...text.matchAll(/\$collection\.(previous|next)\./g)]
  return new Set(matches.map((m) => m[1] as 'previous' | 'next'))
}

/**
 * Walks a component's content and prop string values to gather every
 * `$collection.<side>.<field>` reference. Used to decide whether the
 * component should be filtered out (when the referenced side is null).
 */
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

/**
 * Returns `true` when the component (or any string descendant) references
 * a side whose record is null — meaning the component should not be
 * rendered.
 */
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

/**
 * Recursively substitutes `$collection.previous.*` and
 * `$collection.next.*` tokens in a component's props, content, and
 * children. Returns `undefined` when the component (at any descendant
 * level relevant to the side it references) has a null adjacent record —
 * the caller filters out undefined entries from the parent's `children`
 * list.
 */
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

/**
 * Substitutes `$collection.<side>.<field>` tokens in every top-level
 * page component, dropping any component that references a null side.
 */
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

/**
 * Substitutes `$collection.<side>.<field>` tokens in the page-level meta
 * strings (title, description, keywords). Mirrors
 * `substituteRecordInMeta` in `page-collection-resolver.ts`.
 */
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
