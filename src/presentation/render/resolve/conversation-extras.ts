/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What a bound conversation's turns gain beyond the records list: the
 * link-preview cards the server already read for the addresses a record holds
 * (`bubble.linkPreviews`), a turn's reply summary (`message.replies`), and, on
 * each button of a turn, the record it acts on. Stamped as render-time fields the renderers
 * read, on the turns `conversation-rows.ts` drew, each of which carries the id
 * of the record it was drawn for ({@link CONVERSATION_RECORD_KEY}).
 */

import {
  linkAddressesOfRecord,
  linkPreviewFieldsOf,
} from '@/domain/models/app/pages/components/component-types/display/link-preview-service'
import type {
  CommentSummaryFacts,
  DataSourceDb,
  LinkPreviewCardFacts,
} from './data-source-contracts'
import type { Component } from '@/domain/models/app/pages/components'

type Node = Component | string
type Row = Readonly<Record<string, unknown>>

/** The render-time field naming the record a bound turn was drawn for. */
export const CONVERSATION_RECORD_KEY = 'conversationRecordId'

/** The render-time field carrying a previewing bubble's cards. */
export const LINK_PREVIEW_CARDS_KEY = 'linkPreviewCards'

interface ExtrasInput {
  readonly component: Component
  readonly rows: readonly Row[]
  readonly db: DataSourceDb
  /** The bound table, as declared: its comments are keyed by its id and its name. */
  readonly table: { readonly id?: number | string | undefined; readonly name: string } | undefined
}

/** The render-time field carrying a turn's reply summary, on a `message` with `replies: true`. */
export const REPLY_SUMMARY_KEY = 'replySummary'

/** A turn's reply summary as the message renderer draws it. */
export interface ReplySummaryView extends CommentSummaryFacts {
  readonly tableName: string
  readonly recordId: string
}

/** True when the turn template holds a `message` asking for its replies. */
const asksForReplies = (nodes: readonly Node[]): boolean =>
  nodes.some(
    (node) =>
      typeof node === 'object' &&
      ((node.type === 'message' && (node as { readonly replies?: unknown }).replies === true) ||
        (Array.isArray(node.children) && asksForReplies(node.children as readonly Node[])))
  )

/** The reply summary of every record that has replies, when the template asks for them. */
async function summariesByRecord(
  input: ExtrasInput
): Promise<ReadonlyMap<string, CommentSummaryFacts>> {
  const read = input.db.readCommentSummaries
  const template = (input.component.children ?? []) as readonly Node[]
  if (read === undefined || input.table === undefined || !asksForReplies(template)) {
    return new Map()
  }
  return read(
    input.table,
    input.rows.map((row) => String(row['id'] ?? ''))
  )
}

/** Where the app serves the picture of one card of one record. */
const pictureRoute = (tableName: string, recordId: string, previewId: string): string =>
  `/api/tables/${encodeURIComponent(tableName)}/records/${encodeURIComponent(recordId)}/link-previews/${previewId}`

/** The cards of every record, by record id, as the server already read them. */
async function cardsByRecord(
  input: ExtrasInput,
  tableName: string
): Promise<ReadonlyMap<string, readonly LinkPreviewCardFacts[]>> {
  const read = input.db.readLinkPreviews
  const fields =
    linkPreviewFieldsOf({ pages: [{ components: [input.component] }] }).get(tableName) ?? []
  if (read === undefined || fields.length === 0) return new Map()
  const entries = await Promise.all(
    input.rows.map(async (row) => {
      const addresses = linkAddressesOfRecord(row, fields)
      return [String(row['id'] ?? ''), addresses.length === 0 ? [] : await read(addresses)] as const
    })
  )
  return new Map(entries)
}

interface StampContext {
  readonly tableName: string
  readonly cards: ReadonlyMap<string, readonly LinkPreviewCardFacts[]>
  readonly summaries: ReadonlyMap<string, CommentSummaryFacts>
}

/** The reply summary a `message` asking for its replies draws, when its record has any. */
const replySummaryOf = (
  node: Readonly<Record<string, unknown>>,
  ctx: StampContext,
  recordId: string | undefined
): Readonly<Record<string, unknown>> => {
  if (node['type'] !== 'message' || node['replies'] !== true || recordId === undefined) return {}
  const summary = ctx.summaries.get(recordId)
  if (summary === undefined) return {}
  const view: ReplySummaryView = { ...summary, tableName: ctx.tableName, recordId }
  return { [REPLY_SUMMARY_KEY]: view }
}

/** A node of a turn with its record's cards on each previewing bubble. */
function stamp(node: Node, ctx: StampContext, recordId: string | undefined): Node {
  if (typeof node !== 'object') return node
  const fields = node as Component & Readonly<Record<string, unknown>>
  const own = fields[CONVERSATION_RECORD_KEY]
  const id = typeof own === 'string' ? own : recordId
  const children = Array.isArray(fields.children)
    ? { children: (fields.children as readonly Node[]).map((child) => stamp(child, ctx, id)) }
    : {}
  const cards =
    fields.type === 'bubble' && fields['linkPreviews'] === true && id !== undefined
      ? (ctx.cards.get(id) ?? [])
      : []
  const drawn = cards.map((card) => ({
    url: card.url,
    title: card.title,
    description: card.description,
    siteName: card.siteName,
    imageUrl: card.hasImage ? pictureRoute(ctx.tableName, id ?? '', card.id) : undefined,
  }))
  return {
    ...fields,
    ...children,
    ...recordOfButton(fields, id),
    ...replySummaryOf(fields, ctx, id),
    ...(drawn.length === 0 ? {} : { [LINK_PREVIEW_CARDS_KEY]: drawn }),
  } as Component
}

/**
 * A button of a turn acts on the turn's record — a moderator's Pin is a
 * `crud` update of THAT message — so it carries the record as a button drawn
 * for a page's bound record does (`props._record`).
 */
const recordOfButton = (
  node: Readonly<Record<string, unknown>>,
  recordId: string | undefined
): { readonly props?: Readonly<Record<string, unknown>> } => {
  const props = (node['props'] ?? {}) as Readonly<Record<string, unknown>>
  if (node['type'] !== 'button' || recordId === undefined || props['_record'] !== undefined) {
    return {}
  }
  return { props: { ...props, _record: { id: recordId } } }
}

/** The conversation's nodes with what each turn's record holds beyond the list. */
export async function withConversationExtras(
  nodes: readonly Node[],
  input: ExtrasInput
): Promise<readonly Node[]> {
  const tableName = input.component.dataSource?.table ?? ''
  const [cards, summaries] = await Promise.all([
    cardsByRecord(input, tableName),
    summariesByRecord(input),
  ])
  return nodes.map((node) => stamp(node, { tableName, cards, summaries }, undefined))
}
