/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The Notion fetcher: one database, read through the API version it pins,
 * {@link NOTION_API_VERSION}
 * (pinned under `[internal ref]`). Since that
 * version a database is a container of data sources, each with its own
 * schema and rows.
 *
 * - `GET /v1/databases/{id}` — the container and its data sources
 *   (`raw/databases/<id>.json`).
 * - `GET /v1/data_sources/{id}` — one schema (`raw/data_sources/<id>/schema.json`).
 *   The data sources a relation points at are read too, so a link lands on an
 *   imported table; one the connection cannot see (`404`) is left out.
 * - `POST /v1/data_sources/{id}/query` — the rows, page by page
 *   (`query-NNNN.json`). A query is a read: Notion answers reads of rows on
 *   `POST`. Rows are sorted by `created_time`, and `request_status` is checked
 *   on every page: a query stops at 10,000 rows, so at the cap the next query
 *   starts a new window at the last row's `created_time`.
 * - `GET /v1/pages/{id}/properties/{property}` — the full value of a relation
 *   past 25 links, and of the formulas and rollups of that row, which may have
 *   been computed from the truncated list; people too, past 25.
 * - Files Notion hosts expire after an hour, so each page's files are
 *   downloaded before the next page is asked for. A file linked from another
 *   site is not downloaded.
 *
 * Every request carries `Notion-Version`. A `429` carries `Retry-After`, which
 * the client waits out. Notion's automations and buttons are not in the API.
 */

import { Effect } from 'effect'
import { isRecord } from '@/domain/kernel/config-parsing/plain-object'
import { notionAssetKey, notionPropertyFileKey } from '@/domain/models/import/notion-cells-service'
import { fetchSourceJson, ImportFetchError, type ImportFetchResponse } from './import-fetch-client'
import {
  heldOrFetched,
  fetchAttachment,
  type FetchContext,
  type FetchSummary,
} from './import-fetch-sink'

/** The API version the fetcher speaks. */
export const NOTION_API_VERSION = '2025-09-03'

/** How Notion is reached, given the operator's token. */
export const notionTarget = (token: string) => ({
  tool: 'notion',
  realBaseUrl: 'https://api.notion.com',
  headers: { authorization: `Bearer ${token}`, 'notion-version': NOTION_API_VERSION },
  lockoutSeconds: 60,
})

const DATABASE_ID = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i

/** Why a `notion:` source is not one the fetcher reads, or `undefined`. */
export const refuseNotionSource = (id: string): string | undefined =>
  DATABASE_ID.test(id)
    ? undefined
    : `"notion:${id}" does not name a Notion database. Write it notion:<databaseId>, the 32-character id in the database's link (notion.so/…/<databaseId>?v=…).`

/** Rows per query page: Notion's maximum. */
const PAGE_SIZE = 100
/** A list past this many items may have been truncated by the query. */
const TRUNCATED_AT = 25

type Json = Readonly<Record<string, unknown>>

const objectsOf = (value: unknown): readonly Json[] =>
  Array.isArray(value) ? value.filter(isRecord) : []

const pad = (page: number): string => String(page).padStart(4, '0')

/** Where a query resumes: the window's lower bound and Notion's cursor inside it. */
export interface QueryPosition {
  readonly after?: string
  readonly next?: string
}

/** What follows one query page: another page, a new window, the end, or a stop. */
export type QueryStep =
  | { readonly kind: 'next'; readonly position: QueryPosition }
  | { readonly kind: 'done' }
  | { readonly kind: 'stuck'; readonly reason: string }

/**
 * The step after one query page. `request_status` is read on every page: at
 * the 10,000-row cap `has_more` is false, and only the status says the rows
 * were cut, so the next window starts at the last row's `created_time` (rows
 * at that instant are read twice and kept once by the conversion). A window
 * that cannot move forward stops the fetch rather than looping.
 */
export const nextQueryStep = (page: unknown, position: QueryPosition): QueryStep => {
  const json = isRecord(page) ? page : {}
  if (json['has_more'] === true && typeof json['next_cursor'] === 'string') {
    const after = position.after === undefined ? {} : { after: position.after }
    return { kind: 'next', position: { ...after, next: json['next_cursor'] } }
  }
  const status = isRecord(json['request_status']) ? json['request_status'] : {}
  return status['type'] === 'incomplete' ? nextWindow(json, status, position) : { kind: 'done' }
}

/** The window after a query Notion reported incomplete. */
const nextWindow = (page: Json, status: Json, position: QueryPosition): QueryStep => {
  if (status['incomplete_reason'] !== 'query_result_limit_reached') {
    return {
      kind: 'stuck',
      reason: `Notion answered an incomplete query (${String(status['incomplete_reason'])})`,
    }
  }
  const last = objectsOf(page['results']).at(-1)?.['created_time']
  if (typeof last !== 'string' || last === position.after) {
    return {
      kind: 'stuck',
      reason:
        'more than 10,000 rows of one data source share a creation time, which Notion cannot page past',
    }
  }
  return { kind: 'next', position: { after: last } }
}

/** The query body for a position: sorted by creation, windowed, from a cursor. */
const queryBody = (position: QueryPosition) => ({
  page_size: PAGE_SIZE,
  sorts: [{ timestamp: 'created_time', direction: 'ascending' }],
  ...(position.after === undefined
    ? {}
    : { filter: { timestamp: 'created_time', created_time: { on_or_after: position.after } } }),
  ...(position.next === undefined ? {} : { start_cursor: position.next }),
})

const positionOf = (cursor: string | undefined): QueryPosition => {
  if (cursor === undefined) return {}
  const parsed = JSON.parse(cursor) as unknown
  return isRecord(parsed)
    ? {
        ...(typeof parsed['after'] === 'string' ? { after: parsed['after'] } : {}),
        ...(typeof parsed['next'] === 'string' ? { next: parsed['next'] } : {}),
      }
    : {}
}

/** Download every file Notion hosts on one row; count a linked file as skipped. */
const fetchRowFiles = (context: FetchContext, row: Json): Effect.Effect<void, ImportFetchError> => {
  const pageId = String(row['id'])
  const files = Object.values(isRecord(row['properties']) ? row['properties'] : {})
    .filter(isRecord)
    .filter((property) => property['type'] === 'files')
    .flatMap((property) =>
      objectsOf(property['files']).map((file, index) => ({
        source: notionAssetKey(pageId, String(property['id']), index),
        filename: String(file['name'] ?? 'file'),
        hosted: isRecord(file['file']) ? file['file']['url'] : undefined,
      }))
    )
  return Effect.forEach(
    files,
    ({ source, filename, hosted }) =>
      typeof hosted === 'string'
        ? fetchAttachment(context, { source, filename, url: hosted })
        : context.sink.attachment({ kind: 'skipped', source, filename }),
    { discard: true }
  )
}

/** Whether a query value may be a truncated list: a relation that says so, people past 25. */
const isTruncated = (property: Json): boolean =>
  (property['type'] === 'relation' && property['has_more'] === true) ||
  (property['type'] === 'people' && objectsOf(property['people']).length >= TRUNCATED_AT)

const isComputed = (property: Json): boolean =>
  property['type'] === 'formula' || property['type'] === 'rollup'

/**
 * The properties of a row whose query value may be truncated, to read in
 * full: a truncated list, and with a truncated relation the row's formulas
 * and rollups, which may have been computed from it.
 */
export const truncatedProperties = (row: unknown): readonly string[] => {
  const held = isRecord(row) && isRecord(row['properties']) ? row['properties'] : {}
  const properties = Object.values(held).filter(isRecord)
  const truncated = properties.filter(isTruncated)
  const relation = truncated.some((property) => property['type'] === 'relation')
  const computed = relation ? properties.filter(isComputed) : []
  return [...truncated, ...computed].map((property) => String(property['id']))
}

/** One property of one row, read in full through the page-property endpoint. */
const walkProperty = (
  context: FetchContext,
  dataSourceId: string,
  pageId: string,
  propertyId: string
): Effect.Effect<void, ImportFetchError> => {
  const path = (page: number) =>
    `raw/data_sources/${dataSourceId}/properties/${pageId}/${notionPropertyFileKey(propertyId)}-${pad(page)}.json`
  const step = (page: number, cursor: string | undefined): Effect.Effect<void, ImportFetchError> =>
    fetchSourceJson(context.target, context.base, {
      method: 'GET',
      path: `/v1/pages/${pageId}/properties/${propertyId}`,
      query: {
        page_size: String(PAGE_SIZE),
        ...(cursor === undefined ? {} : { start_cursor: cursor }),
      },
    }).pipe(
      Effect.tap((response) => context.sink.writeRaw(path(page), response.bytes)),
      Effect.flatMap((response) => {
        const json = isRecord(response.json) ? response.json : {}
        const next = json['has_more'] === true ? json['next_cursor'] : undefined
        return typeof next === 'string' ? step(page + 1, next) : Effect.void
      })
    )
  return step(1, undefined)
}

/** What one query page brings besides itself: its files, and its truncated values in full. */
const completePage = (
  context: FetchContext,
  dataSourceId: string,
  response: ImportFetchResponse
): Effect.Effect<void, ImportFetchError> =>
  Effect.forEach(
    objectsOf(isRecord(response.json) ? response.json['results'] : undefined),
    (row) =>
      fetchRowFiles(context, row).pipe(
        Effect.flatMap(() =>
          Effect.forEach(
            truncatedProperties(row),
            (propertyId) => walkProperty(context, dataSourceId, String(row['id']), propertyId),
            { discard: true }
          )
        )
      ),
    { discard: true }
  )

/** Every row of one data source, from where a previous run stopped. */
const fetchRows = (
  context: FetchContext,
  dataSourceId: string
): Effect.Effect<void, ImportFetchError> => {
  const resource = `data_sources/${dataSourceId}/query`
  const previous = context.sink.cursorOf(resource)
  if (previous?.complete === true) return Effect.void
  const step = (pages: number, position: QueryPosition): Effect.Effect<void, ImportFetchError> =>
    fetchSourceJson(context.target, context.base, {
      method: 'POST',
      path: `/v1/data_sources/${dataSourceId}/query`,
      body: queryBody(position),
    }).pipe(
      Effect.tap((response) =>
        context.sink.writeRaw(
          `raw/data_sources/${dataSourceId}/query-${pad(pages + 1)}.json`,
          response.bytes
        )
      ),
      Effect.tap((response) => completePage(context, dataSourceId, response)),
      Effect.flatMap((response) => {
        const next = nextQueryStep(response.json, position)
        if (next.kind === 'stuck') {
          return Effect.fail(new ImportFetchError({ message: next.reason, resumable: false }))
        }
        const complete = next.kind === 'done'
        return context.sink
          .saveCursor({
            resource,
            pages: pages + 1,
            complete,
            ...(complete ? {} : { cursor: JSON.stringify(next.position) }),
          })
          .pipe(
            Effect.flatMap(() =>
              next.kind === 'next' ? step(pages + 1, next.position) : Effect.void
            )
          )
      })
    )
  return step(previous?.pages ?? 0, positionOf(previous?.cursor))
}

/** One data source's schema; a related one the connection cannot see is `undefined`. */
const fetchSchema = (
  context: FetchContext,
  dataSourceId: string,
  related: boolean
): Effect.Effect<unknown, ImportFetchError> =>
  heldOrFetched(
    context,
    `raw/data_sources/${dataSourceId}/schema.json`,
    `/v1/data_sources/${dataSourceId}`
  ).pipe(
    // Swallowed on purpose, a related source's 404 only: the connection was not
    // shared with it, so its relation is left out and reported by the adapter.
    Effect.catchIf(
      (error) => related && error.status === 404,
      () => Effect.void
    )
  )

/** The data sources a schema's relations point at. */
const relatedOf = (schema: unknown): readonly string[] =>
  Object.values(isRecord(schema) && isRecord(schema['properties']) ? schema['properties'] : {})
    .filter(isRecord)
    .flatMap((property) => {
      const relation = isRecord(property['relation']) ? property['relation'] : undefined
      const target = relation?.['data_source_id']
      return property['type'] === 'relation' && typeof target === 'string' ? [target] : []
    })

/**
 * Every data source reachable from the database, its own first, then the ones
 * its relations point at, each once. Returns the ones read.
 */
const fetchSources = (
  context: FetchContext,
  queue: readonly string[],
  own: ReadonlySet<string>,
  seen: readonly string[]
): Effect.Effect<readonly string[], ImportFetchError> => {
  const [current, ...rest] = queue
  if (current === undefined) return Effect.succeed(seen)
  return fetchSchema(context, current, !own.has(current)).pipe(
    Effect.flatMap((schema) => {
      if (schema === undefined) return fetchSources(context, rest, own, seen)
      const read = [...seen, current]
      const next = [
        ...rest,
        ...relatedOf(schema).filter((id) => !read.includes(id) && !rest.includes(id)),
      ]
      const rows = context.domains.includes('data') ? fetchRows(context, current) : Effect.void
      return rows.pipe(Effect.flatMap(() => fetchSources(context, next, own, read)))
    })
  )
}

/** Fetch one Notion database, its data sources and the ones they relate to, into the snapshot. */
export const fetchNotionDatabase = (
  context: FetchContext,
  databaseId: string
): Effect.Effect<FetchSummary, ImportFetchError> =>
  Effect.gen(function* () {
    const database = yield* heldOrFetched(
      context,
      `raw/databases/${databaseId}.json`,
      `/v1/databases/${databaseId}`
    )
    const own = objectsOf(isRecord(database) ? database['data_sources'] : undefined).map((source) =>
      String(source['id'])
    )
    const read = yield* fetchSources(context, own, new Set(own), [])
    return { ids: [databaseId, ...read], apiVersion: NOTION_API_VERSION }
  }).pipe(Effect.withSpan('import.fetch-notion-database'))
