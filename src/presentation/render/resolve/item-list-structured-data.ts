/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The `itemList` key of a page's authored structured data, turned into the
 * Schema.org `ItemList` it describes, for ONE reader.
 *
 * `itemList` is not JSON-LD: it names a table, a filter and a sort, and how one
 * row becomes one `ListItem`. Its rows are read here, before the head renders,
 * through the read every server-drawn list goes through ({@link readRowsForCaller}),
 * so the table's read permission, its row-level rule and its field-level rules
 * all apply to whoever requested the page. A crawler is a signed-out reader: a
 * row it may not read never reaches the HTML.
 *
 * The key is then REPLACED by the finished document, so the head's orchestrator
 * path emits it as one `<script type="application/ld+json">` beside the other
 * shorthand keys, and the source itself is never printed.
 */

import { leadingLanguageOf, withLanguageSegment } from '@/domain/kernel/matching/localized-path'
import { MAX_PAGE_SIZE } from '@/domain/kernel/sql/page-window'
import {
  recordFieldRefsIn,
  substituteRecordVars,
} from '@/domain/models/app/pages/substitute-record-vars'
import { readRowsForCaller } from './record-read-gate'
import type { DataSourceDb } from './data-source-contracts'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { Page } from '@/domain/models/app/pages'
import type { ItemListSource } from '@/domain/models/app/pages/meta'

/** Who the rows are read for, and where the page was served. */
export interface ItemListContext {
  readonly app: App
  readonly session: SessionInfo | undefined
  readonly db: DataSourceDb
  /** The scheme and host the request arrived on; absent, each address stays root-relative. */
  readonly requestOrigin?: string | undefined
  /** The base this app is served at (`''` at the site root). */
  readonly basePath?: string | undefined
  /** The `/{lang}/` prefix the request carried, when it carried one. */
  readonly urlLanguage?: string | undefined
}

type JsonObject = Readonly<Record<string, unknown>>

const isObject = (value: unknown): value is JsonObject =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const isItemListSource = (value: unknown): value is ItemListSource =>
  isObject(value) && isObject(value['dataSource']) && isObject(value['item'])

/**
 * Which authored document carries the source, under the head's own precedence:
 * `schema` wins, and the `structuredData` alias is read only without it.
 */
const itemListHost = (page: Page): 'schema' | 'structuredData' | undefined => {
  const { schema, structuredData } = page.meta ?? {}
  if (schema !== undefined)
    return isObject(schema) && isItemListSource(schema['itemList']) ? 'schema' : undefined
  return isObject(structuredData) && isItemListSource(structuredData['itemList'])
    ? 'structuredData'
    : undefined
}

/**
 * A row's address as the page serves it: a full address is kept, a path gets
 * the mount base, the page's language prefix (unless it already names it) and
 * the request host.
 */
const itemAddress = (url: string, ctx: ItemListContext): string => {
  if (/^https?:\/\//i.test(url)) return url
  const path = url.startsWith('/') ? url : `/${url}`
  const { urlLanguage } = ctx
  const localized =
    urlLanguage !== undefined && leadingLanguageOf(path, [urlLanguage]) === undefined
      ? withLanguageSegment(urlLanguage, path)
      : path
  return `${ctx.requestOrigin ?? ''}${ctx.basePath ?? ''}${localized}`
}

/**
 * One `ListItem` per row, numbered from 1. A row missing a field the item
 * names (a column the reader may not read) contributes no item rather than a
 * blank name or a truncated address.
 */
const listItems = (
  source: ItemListSource,
  rows: readonly JsonObject[],
  ctx: ItemListContext
): readonly JsonObject[] => {
  const named = [...recordFieldRefsIn(source.item.name), ...recordFieldRefsIn(source.item.url)]
  return rows
    .filter((row) => named.every((field) => row[field] !== undefined && row[field] !== null))
    .map((row, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: substituteRecordVars(source.item.name, row),
      url: itemAddress(substituteRecordVars(source.item.url, row), ctx),
    }))
}

/**
 * The rows of the source's table for this reader: its filter and sort, bounded
 * by the page window a list without an explicit limit reads. A table the app
 * does not declare yields none (the config refuses it at load anyway).
 */
const readSourceRows = async (
  source: ItemListSource,
  ctx: ItemListContext
): Promise<readonly JsonObject[]> => {
  const { table: tableName, filter, sort } = source.dataSource
  const table = (ctx.app.tables ?? []).find((candidate) => candidate.name === tableName)
  if (table === undefined) return []
  const declared = new Set(table.fields.map((field) => field.name))
  const fields = [...recordFieldRefsIn(source.item.name), ...recordFieldRefsIn(source.item.url)]
    .filter((field) => declared.has(field))
    .filter((field, index, all) => all.indexOf(field) === index)
  const { rows } = await readRowsForCaller({
    app: ctx.app,
    tableName,
    session: ctx.session,
    db: ctx.db,
    query: {
      ...(fields.length > 0 ? { fields } : {}),
      ...(filter !== undefined ? { filter } : {}),
      ...(sort !== undefined ? { sort } : {}),
      pageSize: MAX_PAGE_SIZE,
    },
  })
  return rows
}

/**
 * The page with its `itemList` source replaced by the `ItemList` built from the
 * rows this reader may read; a page carrying none, and a resolver answer that is
 * no page (a 404, a refusal), come back by reference. No readable row gives an
 * `ItemList` with an empty `itemListElement`.
 */
export async function resolvePageItemList<T extends Page | object | undefined>(
  resolved: T,
  ctx: ItemListContext
): Promise<T> {
  if (resolved === undefined || !('path' in resolved)) return resolved
  const page = resolved as Page
  const host = itemListHost(page)
  if (host === undefined || page.meta === undefined) return resolved
  const document = page.meta[host] as JsonObject
  const source = document['itemList'] as ItemListSource
  const rows = await readSourceRows(source, ctx)
  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: listItems(source, rows, ctx),
  }
  return { ...page, meta: { ...page.meta, [host]: { ...document, itemList } } } as T
}
