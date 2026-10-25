/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The rows of a BOUND conversation frame (`message-scroller` with a
 * `dataSource`), drawn on the server like every other bound section, with what
 * only a pass over the whole conversation can see:
 *
 *   - the `marker` child of the template is not a turn: it is drawn once before
 *     the first record of each day of `dayField` (a default separator naming the
 *     day when the template holds none);
 *   - the turn of a record whose `authorField` is the reader sits at the end
 *     side, and names its author and initials from the records API's own
 *     labels — so a person the reader may not see stays unnamed;
 *   - consecutive turns by one author, within one day, print the name once.
 *
 * Every other bound section keeps {@link expandDataSourceChildren} unchanged.
 */

import { deriveInitials } from '@/presentation/design/avatar-initials'
import { CONVERSATION_RECORD_KEY, withConversationExtras } from './conversation-extras'
import {
  followedParentOf,
  READ_STATE_PARENT_KEY,
  readerPlaceOf,
  unreadMarker,
} from './conversation-read-state'
import { expandDataSourceChildren, type PaginationMeta } from './data-source-rows'
import { AUTHOR_CONTINUED_KEY } from './message-author-resolver'
import { substituteRecordInComponent } from './record-substitution'
import type { DataSourceDb } from './data-source-contracts'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { Component } from '@/domain/models/app/pages/components'

type Node = Component | string
type Row = Readonly<Record<string, unknown>>

/** Who reads the page and through which readers, as the list mode resolves it. */
export interface BoundRowsReader {
  readonly app: App
  readonly session: SessionInfo | undefined
  readonly db: DataSourceDb
}

interface ConversationKeys {
  readonly authorField: string | undefined
  readonly dayField: string | undefined
}

const keysOf = (component: Component): ConversationKeys => {
  const { authorField, dayField } = component as {
    readonly authorField?: unknown
    readonly dayField?: unknown
  }
  return {
    authorField: typeof authorField === 'string' ? authorField : undefined,
    dayField: typeof dayField === 'string' ? dayField : undefined,
  }
}

/** The UTC calendar day of a date or date-time value, `undefined` when it is none. */
export function dayKeyOf(value: unknown): string | undefined {
  if (typeof value !== 'string' && !(value instanceof Date)) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString().slice(0, 10)
}

/** The day a marker names, in the page language — UTC, as a turn's time is. */
export function formatDay(dayKey: string, locale: string): string {
  const date = new Date(`${dayKey}T00:00:00Z`)
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(date)
  } catch {
    return new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' }).format(date)
  }
}

const isMarker = (node: Node): node is Component =>
  typeof node === 'object' && (node as { readonly type?: unknown }).type === 'marker'

/** The marker opening one day: the template's own, filled from the day's first record. */
function dayMarker(
  template: Component | undefined,
  record: Row,
  text: string,
  tableName: string
): Component {
  if (template !== undefined) return substituteRecordInComponent(template, record, tableName)
  const separator: Readonly<Record<string, unknown>> = {
    type: 'marker',
    variant: 'separator',
    live: true,
    content: text,
  }
  return separator as Component
}

/** The author id a record holds, as text; `undefined` when it holds none. */
const authorOf = (record: Row, authorField: string | undefined): string | undefined => {
  const value = authorField === undefined ? undefined : record[authorField]
  return value === undefined || value === null ? undefined : String(value)
}

/** The names of the authors of `rows`, read once per author through the records API's labels. */
async function authorNamesOf(
  rows: readonly Row[],
  authorField: string | undefined,
  tableName: string,
  reader: BoundRowsReader
): Promise<ReadonlyMap<string, string>> {
  const read = reader.db.readRecordLabels
  if (authorField === undefined || read === undefined) return new Map()
  const firstByAuthor = rows.reduce<ReadonlyMap<string, Row>>((seen, row) => {
    const id = authorOf(row, authorField)
    return id === undefined || seen.has(id) ? seen : new Map([...seen, [id, row]])
  }, new Map())
  const authors = Array.from(firstByAuthor)
  const labels = await read(
    reader.app,
    tableName,
    authors.map(([, row]) => row),
    reader.session
  )
  const named = authors.map(([id], index) => {
    const label = labels[index]?.[authorField]
    return [id, typeof label === 'string' ? label : undefined] as const
  })
  return new Map(named.flatMap(([id, name]) => (name === undefined ? [] : [[id, name] as const])))
}

interface TurnDecoration {
  readonly recordId: string
  readonly own: boolean
  readonly name: string | undefined
  readonly continued: boolean
}

/** An `image` whose address the record left empty: a turn with no picture draws none. */
const isEmptyImage = (node: Node): boolean =>
  typeof node === 'object' &&
  node.type === 'image' &&
  (node.props as { readonly src?: unknown } | undefined)?.src === ''

/** A node of the turn without the pictures its record does not hold. */
function withoutEmptyImages(node: Node): Node {
  if (typeof node !== 'object' || !Array.isArray(node.children)) return node
  const children = (node.children as readonly Node[])
    .filter((child) => !isEmptyImage(child))
    .map(withoutEmptyImages)
  return { ...node, children } as Component
}

/** One turn of the row, decorated with its side, its author and whether it continues a run. */
function decorateTurn(node: Node, decoration: TurnDecoration): Node {
  if (typeof node !== 'object') return node
  const turn = node as Component & Readonly<Record<string, unknown>>
  if (turn.type !== 'message') {
    return Array.isArray(turn.children)
      ? ({
          ...turn,
          children: (turn.children as readonly Node[]).map((c) => decorateTurn(c, decoration)),
        } as Component)
      : turn
  }
  const children =
    decoration.own && Array.isArray(turn.children)
      ? { children: (turn.children as readonly Node[]).map(bubbleAtEnd) }
      : {}
  return { ...turn, ...turnKeys(turn, decoration), ...children } as Component
}

/** A bubble of the reader's own turn, its tail on the end side unless it says otherwise. */
const bubbleAtEnd = (node: Node): Node =>
  typeof node === 'object' &&
  node.type === 'bubble' &&
  (node as { readonly align?: unknown }).align === undefined
    ? ({ ...node, align: 'end' } as Component)
    : node

/** The keys a turn gains: its side, its author's name and picture, and the run mark. */
function turnKeys(
  turn: Readonly<Record<string, unknown>>,
  { recordId, own, name, continued }: TurnDecoration
): Readonly<Record<string, unknown>> {
  const named = name !== undefined
  return {
    ...(own && turn['align'] === undefined ? { align: 'end' } : {}),
    ...(named && turn['author'] === undefined ? { author: name } : {}),
    ...(named && turn['avatar'] === undefined
      ? { avatar: { initials: deriveInitials(name) } }
      : {}),
    ...(continued ? { [AUTHOR_CONTINUED_KEY]: true } : {}),
    [CONVERSATION_RECORD_KEY]: recordId,
  }
}

interface Walk {
  readonly nodes: readonly Node[]
  readonly day: string | undefined
  readonly author: string | undefined
}

interface StepContext {
  readonly turnTemplate: Component
  readonly markerTemplate: Component | undefined
  readonly keys: ConversationKeys
  readonly names: ReadonlyMap<string, string>
  readonly readerId: string | undefined
  readonly locale: string
  /** The record the reader has not read from, and the New marker drawn above it. */
  readonly unreadFrom: string | undefined
  readonly newMarker: Component
}

/** How one record's turn is drawn: its side, its author's name, whether it continues a run. */
const decorationOf = (
  ctx: StepContext,
  record: Row,
  author: string | undefined,
  sameRun: boolean
): TurnDecoration => {
  const recordId = String(record['id'] ?? '')
  return author === undefined
    ? { recordId, own: false, name: undefined, continued: false }
    : { recordId, own: author === ctx.readerId, name: ctx.names.get(author), continued: sameRun }
}

/**
 * The markers drawn above one record: its day's when the day is new, then the
 * New marker when it is the first the reader has not read. Either breaks a run
 * of turns by one author, so the next turn names its author again.
 */
const markersBefore = (
  ctx: StepContext,
  walk: Walk,
  record: Row
): { readonly day: string | undefined; readonly markers: readonly Component[] } => {
  const tableName = ctx.turnTemplate.dataSource?.table ?? ''
  const { dayField } = ctx.keys
  const day = dayField === undefined ? undefined : dayKeyOf(record[dayField])
  const dayMarkers =
    day !== undefined && day !== walk.day
      ? [dayMarker(ctx.markerTemplate, record, formatDay(day, ctx.locale), tableName)]
      : []
  const unread = ctx.unreadFrom !== undefined && String(record['id'] ?? '') === ctx.unreadFrom
  return { day, markers: [...dayMarkers, ...(unread ? [ctx.newMarker] : [])] }
}

/** One record of the walk: the markers above it, then its decorated turn. */
const conversationStep =
  (ctx: StepContext) =>
  (walk: Walk, record: Row): Walk => {
    const tableName = ctx.turnTemplate.dataSource?.table ?? ''
    const { day, markers } = markersBefore(ctx, walk, record)
    const author = authorOf(record, ctx.keys.authorField)
    const decoration = decorationOf(
      ctx,
      record,
      author,
      author === walk.author && markers.length === 0
    )
    const expanded = expandDataSourceChildren(ctx.turnTemplate, [record], undefined, { tableName })
    const turns = ((expanded.children ?? []) as readonly Node[]).map((node) =>
      decorateTurn(withoutEmptyImages(node), decoration)
    )
    return { nodes: [...walk.nodes, ...markers, ...turns], day: day ?? walk.day, author }
  }

/**
 * The frame's children for its records: per record, a day marker when the day
 * changed, then the record's turn decorated for this reader.
 */
async function expandConversation(
  component: Component,
  rows: readonly Row[],
  reader: BoundRowsReader
): Promise<Component> {
  const tableName = component.dataSource?.table ?? ''
  const { authorField } = keysOf(component)
  const template = component.children ?? []
  const markerTemplate = (template as readonly Node[]).find(isMarker)
  const turnTemplate = {
    ...component,
    children: (template as readonly Node[]).filter((node) => !isMarker(node)),
  }
  const names = await authorNamesOf(rows, authorField, tableName, reader)
  const { parent, unreadFrom } = await readerPlaceOf(component, rows, {
    reader,
    tableName,
    authorField,
  })
  const step = conversationStep({
    turnTemplate,
    markerTemplate,
    keys: keysOf(component),
    names,
    readerId: reader.session?.userId,
    locale: reader.db.recordText?.locale ?? 'en-US',
    unreadFrom,
    newMarker: unreadMarker(reader),
  })
  const walked = rows.reduce<Walk>(step, { nodes: [], day: undefined, author: undefined })
  const table = reader.app.tables?.find((candidate) => candidate.name === tableName)
  const children = await withConversationExtras(walked.nodes, {
    component,
    rows,
    db: reader.db,
    table,
  })
  return {
    ...component,
    children,
    [CONVERSATION_DIGEST_KEY]: digestOf(children),
    ...(parent === undefined ? {} : { [READ_STATE_PARENT_KEY]: parent }),
    props: { ...(component.props ?? {}), _dataSourceBound: true },
  } as Component
}

/**
 * The render-time field carrying a digest of what a bound frame draws: the
 * frame's island compares it before redrawing, so a redraw that would change
 * nothing leaves the frame — and a sheet open in it — as it is.
 */
export const CONVERSATION_DIGEST_KEY = 'conversationDigest'

/** A short FNV-1a digest of the resolved turns. */
const digestOf = (nodes: readonly Node[]): string => {
  const text = JSON.stringify(nodes)
  const hash = Array.from(text).reduce(
    (h, ch) => Math.imul(h ^ (ch.codePointAt(0) ?? 0), 16_777_619) >>> 0,
    2_166_136_261
  )
  return hash.toString(16)
}

/**
 * The children of a section bound to rows drawn on the server: a conversation
 * frame's turns, or the template expanded once per row for every other type.
 */
export async function expandBoundRows(
  component: Component,
  rows: readonly Row[],
  paginationMeta: PaginationMeta | undefined,
  reader: BoundRowsReader
): Promise<Component> {
  const tableName = component.dataSource?.table
  if (component.type === 'message-scroller') {
    const drawn =
      rows.length > 0
        ? await expandConversation(component, rows, reader)
        : expandDataSourceChildren(component, rows, paginationMeta, { tableName })
    return { ...drawn, ...followedParentOf(component, reader.app) } as Component
  }
  // A list nested in a row keeps its own template; it reads its rows afterwards.
  return expandDataSourceChildren(component, rows, paginationMeta, {
    tableName,
    substitution: 'stop-at-nested-rows',
  })
}
