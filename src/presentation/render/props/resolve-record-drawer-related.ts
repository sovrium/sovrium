/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { toGroupReference } from '@/domain/models/app/auth/groups/group-reference'
import {
  hasCreatePermissionForRoles,
  hasReadPermission,
  readOpensToEveryone,
} from '@/domain/models/app/auth/permission-evaluator-service'
import { declaredFieldLabel } from '@/presentation/design/field-display'
import { readableFieldsOf } from './caller-table-inputs'
import { resolveValueCurrency } from './resolve-chart-field-context'
import type { CallerTableView } from '@/application/ports/services/page-renderer'
import type { CurrencyDisplayOptions } from '@/domain/kernel/format/currency-format'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { Component } from '@/domain/models/app/pages/components'
import type { Tables } from '@/domain/models/app/tables'

/**
 * The render-time-only marker saying who a drawer's related sections answer
 * when the role evaluators alone cannot: `'guest'` for an ANONYMOUS caller in
 * an app that has `auth` configured, `'open'` for any caller in an app that
 * has none.
 *
 * Private to the renderer, like `_openDrawerDispatchedById`. It exists because
 * the component renderer holds the session but not `app.auth`, and the cases a
 * missing session can mean are opposite: in an app without auth every caller
 * is the records API's `'guest'` role, while in an app WITH auth the records
 * API admits an anonymous caller only to a table whose `permissions.read` is
 * the `'all'` literal, and never to a write. Stamped by
 * {@link markRelatedGuestCaller} in the page pipeline, which holds both and
 * overwrites whatever an author wrote under this key.
 */
export const RELATED_GUEST_CALLER_KEY = '_relatedGuestCaller'

/** How many rows a section lists when its entry declares no `limit`. */
const DEFAULT_RELATED_LIMIT = 10

/** One column as the island draws it: the field, its resolved header, its type. */
export interface RelatedSectionColumn {
  readonly field: string
  readonly label: string
  readonly type: string
  /** The column's declared currency display, so an amount prints as the grid prints it. */
  readonly currency?: CurrencyDisplayOptions
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

/** Who the page pass says the caller is, beyond her session — see {@link RELATED_GUEST_CALLER_KEY}. */
export type RelatedCallerMode = 'guest' | 'open'

/** The caller a section is resolved for: the session, and whether it is an auth-app guest. */
export interface RelatedCaller {
  readonly session: SessionInfo | undefined
  readonly guest: boolean
  /**
   * The app declares no `auth`: every caller is the records API's `'guest'`
   * role (its `guestContextHandler`). Keyed on the app, never on a missing
   * session, which in an auth app means something else entirely.
   */
  readonly openApp?: boolean
  /**
   * Each related table as the caller may see it, stamped by the page pass
   * (`caller-table-stamp.ts`): a section with no `columns` heads only the
   * fields she may read. Absent (no auth, a render outside the page route
   * funnel), every field.
   */
  readonly callerTables?: Readonly<Record<string, CallerTableView>> | undefined
}

/**
 * Stamp {@link RELATED_GUEST_CALLER_KEY} on every drawer declaring `related`:
 * the caller mode when there is one, and the key removed otherwise, so an
 * author-written value never reaches the resolver.
 */
export function markRelatedGuestCaller(
  components: readonly Component[],
  mode: RelatedCallerMode | undefined
): readonly Component[] {
  const mark = (component: Component): Component => {
    const record = component as Readonly<Record<string, unknown>>
    const { children } = record
    const withChildren = Array.isArray(children)
      ? {
          ...record,
          children: (children as readonly (Component | string)[]).map((child) =>
            typeof child === 'string' ? child : mark(child)
          ),
        }
      : record
    if (record['type'] !== 'sheet' || !Array.isArray(record['related'])) {
      return withChildren as Component
    }
    const { [RELATED_GUEST_CALLER_KEY]: _authored, ...props } =
      (record['props'] as Readonly<Record<string, unknown>> | undefined) ?? {}
    return {
      ...withChildren,
      props: mode === undefined ? props : { ...props, [RELATED_GUEST_CALLER_KEY]: mode },
    } as Component
  }
  return components.map(mark)
}

/** The mode a drawer's props carry, as {@link markRelatedGuestCaller} stamped it. */
export function relatedCallerModeOf(
  props: Readonly<Record<string, unknown>> | undefined
): RelatedCallerMode | undefined {
  const mode = props?.[RELATED_GUEST_CALLER_KEY]
  return mode === 'guest' || mode === 'open' ? mode : undefined
}

/**
 * May this caller read / create in the related table, exactly as the records
 * API would answer? An auth-app guest is admitted only to a table whose read,
 * resolved through `inherit` and `override`, is `'all'`, and never to a create
 * (the API's `requireAuthOrGuestComment` gate); anyone else goes through the
 * shared evaluators a grid bound to the table uses.
 */
function callerAccess(
  table: Table,
  tables: Tables | undefined,
  caller: RelatedCaller
): { readonly read: boolean; readonly create: boolean } {
  if (caller.guest) return { read: readOpensToEveryone(table, tables), create: false }
  // An app with no `auth`: the records API serves every caller as `'guest'`.
  if (caller.openApp === true) {
    return {
      read: hasReadPermission(table, 'guest', tables, []),
      create: hasCreatePermissionForRoles(table, ['guest'], tables),
    }
  }
  // An admin-equivalent caller — the built-in `admin` or the app's top role,
  // which the auth context stamps as `isUnrestricted` — outranks every grant,
  // exactly as the records API's admin override answers her.
  if (caller.session?.isUnrestricted === true) return { read: true, create: true }
  const role = caller.session?.role ?? ''
  const groups = caller.session?.groups ?? []
  return {
    read: hasReadPermission(table, role, tables, groups),
    // The records API's own write evaluator over the same roles: a viewer is
    // never offered a create a group grant would give her (the API refuses it).
    create: hasCreatePermissionForRoles(table, [role, ...groups.map(toGroupReference)], tables),
  }
}

/** The header of one column: its own label, then the field's, then the raw name. */
function columnFor(
  field: string,
  ownLabel: unknown,
  table: Table,
  tables: Tables | undefined
): RelatedSectionColumn {
  const declared = table.fields.find((candidate) => candidate.name === field)
  const label =
    (typeof ownLabel === 'string' && ownLabel !== '' ? ownLabel : undefined) ??
    declaredFieldLabel(declared) ??
    field
  const currency = resolveValueCurrency(table, field, tables ?? [])
  return {
    field,
    label,
    type: declared?.type ?? 'single-line-text',
    ...(currency === undefined ? {} : { currency }),
  }
}

/**
 * The declared columns, or every field of the table except the relationship
 * itself that the caller may read.
 */
function resolveColumns(
  entry: RawEntry,
  table: Table,
  callerTable: CallerTableView | undefined,
  tables: Tables | undefined
): readonly RelatedSectionColumn[] {
  const declared = entry['columns']
  if (Array.isArray(declared)) {
    return declared.flatMap((column: unknown) => {
      const record = column as RawEntry | null
      const field = record?.['field']
      return typeof field === 'string' ? [columnFor(field, record?.['label'], table, tables)] : []
    })
  }
  const readable =
    callerTable === undefined
      ? table.fields.map((field) => field.name)
      : readableFieldsOf(table, callerTable)
  return readable
    .filter((name) => name !== entry['field'])
    .map((name) => columnFor(name, undefined, table, tables))
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
        columns: resolveColumns(entry, table, caller.callerTables?.[table.name], tables),
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
