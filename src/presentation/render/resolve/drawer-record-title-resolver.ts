/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The name a record sheet's address opens it on, read before the page is drawn.
 *
 * A table-bound sheet that declares no `title` is named by its record — the
 * first text field holding a value, else its id (`recordTitleOf`). The
 * browser learns that name once the record loads; for a sheet its address
 * opens (`?record=<id>`), the page the server sends already carries it, so the
 * skeleton a reader or a crawler meets is named by the record too.
 *
 * The record is read through the records gate as THIS reader (`readRowsForCaller`):
 * a record she may not read, or one that does not exist, leaves the sheet with
 * the interpreter's default name — the same answer for both.
 *
 * Only the sheet the address opens is read: the one `?drawer=` names, or — with
 * a bare `?record=` — the first record-bound sheet in document order, the rule
 * the island applies (`record-drawer-address.ts`).
 */

import { recordTitleOf } from '@/domain/models/app/tables/record-title-service'
import { readRowsForCaller } from './record-read-gate'
import type { DataSourceDb } from './data-source-contracts'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { Page } from '@/domain/models/app/pages'

/** The prop the sheet's renderer reads the name from. */
export const RECORD_TITLE_KEY = '_recordTitle'

type Node = Readonly<Record<string, unknown>>

/** A record-bound sheet's table, or `undefined` for any other node. */
const sheetTable = (node: Node): string | undefined => {
  const table = (node['dataSource'] as { readonly table?: unknown } | undefined)?.table
  return node['type'] === 'sheet' && typeof table === 'string' ? table : undefined
}

/** Every node of the tree, in document order. */
const walk = (nodes: readonly unknown[]): readonly Node[] =>
  nodes.flatMap((node) => {
    if (typeof node !== 'object' || node === null) return []
    const { children } = node as Node
    return [node as Node, ...(Array.isArray(children) ? walk(children) : [])]
  })

/** The sheet the address opens, when it is one that takes its name from its record. */
function addressedSheet(
  components: readonly unknown[],
  drawer: string | undefined
): Node | undefined {
  const sheets = walk(components).filter((node) => sheetTable(node) !== undefined)
  const sheet =
    drawer === undefined ? sheets[0] : sheets.find((candidate) => candidate['id'] === drawer)
  const declaredTitle = (sheet?.['props'] as Node | undefined)?.['title']
  return sheet !== undefined && declaredTitle === undefined ? sheet : undefined
}

/** Put the name on the sheet the address opens, leaving every other node as it was. */
const stampTitle = (nodes: readonly unknown[], target: Node, title: string): readonly unknown[] =>
  nodes.map((node) => {
    if (typeof node !== 'object' || node === null) return node
    if (node === target) {
      const props = ((node as Node)['props'] as Node | undefined) ?? {}
      return { ...(node as Node), props: { ...props, [RECORD_TITLE_KEY]: title } }
    }
    const { children } = node as Node
    return Array.isArray(children)
      ? { ...(node as Node), children: stampTitle(children, target, title) }
      : node
  })

/** The record id an address opens a sheet on, or `undefined` for none (or a new record). */
const addressedRecord = (
  query: Readonly<Record<string, string>> | undefined
): string | undefined => {
  const recordId = query?.['record']
  return recordId === undefined || recordId === '' || recordId === 'new' ? undefined : recordId
}

/** Read, as the reader, the name of the record the address opens a sheet on. */
export async function resolveAddressedDrawerTitle(
  page: Page,
  ctx: {
    readonly app: App
    readonly session: SessionInfo | undefined
    readonly db: DataSourceDb
    readonly requestQuery: Readonly<Record<string, string>> | undefined
  }
): Promise<Page> {
  const recordId = addressedRecord(ctx.requestQuery)
  const components = (page.components ?? []) as readonly unknown[]
  const sheet =
    recordId === undefined ? undefined : addressedSheet(components, ctx.requestQuery?.['drawer'])
  const tableName = sheet === undefined ? undefined : sheetTable(sheet)
  const table = ctx.app.tables?.find((candidate) => candidate.name === tableName)
  if (recordId === undefined || sheet === undefined || table === undefined) return page
  const { rows } = await readRowsForCaller({
    app: ctx.app,
    tableName: table.name,
    session: ctx.session,
    db: ctx.db,
    query: { filter: [{ field: 'id', operator: 'in', value: [recordId] }] },
  })
  const row = rows[0]
  if (row === undefined) return page
  const title = recordTitleOf(table.fields, row)
  return { ...page, components: stampTitle(components, sheet, title) as Page['components'] }
}
