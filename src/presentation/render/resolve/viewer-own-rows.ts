/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The reader's OWN related rows: `dataSource.mine` on a list, a gallery or a
 * progress bar, and a collection page's `resume`.
 *
 * One read per binding, never one per item: the rows of the lookup table whose
 * person field names the reader, through the records gate
 * ({@link readRowsForCaller}) — so the lookup table's own read rules apply, and
 * a row naming anybody else is never read at all. Without a session there is
 * no reader, hence no row.
 */

import { RECORD_TEXT_KEY } from '@/domain/models/app/pages/substitute-record-vars'
import { recordTextEntriesOf } from '@/presentation/render/props/record-value-format'
import { withAvatarMembers } from './avatar-members-binding'
import { withProgressRatio } from './progress-ratio-binding'
import { labelledPageRows } from './record-display-labels'
import { readRowsForCaller } from './record-read-gate'
import type { DataSourceDb } from './data-source-contracts'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type {
  DataSourceMine,
  ViewerRowLookup,
} from '@/domain/models/app/pages/components/data-source'

type Row = Readonly<Record<string, unknown>>

/** Who reads, and through which database. */
export interface ViewerReadContext {
  readonly app: App
  readonly session: SessionInfo | undefined
  readonly db: DataSourceDb
}

/** The key a link value is matched by: a relationship reads back as a number or a string. */
const linkKey = (value: unknown): string | undefined =>
  value === null || value === undefined || value === '' ? undefined : String(value)

/**
 * The reader's own rows of `lookup.table`, keyed by the item each points at
 * (its `link` value). Empty without a reader.
 */
async function readViewerRows(
  lookup: ViewerRowLookup,
  ctx: ViewerReadContext
): Promise<ReadonlyMap<string, Row>> {
  const userId = ctx.session?.userId
  if (userId === undefined || userId === '') return new Map()
  const { rows } = await readRowsForCaller({
    app: ctx.app,
    tableName: lookup.table,
    session: ctx.session,
    db: ctx.db,
    query: {
      filter: [{ field: lookup.user, operator: 'eq', value: userId }],
      sort: [{ field: 'id', direction: 'asc' }],
    },
  })
  return new Map(
    rows.flatMap((row) => {
      const key = linkKey(row[lookup.link])
      // A row read back without its person (a column she may not read) is not hers to show.
      return key === undefined || String(row[lookup.user]) !== userId ? [] : [[key, row]]
    })
  )
}

/**
 * The reader's own rows of `lookup.table`, keyed by the item each points at
 * (its `link` value), each answering that row's id. Empty without a reader.
 */
export async function readViewerRowIds(
  lookup: ViewerRowLookup,
  ctx: ViewerReadContext
): Promise<ReadonlyMap<string, unknown>> {
  const rows = await readViewerRows(lookup, ctx)
  return new Map(Array.from(rows, ([key, row]) => [key, row['id']]))
}

/**
 * The fields of the reader's own row an item reads as `$record.<as>.<field>`:
 * each stored value under `<as>.<field>`, and the text a text site prints of it
 * — a date by its type, a linked record or a person by its label — in the
 * item's text map. `$record.<as>` itself stays the row's id. With no row, every
 * `$record.<as>.<field>` reads empty.
 */
function ownRowFieldsOf(as: string, prepared: Row | undefined): Row {
  if (prepared === undefined) return {}
  const fields = Object.entries(prepared).filter(([key]) => !key.startsWith('_'))
  const printed = recordTextEntriesOf(prepared)
  return {
    ...Object.fromEntries(fields.map(([key, value]) => [`${as}.${key}`, value])),
    [RECORD_TEXT_KEY]: Object.fromEntries(printed.map(([key, value]) => [`${as}.${key}`, value])),
  }
}

/** The reader's own rows, labelled and formatted as the lookup table's rows read on a page. */
async function preparedViewerRows(
  lookup: ViewerRowLookup,
  ctx: ViewerReadContext
): Promise<ReadonlyMap<string, Row>> {
  const own = await readViewerRows(lookup, ctx)
  const keys = Array.from(own.keys())
  const prepared = await labelledPageRows(Array.from(own.values()), {
    ...ctx,
    tableName: lookup.table,
  })
  return new Map(keys.map((key, index) => [key, prepared[index] as Row]))
}

/**
 * What a `crud` toggle drawn on an item needs to switch the reader's row: the
 * item and her row (both `$record.` tokens, filled per item), the two fields a
 * new row fills, her id, and the region redrawn once it has answered.
 */
export interface ViewerToggleMarker {
  readonly item: string
  readonly row: string
  readonly link: string
  readonly user: string
  readonly userId: string
  readonly region: string | undefined
}

type Node = Readonly<Record<string, unknown>>

/** Is this node a `crud` toggle switching the row joined as `as`? */
const togglesMine = (node: Node, as: string): boolean => {
  const action = node['action'] as Node | undefined
  return action?.['type'] === 'crud' && action['operation'] === 'toggle' && action['mine'] === as
}

/**
 * The item template with every `crud` toggle naming `mine.as` marked for the
 * button renderer (`props._toggle`), at any depth. The marker's tokens are
 * filled per item by the row expansion, as every other prop is.
 */
export function withViewerToggles<T>(
  children: T,
  mine: DataSourceMine,
  ctx: { readonly session: SessionInfo | undefined; readonly region: string | undefined }
): T {
  if (!Array.isArray(children)) return children
  const marker: ViewerToggleMarker = {
    item: '$record.id',
    row: `$record.${mine.as}`,
    link: mine.link,
    user: mine.user,
    userId: ctx.session?.userId ?? '',
    region: ctx.region,
  }
  const mark = (entry: unknown): unknown => {
    if (typeof entry !== 'object' || entry === null) return entry
    const node = entry as Node
    const nested = Array.isArray(node['children'])
      ? { children: (node['children'] as readonly unknown[]).map(mark) }
      : {}
    if (!togglesMine(node, mine.as)) return { ...node, ...nested }
    const props = (node['props'] ?? {}) as Node
    return { ...node, ...nested, props: { ...props, _toggle: marker } }
  }
  return children.map(mark) as T
}

/**
 * What a gallery's island needs to join and switch the reader's row itself —
 * its cards are drawn in the browser: the join's names, her id, and her rows,
 * keyed by the item each points at.
 */
export interface ViewerRowsStamp {
  readonly as: string
  readonly table: string
  readonly link: string
  readonly user: string
  readonly userId: string
  readonly rows: Readonly<Record<string, unknown>>
}

/**
 * A binding joining the reader's own row: the items with it joined, and the
 * component ready to draw it — a server-drawn list's toggles marked (its own
 * `props.id` is the region redrawn after a switch), a gallery's island handed
 * her rows (`props._viewerRows`).
 */
async function bindViewerRows<
  C extends {
    readonly type: string
    readonly children?: unknown
    readonly props?: unknown
    readonly dataSource?: { readonly mine?: DataSourceMine }
  },
>(
  component: C,
  rows: readonly Row[],
  ctx: ViewerReadContext
): Promise<{ readonly component: C; readonly rows: readonly Row[] }> {
  const mine = component.dataSource?.mine
  if (mine === undefined) return { component, rows }
  const own = await preparedViewerRows(mine, ctx)
  const joined = rows.map((row) => {
    const mineRow = own.get(String(row['id']))
    return { ...row, ...ownRowFieldsOf(mine.as, mineRow), [mine.as]: mineRow?.['id'] ?? null }
  })
  const props = (component.props ?? {}) as Readonly<Record<string, unknown>>
  if (component.type === 'gallery') {
    const stamp: ViewerRowsStamp = {
      ...mine,
      userId: ctx.session?.userId ?? '',
      rows: Object.fromEntries(Array.from(own, ([key, row]) => [key, row['id']])),
    }
    return { component: { ...component, props: { ...props, _viewerRows: stamp } }, rows: joined }
  }
  const region = typeof props['id'] === 'string' ? props['id'] : undefined
  const children = withViewerToggles(component.children, mine, { session: ctx.session, region })
  return { component: { ...component, children }, rows: joined }
}

/**
 * What a server-drawn binding does with the rows it read before drawing them:
 * the reader's own row joined (`dataSource.mine`), then a bound progress bar's
 * figure taken over them (`progress-ratio-binding.ts`), or a bound avatar
 * group's people (`avatar-members-binding.ts`).
 */
export async function bindReadRows<
  C extends {
    readonly type: string
    readonly children?: unknown
    readonly props?: unknown
    readonly dataSource?: { readonly mine?: DataSourceMine; readonly table?: unknown }
  },
>(
  component: C,
  rows: readonly Row[],
  ctx: ViewerReadContext
): Promise<{ readonly component: C; readonly rows: readonly Row[] }> {
  const own = await bindViewerRows(component, rows, ctx)
  const counted = withProgressRatio(own.component, own.rows, ctx.app)
  return { component: await withAvatarMembers(counted, own.rows, ctx), rows: own.rows }
}
