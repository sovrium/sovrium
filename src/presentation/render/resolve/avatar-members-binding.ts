/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * An avatar group whose members are read from records: `dataSource` +
 * `userField` (one person per row of a join table), or `users:
 * $record.<field>` (a multi-person `user` field of the page's record).
 *
 * Both become the group's `items` here, on the server: each person once, in
 * the order the rows (or the field) name them, labelled with her name as the
 * records API gives it to THIS reader (`readRecordLabels`). The rows were read
 * through the records gate, so a row the reader may not read is neither drawn
 * nor counted in `+N`, and no name of it reaches the page. The group is marked
 * (`props._avatarTooltips`) so each disc names its person in a tooltip.
 */

import type { DataSourceDb } from './data-source-contracts'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { Component } from '@/domain/models/app/pages/components'

type Row = Readonly<Record<string, unknown>>

/** What the binding needs to name the people it draws. */
export interface AvatarMembersContext {
  readonly app: App
  readonly session: SessionInfo | undefined
  readonly db: DataSourceDb
}

/** The group with these people as its members, marked for its tooltips. */
const withMembers = <C extends { readonly props?: unknown }>(
  component: C,
  names: readonly string[]
): C => ({
  ...component,
  items: names.map((label) => ({ label })),
  props: { ...((component.props ?? {}) as Row), _avatarTooltips: true },
})

/** One label of a labels block, as a list of names. */
const namesOf = (label: unknown): readonly string[] => {
  if (Array.isArray(label)) return label.filter((name): name is string => typeof name === 'string')
  return typeof label === 'string' && label !== '' ? [label] : []
}

/**
 * A bound avatar group (`dataSource` + `userField`) with its members taken from
 * `rows`; any other component comes back as it is.
 */
export async function withAvatarMembers<
  C extends {
    readonly type: string
    readonly props?: unknown
    readonly dataSource?: { readonly table?: unknown }
  },
>(component: C, rows: readonly Row[], ctx: AvatarMembersContext): Promise<C> {
  const { userField } = component as { readonly userField?: unknown }
  const table = component.dataSource?.table
  const label = ctx.db.readRecordLabels
  if (component.type !== 'avatar' || typeof userField !== 'string' || typeof table !== 'string')
    return component
  // One person per id, at her first row: two attendances of one person are one face.
  const people = [
    ...new Map(
      rows.flatMap((row) => {
        const id = row[userField]
        return id === null || id === undefined || id === '' ? [] : [[String(id), row] as const]
      })
    ).values(),
  ]
  const labels = (await label?.(ctx.app, table, people, ctx.session)) ?? []
  return withMembers(
    component,
    labels.flatMap((labelled) => namesOf(labelled?.[userField]))
  )
}

/** `users: $record.<field>` — the field a group draws its people from. */
const usersField = (node: Row): string | undefined =>
  node['type'] === 'avatar' && typeof node['users'] === 'string'
    ? /^\$record\.([A-Za-z_]\w*)$/.exec(node['users'].trim())?.[1]
    : undefined

/**
 * The page's components with every `users: $record.<field>` group given the
 * people of that field of the page's record, named as `labels` (the record's
 * labels for this reader) names them. Walks containers; a node with nothing to
 * fill comes back by reference.
 */
export function withAvatarUsers<T>(
  components: T,
  labels: Readonly<Record<string, unknown>> | undefined
): T {
  if (!Array.isArray(components) || labels === undefined) return components
  const fill = (entry: unknown): unknown => {
    if (typeof entry !== 'object' || entry === null) return entry
    const node = entry as Row
    const field = usersField(node)
    if (field !== undefined) return withMembers(node as Component, namesOf(labels[field]))
    const { children } = node
    return Array.isArray(children) ? { ...node, children: children.map(fill) } : node
  }
  return components.map(fill) as T
}

/** The page's components as a collection page's record fills them, when a filler is given. */
export const filledFromRecord = async <T>(
  fill: ((components: T, record: Row) => Promise<T>) | undefined,
  components: T,
  record: Row
): Promise<T> => (fill === undefined ? components : fill(components, record))
