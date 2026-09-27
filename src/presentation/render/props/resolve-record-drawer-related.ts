/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isOpenToEveryone, toPermissionValue } from '@/domain/models/app/auth/permission-evaluation'
import {
  hasCreatePermission,
  hasReadPermission,
} from '@/domain/models/app/auth/permission-evaluator-service'
import { declaredFieldLabel } from '@/presentation/design/field-display'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { Component } from '@/domain/models/app/pages/components'
import type { Tables } from '@/domain/models/app/tables'

/**
 * The render-time-only marker saying the caller is ANONYMOUS in an app that
 * has `auth` configured.
 *
 * Private to the renderer, like `_openDrawerDispatchedById`. It exists because
 * the component renderer holds the session but not `app.auth`, and the two
 * cases a missing session can mean are opposite: in an app without auth every
 * records route is open, while in an app WITH auth the records API admits an
 * anonymous caller only to a table whose `permissions.read` is the `'all'`
 * literal, and never to a write. Stamped by {@link markRelatedGuestCaller} in
 * the page pipeline, which holds both. An author who writes it themselves can
 * only make the sections stricter, never looser.
 */
export const RELATED_GUEST_CALLER_KEY = '_relatedGuestCaller'

/** How many rows a section lists when its entry declares no `limit`. */
const DEFAULT_RELATED_LIMIT = 10

/** One column as the island draws it: the field, its resolved header, its type. */
export interface RelatedSectionColumn {
  readonly field: string
  readonly label: string
  readonly type: string
}

/**
 * One related section, resolved for the island ([internal ref] CAP-8).
 *
 * Everything the browser cannot answer on its own is answered here: the
 * column headers (from the related table's field schema) and whether the
 * caller may CREATE in the related table (from the session role, which the
 * island never receives). Whether the caller may READ it is answered by
 * leaving the section out altogether — see {@link resolveRelatedSections}.
 */
export interface RelatedSection {
  readonly label: string
  readonly table: string
  readonly field: string
  readonly columns: readonly RelatedSectionColumn[]
  readonly sort?: readonly { readonly field: string; readonly direction: 'asc' | 'desc' }[]
  readonly limit: number
  readonly emptyMessage?: string
  readonly onRowClick?: unknown
  readonly canCreate: boolean
}

type Table = NonNullable<Tables>[number]
type RawEntry = Readonly<Record<string, unknown>>

/** The caller a section is resolved for: the session, and whether it is an auth-app guest. */
export interface RelatedCaller {
  readonly session: SessionInfo | undefined
  readonly guest: boolean
}

/**
 * Stamp {@link RELATED_GUEST_CALLER_KEY} on every drawer declaring `related`
 * when the caller is anonymous in an app with auth. Returns the tree untouched
 * otherwise, so no other page pays for the walk.
 */
export function markRelatedGuestCaller(
  components: readonly Component[],
  guest: boolean
): readonly Component[] {
  if (!guest) return components
  const mark = (component: Component): Component => {
    const record = component as unknown as Readonly<Record<string, unknown>>
    const { children } = record
    const withChildren = Array.isArray(children)
      ? {
          ...record,
          children: (children as readonly (Component | string)[]).map((child) =>
            typeof child === 'string' ? child : mark(child)
          ),
        }
      : record
    if (record['type'] !== 'drawer' || !Array.isArray(record['related'])) {
      return withChildren as unknown as Component
    }
    const props = (record['props'] as Readonly<Record<string, unknown>> | undefined) ?? {}
    return {
      ...withChildren,
      props: { ...props, [RELATED_GUEST_CALLER_KEY]: true },
    } as unknown as Component
  }
  return components.map(mark)
}

/**
 * May this caller read / create in the related table, exactly as the records
 * API would answer? An auth-app guest is admitted to a `read: 'all'` table only
 * and never to a create (the API's `requireAuthOrGuestComment` gate); anyone
 * else goes through the shared evaluators a grid bound to the table uses.
 */
function callerAccess(
  table: Table,
  tables: Tables | undefined,
  caller: RelatedCaller
): { readonly read: boolean; readonly create: boolean } {
  if (caller.guest) {
    const permissions = table.permissions as Readonly<{ read?: unknown }> | undefined
    return { read: isOpenToEveryone(toPermissionValue(permissions?.read)), create: false }
  }
  const role = caller.session?.role ?? ''
  const groups = caller.session?.groups ?? []
  return {
    read: hasReadPermission(table, role, tables, groups),
    create: hasCreatePermission(table, role, tables, groups),
  }
}

/** The header of one column: its own label, then the field's, then the raw name. */
function columnFor(field: string, ownLabel: unknown, table: Table): RelatedSectionColumn {
  const declared = table.fields.find((candidate) => candidate.name === field)
  const label =
    (typeof ownLabel === 'string' && ownLabel !== '' ? ownLabel : undefined) ??
    declaredFieldLabel(declared) ??
    field
  return { field, label, type: declared?.type ?? 'single-line-text' }
}

/** The declared columns, or every field of the table except the relationship itself. */
function resolveColumns(entry: RawEntry, table: Table): readonly RelatedSectionColumn[] {
  const declared = entry['columns']
  if (Array.isArray(declared)) {
    return declared.flatMap((column: unknown) => {
      const record = column as RawEntry | null
      const field = record?.['field']
      return typeof field === 'string' ? [columnFor(field, record?.['label'], table)] : []
    })
  }
  return table.fields
    .filter((field) => field.name !== entry['field'])
    .map((field) => columnFor(field.name, undefined, table))
}

/**
 * Resolve a drawer's `related` entries into the sections its island draws.
 *
 * A section the caller may not READ is dropped here rather than rendered and
 * then emptied by a refused fetch: the drawer must not say that a table of
 * related records exists at all (anti-enumeration, the rule every data surface
 * follows). The create gate is the one a grid bound to the same table uses —
 * `hasCreatePermission` against the same role and groups — so a section never
 * offers a create the records endpoint would refuse. An anonymous caller in an
 * app with auth is answered by the API's own guest rule instead (see
 * {@link callerAccess}), which the role evaluators cannot express.
 *
 * The permission evaluators are the shared ones, not a second model: a second
 * copy is exactly what the `Permission Evaluator Drift` gate exists to prevent.
 */
export function resolveRelatedSections(
  related: unknown,
  tables: Tables | undefined,
  caller: RelatedCaller
): readonly RelatedSection[] | undefined {
  if (!Array.isArray(related) || related.length === 0) return undefined
  const sections = related.flatMap((raw: unknown): readonly RelatedSection[] => {
    const entry = raw as RawEntry
    const table = tables?.find((candidate) => candidate.name === entry['table'])
    if (table === undefined || typeof entry['field'] !== 'string') return []
    const access = callerAccess(table, tables, caller)
    if (!access.read) return []
    return [
      {
        label: String(entry['label']),
        table: table.name,
        field: entry['field'],
        columns: resolveColumns(entry, table),
        ...(Array.isArray(entry['sort'])
          ? { sort: entry['sort'] as RelatedSection['sort'] & object }
          : {}),
        limit: typeof entry['limit'] === 'number' ? entry['limit'] : DEFAULT_RELATED_LIMIT,
        ...(typeof entry['emptyMessage'] === 'string'
          ? { emptyMessage: entry['emptyMessage'] }
          : {}),
        ...(entry['onRowClick'] === undefined ? {} : { onRowClick: entry['onRowClick'] }),
        canCreate: access.create,
      },
    ]
  })
  return sections
}
