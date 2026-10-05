/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What a record drawer's reader may read and write, field by field.
 *
 * A drawer bound to a table draws one entry per field. The records API already
 * withholds a field its caller may not read and refuses a write to one it may
 * not write; the drawer has to say the same thing, or a reader sees a label
 * with an empty value and an editable box whose save is refused. The answer
 * needs the whole `app` (the role ladder decides who is an admin), which the
 * component renderer does not hold — so the page pass, which does, stamps it on
 * the drawer under {@link DRAWER_FIELD_ACCESS_KEY}, as it stamps the guest
 * marker the related sections read.
 */

import {
  callerReaderFromSession,
  tableReadPrincipal,
} from '@/domain/models/app/tables/caller-record-gate-service'
import { isFieldReadableByCaller } from '@/domain/models/app/tables/field-read-filter-service'
import { forbiddenWriteFields } from '@/domain/models/app/tables/field-write-permission-service'
import {
  CANONICAL_READ_POLICY,
  buildReadAccessPlan,
} from '@/domain/models/app/tables/read-access-plan-service'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { Component } from '@/domain/models/app/pages/components'

/** The render-time-only key the page pass stamps a drawer's field access under. */
export const DRAWER_FIELD_ACCESS_KEY = '_drawerFieldAccess'

/** The fields of a drawer's table its reader may not read, and those they may not write. */
export interface DrawerFieldAccess {
  readonly unreadable: readonly string[]
  readonly unwritable: readonly string[]
}

/** The caller the read rights are decided for: the session's, or an anonymous one with no role. */
const readerOf = (session: SessionInfo | undefined) =>
  session === undefined ? { role: '' } : { role: session.role, groups: session.groups ?? [] }

/**
 * Every table's fields its reader — signed in or anonymous — may not read,
 * listed only for the tables that hold any. A surface that NAMES fields without
 * their values (the command palette's create dialogs) reads this so it names
 * none the records API would withhold.
 */
export function unreadableTableFields(
  app: App,
  session: SessionInfo | undefined
): Readonly<Record<string, readonly string[]>> {
  const caller = readerOf(session)
  return Object.fromEntries(
    (app.tables ?? [])
      .map(
        (table) =>
          [
            table.name,
            table.fields
              .map((field) => field.name)
              .filter((name) => !isFieldReadableByCaller(app, table.name, caller, name)),
          ] as const
      )
      .filter(([, names]) => names.length > 0)
  )
}

/**
 * The tables whose records `session` — signed in or anonymous — may not read at
 * all, decided by the same read plan a page's data grid is served through. A
 * surface that NAMES tables (the command palette's create dialogs) leaves these
 * out, names and fields alike.
 */
export function unreadableTables(app: App, session: SessionInfo | undefined): readonly string[] {
  const reader = callerReaderFromSession(session, app)
  return (app.tables ?? [])
    .filter(
      (table) =>
        !buildReadAccessPlan({
          app,
          table,
          principal: tableReadPrincipal(table, reader),
          policy: CANONICAL_READ_POLICY,
        }).allowed
    )
    .map((table) => table.name)
}

/**
 * The access `session` has to the fields of `tableName`, or `undefined` when it
 * has all of it. With no session, the reader is anonymous: they hold no role,
 * so a field whose read rights name any is left out. What they may write is
 * not marked — a visitor saves nothing a drawer could send.
 */
const fieldAccessFor = (
  app: App,
  tableName: string,
  session: SessionInfo | undefined
): DrawerFieldAccess | undefined => {
  const table = app.tables?.find((candidate) => candidate.name === tableName)
  if (table === undefined) return undefined
  const names = table.fields.map((field) => field.name)
  const caller = readerOf(session)
  const unreadable = names.filter((name) => !isFieldReadableByCaller(app, tableName, caller, name))
  const unwritable =
    session === undefined
      ? []
      : forbiddenWriteFields(
          app,
          tableName,
          { role: session.role, groups: session.groups ?? [] },
          Object.fromEntries(names.map((name) => [name, true]))
        )
  return unreadable.length === 0 && unwritable.length === 0 ? undefined : { unreadable, unwritable }
}

/** The table a drawer is bound to, when it is bound to one. */
const drawerTable = (record: Readonly<Record<string, unknown>>): string | undefined => {
  if (record['type'] !== 'drawer') return undefined
  const dataSource = record['dataSource'] as { readonly table?: unknown } | undefined
  return typeof dataSource?.table === 'string' ? dataSource.table : undefined
}

/**
 * Stamp {@link DRAWER_FIELD_ACCESS_KEY} on every table-bound drawer whose
 * reader — signed in or anonymous — may not read or write some of its fields.
 * Leaves alone a drawer whose reader holds every field — its props stay what
 * they were.
 */
export function markDrawerFieldAccess(
  components: readonly Component[],
  app: App,
  session: SessionInfo | undefined
): readonly Component[] {
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
    const tableName = drawerTable(record)
    const access = tableName === undefined ? undefined : fieldAccessFor(app, tableName, session)
    if (access === undefined) return withChildren as unknown as Component
    const props = (record['props'] as Readonly<Record<string, unknown>> | undefined) ?? {}
    return {
      ...withChildren,
      props: { ...props, [DRAWER_FIELD_ACCESS_KEY]: access },
    } as unknown as Component
  }
  return components.map(mark)
}

/** The access stamped on a drawer's props, when the page pass stamped one. */
export const readDrawerFieldAccess = (
  rawProps: Readonly<Record<string, unknown>> | undefined
): DrawerFieldAccess | undefined => {
  const stamped = rawProps?.[DRAWER_FIELD_ACCESS_KEY]
  if (typeof stamped !== 'object' || stamped === null) return undefined
  const { unreadable, unwritable } = stamped as Partial<DrawerFieldAccess>
  return Array.isArray(unreadable) && Array.isArray(unwritable)
    ? { unreadable, unwritable }
    : undefined
}

/**
 * The drawer's entries as its reader may see them: a field they may not read
 * is left out — no label, no value — and one they may not write is marked
 * `readOnly`, drawn as its value without an editable control and never sent.
 */
export function applyDrawerFieldAccess(
  entries: unknown,
  access: DrawerFieldAccess | undefined
): unknown {
  if (access === undefined || !Array.isArray(entries)) return entries
  const nameOf = (entry: unknown): unknown =>
    typeof entry === 'object' && entry !== null
      ? (entry as Readonly<Record<string, unknown>>)['name']
      : undefined
  return entries
    .filter((entry) => !access.unreadable.includes(String(nameOf(entry))))
    .map((entry) =>
      access.unwritable.includes(String(nameOf(entry)))
        ? { ...(entry as Readonly<Record<string, unknown>>), readOnly: true }
        : entry
    )
}
