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
import {
  isFieldReadableByCaller,
  isFieldReadableUnderFieldRules,
} from '@/domain/models/app/tables/field-read-filter-service'
import { forbiddenWriteFields } from '@/domain/models/app/tables/field-write-permission-service'
import { relatedValuesRefusedTo } from '@/domain/models/app/tables/lookup-link-service'
import {
  CANONICAL_READ_POLICY,
  buildReadAccessPlan,
} from '@/domain/models/app/tables/read-access-plan-service'
import { toManyLinksRefusedTo } from '@/domain/models/app/tables/related-field-read-service'
import { reverseRelationsOf } from '@/domain/models/app/tables/reverse-relations-service'
import { writeOnlyFieldNames } from '@/domain/models/app/tables/write-only-field-service'
import { WRITE_ONLY_PRESENCE_LABELS } from './write-only-presence-labels'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { Component } from '@/domain/models/app/pages/components'
import type { CallerCapability } from '@/domain/models/app/pages/components/visibility'
import type { CallerFieldReader } from '@/domain/models/app/tables/field-read-filter-service'

/** The render-time-only key the page pass stamps a drawer's field access under. */
export const DRAWER_FIELD_ACCESS_KEY = '_drawerFieldAccess'

/**
 * The fields of a drawer's table its reader may not read, those they may not
 * write, and the write-only fields whose presence — set or not set — they are
 * shown in place of the value.
 */
export interface DrawerFieldAccess {
  readonly unreadable: readonly string[]
  readonly unwritable: readonly string[]
  readonly writeOnly?: readonly string[]
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
 * Whom a drawer's field access is decided for, and against which app's rules:
 * the session's reader against the rendering app; on a session-less mounted
 * console, the caller's role and groups against the HOST app, whose tables,
 * field rules and role ladder they are; else nobody — an anonymous reader.
 */
interface FieldAccessReader {
  readonly app: App
  readonly reader: CallerFieldReader | undefined
}

const fieldAccessReaderOf = (
  app: App,
  session: SessionInfo | undefined,
  caller: DrawerCaller
): FieldAccessReader =>
  session === undefined && caller.fieldReader !== undefined
    ? { app: caller.hostApp ?? app, reader: caller.fieldReader }
    : {
        app,
        reader:
          session === undefined ? undefined : { role: session.role, groups: session.groups ?? [] },
      }

/**
 * The access the reader has to the fields of `tableName`, or `undefined` when
 * they have all of it. With no reader, they are anonymous: they hold no role,
 * so a field whose read rights name any is left out. What they may write is
 * not marked — a visitor saves nothing a drawer could send.
 */
const fieldAccessFor = (
  { app, reader }: FieldAccessReader,
  tableName: string
): DrawerFieldAccess | undefined => {
  const table = app.tables?.find((candidate) => candidate.name === tableName)
  if (table === undefined) return undefined
  const names = table.fields.map((field) => field.name)
  const caller = reader ?? { role: '' }
  // A value read from a table the reader may not read — a count, a rollup, a
  // lookup, a link to many — is withheld as the records API withholds it.
  const related = { role: caller.role, groups: reader?.groups ?? [], signedOut: !reader }
  const refused = new Set([
    ...relatedValuesRefusedTo(app, tableName, related),
    ...toManyLinksRefusedTo(app, tableName, related),
  ])
  const unreadable = names.filter(
    (name) => refused.has(name) || !isFieldReadableByCaller(app, tableName, caller, name)
  )
  const unwritable =
    reader === undefined
      ? []
      : forbiddenWriteFields(
          app,
          tableName,
          reader,
          Object.fromEntries(names.map((name) => [name, true]))
        )
  const writeOnly = writeOnlyFieldNames(app, tableName).filter((name) =>
    isFieldReadableUnderFieldRules(app, tableName, caller, name)
  )
  if (unreadable.length === 0 && unwritable.length === 0) return undefined
  return { unreadable, unwritable, ...(writeOnly.length === 0 ? {} : { writeOnly }) }
}

/** The table a drawer is bound to, when it is bound to one. */
const drawerTable = (record: Readonly<Record<string, unknown>>): string | undefined => {
  if (record['type'] !== 'sheet') return undefined
  const dataSource = record['dataSource'] as { readonly table?: unknown } | undefined
  return typeof dataSource?.table === 'string' ? dataSource.table : undefined
}

/**
 * What the host app says about a GENERIC sheet — one bound to a table and
 * declaring neither `recordFields` nor `related`, which therefore derives its
 * fields, its tabs and its "Linked from" sections — that the sheet's renderer
 * cannot see, holding only `tables`: whether its table is an `auth.scopeTables`
 * entry (its Access tab), whether the app has auth at all and the reader a
 * session (how its permissions answer), and what the reader may read and write
 * on each table that links to it (a linked record opened in the sheet).
 */
export const DRAWER_HOST_KEY = '_drawerHost'

/** The facts {@link DRAWER_HOST_KEY} carries. */
export interface DrawerHostFacts {
  readonly scoped?: true
  readonly mode?: 'open' | 'guest'
  readonly linkedAccess?: Readonly<Record<string, DrawerFieldAccess>>
  /**
   * The caller's powers when the page renders without a session — a mounted
   * operator console, whose every caller is signed in, and an admin when she
   * may administer accounts.
   */
  readonly console?: { readonly admin: boolean }
}

/** What the reader may read and write on each table linking to `tableName`. */
const linkedAccessFor = (
  reader: FieldAccessReader,
  tableName: string
): Readonly<Record<string, DrawerFieldAccess>> => {
  const linked = [...new Set(reverseRelationsOf(tableName, reader.app.tables).map((r) => r.table))]
  return Object.fromEntries(
    linked.flatMap((name) => {
      const access = fieldAccessFor(reader, name)
      return access === undefined ? [] : [[name, access] as const]
    })
  )
}

/**
 * Who reads a page with no session: a console caller, the open app's anyone,
 * or a guest.
 *
 * The console is asked FIRST: a mounted console renders from its own preset,
 * which declares no `auth`, so asking the rendering app whether it has auth
 * would answer "open" for every operator and draw her sheet as an anonymous
 * visitor's — no Activity tab, no Access tab.
 */
const callerFacts = (
  app: App,
  session: SessionInfo | undefined,
  capabilities: readonly CallerCapability[] | undefined
): Pick<DrawerHostFacts, 'mode' | 'console'> => {
  if (session === undefined && capabilities?.includes('admin-console') === true) {
    return { console: { admin: capabilities.includes('administer-accounts') } }
  }
  if (app.auth === undefined) return { mode: 'open' }
  if (session !== undefined) return {}
  return { mode: 'guest' }
}

/**
 * What the page pass knows of the reader beyond her session: her powers on a
 * mounted console, and the app hosting the page (the operator's, under a mount).
 */
export interface DrawerCaller {
  readonly capabilities?: readonly CallerCapability[] | undefined
  readonly hostApp?: App | undefined
  /** Her role and groups on a session-less mounted console, which decide her field access. */
  readonly fieldReader?: CallerFieldReader | undefined
}

/**
 * The host facts of a generic sheet on `tableName`. Whether the table is
 * scoped is the HOST app's answer — under a mount, the operator's, whose
 * `auth.scopeTables` the console preset never carries.
 */
const hostFactsFor = (
  app: App,
  tableName: string,
  session: SessionInfo | undefined,
  caller: DrawerCaller
): DrawerHostFacts => {
  const linkedAccess = linkedAccessFor(fieldAccessReaderOf(app, session, caller), tableName)
  const hostApp = caller.hostApp ?? app
  return {
    ...callerFacts(app, session, caller.capabilities),
    ...((hostApp.auth?.scopeTables ?? []).includes(tableName) ? { scoped: true } : {}),
    ...(Object.keys(linkedAccess).length === 0 ? {} : { linkedAccess }),
  }
}

/** Whether a sheet derives everything from its table: no `recordFields`, no `related`. */
const isGenericSheet = (record: Readonly<Record<string, unknown>>): boolean =>
  record['recordFields'] === undefined && record['related'] === undefined

/**
 * Stamp each record-bound drawer with what its reader may read and write
 * (`_drawerFieldAccess`) and, for a generic sheet, the host facts above.
 */
export function markDrawerFieldAccess(
  components: readonly Component[],
  app: App,
  session: SessionInfo | undefined,
  caller: DrawerCaller = {}
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
    const tableName = drawerTable(record)
    if (tableName === undefined) return withChildren as Component
    const access = fieldAccessFor(fieldAccessReaderOf(app, session, caller), tableName)
    const host = isGenericSheet(record) ? hostFactsFor(app, tableName, session, caller) : undefined
    if (access === undefined && host === undefined) return withChildren as Component
    const props = (record['props'] as Readonly<Record<string, unknown>> | undefined) ?? {}
    return {
      ...withChildren,
      props: {
        ...props,
        ...(access === undefined ? {} : { [DRAWER_FIELD_ACCESS_KEY]: access }),
        ...(host === undefined ? {} : { [DRAWER_HOST_KEY]: host }),
      },
    } as Component
  }
  return components.map(mark)
}

/** The host facts a generic sheet was stamped with, or `undefined`. */
export const readDrawerHostFacts = (
  rawProps: Readonly<Record<string, unknown>> | undefined
): DrawerHostFacts | undefined => {
  const stamped = rawProps?.[DRAWER_HOST_KEY]
  return typeof stamped === 'object' && stamped !== null ? (stamped as DrawerHostFacts) : undefined
}

/** The access stamped on a drawer's props, when the page pass stamped one. */
export const readDrawerFieldAccess = (
  rawProps: Readonly<Record<string, unknown>> | undefined
): DrawerFieldAccess | undefined => {
  const stamped = rawProps?.[DRAWER_FIELD_ACCESS_KEY]
  if (typeof stamped !== 'object' || stamped === null) return undefined
  const { unreadable, unwritable, writeOnly } = stamped as Partial<DrawerFieldAccess>
  if (!Array.isArray(unreadable) || !Array.isArray(unwritable)) return undefined
  return { unreadable, unwritable, ...(Array.isArray(writeOnly) ? { writeOnly } : {}) }
}

/**
 * The drawer's entries as its reader may see them: a field they may not read
 * is left out — no label, no value — and one they may not write is marked
 * `readOnly`, drawn as its value without an editable control and never sent.
 * A write-only field they could otherwise read stays, read-only, drawn as
 * whether a value is set ({@link WRITE_ONLY_PRESENCE_LABELS}), never sent.
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
  const writeOnly = new Set(access.writeOnly ?? [])
  return entries
    .filter(
      (entry) =>
        writeOnly.has(String(nameOf(entry))) || !access.unreadable.includes(String(nameOf(entry)))
    )
    .map((entry) => {
      const name = String(nameOf(entry))
      if (writeOnly.has(name)) {
        const presence = WRITE_ONLY_PRESENCE_LABELS
        return { ...(entry as Readonly<Record<string, unknown>>), readOnly: true, presence }
      }
      return access.unwritable.includes(name)
        ? { ...(entry as Readonly<Record<string, unknown>>), readOnly: true }
        : entry
    })
}
