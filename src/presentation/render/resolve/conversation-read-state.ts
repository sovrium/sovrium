/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Where a bound conversation's reader left off. A frame bound to the children
 * of ONE parent record — its filter pins a `readState` relationship of the
 * bound table to one id — reads the reader's position on that parent, and the
 * first of the rows she was served that was created after it, and not by her,
 * gets a New marker above it. The marker is placed among the rows the records
 * list already admitted her, so it never stands for a row she may not read.
 * The same pinned parent is the record the page's app connection follows for
 * who is typing in the conversation, when the app shows typing.
 */

import { isGuestSession } from '@/domain/models/app/auth/guest-session'
import { resolveInterpreterString } from '@/domain/models/app/languages/translation-resolver'
import { createdByFieldNames } from '@/domain/models/app/tables/authorship-fields'
import type { DataSourceDb } from './data-source-contracts'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { Component } from '@/domain/models/app/pages/components'

type Row = Readonly<Record<string, unknown>>

/** Who reads the conversation and through which readers. */
interface BoundRowsReader {
  readonly app: App
  readonly session: SessionInfo | undefined
  readonly db: DataSourceDb
}

/** The parent record a frame's turns are the children of, as the mark-read route names it. */
export interface ReadStateParent {
  readonly table: string
  readonly recordId: string
}

/** The render-time field carrying the parent a signed-in reader's frame marks read. */
export const READ_STATE_PARENT_KEY = 'readStateParent'

interface LooseField {
  readonly name: string
  readonly type: string
  readonly relatedTable?: string
  readonly relationType?: string
  readonly readState?: unknown
}

interface LooseFilter {
  readonly field?: unknown
  readonly operator?: unknown
  readonly value?: unknown
}

/** The render-time field carrying the parent record a frame's typing indicator follows. */
export const FOLLOWED_PARENT_KEY = 'followedParent'

/** Whether a relationship keeps read state on its parent. */
const keepsReadState = (field: LooseField): boolean =>
  field.readState === true || typeof field.readState === 'object'

/**
 * The parent a frame is bound to the children of, when its filter pins one of
 * the bound table's single-parent links (`which` of them) by equality.
 */
function pinnedParentOf(
  component: Component,
  app: App,
  which: (field: LooseField) => boolean
): ReadStateParent | undefined {
  const tableName = component.dataSource?.table
  const table = app.tables?.find((candidate) => candidate.name === tableName)
  const filters = (component.dataSource?.filter ?? []) as readonly LooseFilter[]
  const links = ((table?.fields ?? []) as readonly LooseField[]).filter(
    (field) =>
      field.type === 'relationship' &&
      which(field) &&
      (field.relationType === 'many-to-one' || field.relationType === 'one-to-one')
  )
  const pinned = links.flatMap((link) =>
    filters
      .filter(
        (filter) =>
          filter.field === link.name &&
          filter.operator === 'eq' &&
          (typeof filter.value === 'string' || typeof filter.value === 'number')
      )
      .map((filter) => ({ table: link.relatedTable ?? '', recordId: String(filter.value) }))
  )
  return pinned.find((parent) => parent.table !== '' && parent.recordId !== '')
}

/**
 * The parent record a conversation follows for who is typing in it, stamped on
 * the frame when the app shows typing (`auth.presence.typing`) and the frame is
 * bound to the children of one parent. The page's app connection follows that
 * record, under the server's own read gate.
 */
export const followedParentOf = (
  component: Component,
  app: App
): Readonly<Record<string, ReadStateParent>> => {
  if (app.auth?.presence?.typing !== true) return {}
  const parent = pinnedParentOf(component, app, () => true)
  return parent === undefined ? {} : { [FOLLOWED_PARENT_KEY]: parent }
}

/** The ids of whoever wrote a row, by the frame's author field and the table's `created-by` fields. */
const authorsOf = (row: Row, authorFields: readonly string[]): readonly string[] =>
  authorFields.flatMap((name) => {
    const value = row[name]
    return value === undefined || value === null ? [] : [String(value)]
  })

/** When a row was created, as an instant; `undefined` when it carries no readable one. */
const createdAtOf = (row: Row): number | undefined => {
  const value = row['created_at']
  if (typeof value !== 'string' && !(value instanceof Date)) return undefined
  const at = new Date(value).getTime()
  return Number.isNaN(at) ? undefined : at
}

/**
 * The id of the first row created after the reader's position on `parent` and
 * not written by her — `undefined` when she never read the parent, has no
 * account, or has read every row she was served.
 */
async function firstUnreadRowId(
  parent: ReadStateParent,
  rows: readonly Row[],
  context: {
    readonly reader: BoundRowsReader
    readonly tableName: string
    readonly authorField: string | undefined
  }
): Promise<string | undefined> {
  const { reader, tableName, authorField } = context
  const readerId = reader.session?.userId
  const read = reader.db.readReadPosition
  if (readerId === undefined || read === undefined) return undefined
  const since = await read(parent.table, parent.recordId, reader.session)
  if (since === undefined) return undefined
  const authorFields = [
    ...(authorField === undefined ? [] : [authorField]),
    ...createdByFieldNames(reader.app.tables, tableName),
  ]
  const unread = rows.find((row) => {
    const at = createdAtOf(row)
    return (
      at !== undefined && at > since.getTime() && !authorsOf(row, authorFields).includes(readerId)
    )
  })
  return unread === undefined ? undefined : String(unread['id'] ?? '')
}

/** The marker drawn above the first unread turn: a separator naming it New, in the page language. */
export function unreadMarker(reader: BoundRowsReader): Component {
  const locale = reader.db.recordText?.locale ?? 'en-US'
  const marker: Readonly<Record<string, unknown>> = {
    type: 'marker',
    variant: 'separator',
    live: true,
    content: resolveInterpreterString('conversation.new', locale, reader.app.languages),
  }
  return marker as Component
}

/**
 * Where a signed-in reader of one parent's children left off: the parent her
 * frame marks read, and the row the New marker goes above. Nothing for a
 * visitor, or for a frame not bound to the children of one parent.
 */
export async function readerPlaceOf(
  component: Component,
  rows: readonly Row[],
  context: {
    readonly reader: BoundRowsReader
    readonly tableName: string
    readonly authorField: string | undefined
  }
): Promise<{ readonly parent?: ReadStateParent; readonly unreadFrom?: string }> {
  const { session } = context.reader
  if (session === undefined || isGuestSession(session.userId)) return {}
  const parent = pinnedParentOf(component, context.reader.app, keepsReadState)
  if (parent === undefined) return {}
  return { parent, unreadFrom: await firstUnreadRowId(parent, rows, context) }
}
