/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The Airtable fetcher: one base, read through the Web API v0 (pinned under
 * `[internal ref]`).
 *
 * - `GET /v0/meta/bases/{baseId}/tables` — the schema, fields and views, with
 *   the fields each grid view shows (`include[]=visibleFieldIds`)
 *   (`raw/meta/tables.json`).
 * - `GET /v0/{baseId}/{tableId}` page by page, `offset` as the cursor, cells
 *   keyed by field id (`returnFieldsByFieldId`) so a field renamed between the
 *   two calls cannot lose its values
 *   (`raw/tables/<tableId>/records-0001.json`, …), each page persisted with its
 *   cursor before the next is asked for.
 * - Attachment URLs expire after two hours, so every attachment of a page is
 *   downloaded while that page is fresh.
 * - A form view's metadata (`GET /v0/meta/bases/{baseId}/views/{viewId}`),
 *   for the forms part.
 *
 * A `429` locks the base for 30 seconds and carries no `Retry-After`, which is
 * the lockout the client waits. Airtable's automations and interfaces are not
 * in the REST API, so nothing here reads them.
 */

import { Effect } from 'effect'
import { arrayOf, isRecord } from '@/domain/kernel/config-parsing/plain-object'
import { fetchSourceJson, type ImportFetchError } from './import-fetch-client'
import {
  heldOrFetched,
  fetchAttachment,
  type FetchContext,
  type FetchSummary,
} from './import-fetch-sink'

/** How Airtable is reached, given the operator's token. */
export const airtableTarget = (token: string) => ({
  tool: 'airtable',
  realBaseUrl: 'https://api.airtable.com',
  headers: { authorization: `Bearer ${token}` },
  lockoutSeconds: 30,
})

/** Records per page: Airtable's maximum. */
const PAGE_SIZE = '100'

/** Every attachment object of a records page: `{ id, url, filename }` inside a cell list. */
const attachmentsOf = (page: unknown) =>
  arrayOf(isRecord(page) ? page['records'] : undefined).flatMap((record) =>
    Object.values(isRecord(record) && isRecord(record['fields']) ? record['fields'] : {}).flatMap(
      (cell) =>
        arrayOf(cell).flatMap((item) =>
          isRecord(item) && typeof item['url'] === 'string' && typeof item['filename'] === 'string'
            ? [
                {
                  source: String(item['id'] ?? item['url']),
                  url: item['url'],
                  filename: item['filename'],
                },
              ]
            : []
        )
    )
  )

const pageName = (page: number): string => `records-${String(page).padStart(4, '0')}.json`

/** Every records page of one table, from where a previous run stopped. */
const fetchRecords = (
  context: FetchContext,
  baseId: string,
  tableId: string
): Effect.Effect<void, ImportFetchError> => {
  const resource = `tables/${tableId}/records`
  const previous = context.sink.cursorOf(resource)
  if (previous?.complete === true) return Effect.void
  const step = (pages: number, offset: string | undefined): Effect.Effect<void, ImportFetchError> =>
    fetchSourceJson(context.target, context.base, {
      method: 'GET',
      path: `/v0/${baseId}/${tableId}`,
      query: {
        pageSize: PAGE_SIZE,
        returnFieldsByFieldId: 'true',
        ...(offset === undefined ? {} : { offset }),
      },
    }).pipe(
      Effect.tap((response) =>
        context.sink.writeRaw(`raw/tables/${tableId}/${pageName(pages + 1)}`, response.bytes)
      ),
      Effect.tap((response) =>
        Effect.forEach(
          attachmentsOf(response.json),
          (attachment) => fetchAttachment(context, attachment),
          {
            discard: true,
          }
        )
      ),
      Effect.flatMap((response) => {
        const next = isRecord(response.json) ? response.json['offset'] : undefined
        const cursor = typeof next === 'string' ? next : undefined
        return context.sink
          .saveCursor({
            resource,
            pages: pages + 1,
            complete: cursor === undefined,
            ...(cursor === undefined ? {} : { cursor }),
          })
          .pipe(
            Effect.flatMap(() => (cursor === undefined ? Effect.void : step(pages + 1, cursor)))
          )
      })
    )
  return step(previous?.pages ?? 0, previous?.cursor)
}

/** The base schema: re-read from the snapshot on a resumed run, fetched otherwise. */
const fetchSchema = (
  context: FetchContext,
  baseId: string
): Effect.Effect<unknown, ImportFetchError> =>
  heldOrFetched(context, 'raw/meta/tables.json', `/v0/meta/bases/${baseId}/tables`, {
    'include[]': 'visibleFieldIds',
  })

/** Fetch one Airtable base into the snapshot. */
export const fetchAirtableBase = (
  context: FetchContext,
  baseId: string
): Effect.Effect<FetchSummary, ImportFetchError> =>
  Effect.gen(function* () {
    const schema = yield* fetchSchema(context, baseId)
    const tables = arrayOf(isRecord(schema) ? schema['tables'] : undefined).filter(isRecord)
    const tableIds = tables.map((table) => String(table['id']))
    if (context.domains.includes('data')) {
      yield* Effect.forEach(tableIds, (tableId) => fetchRecords(context, baseId, tableId), {
        discard: true,
      })
    }
    if (context.domains.includes('forms')) {
      const forms = tables.flatMap((table) =>
        arrayOf(table['views']).filter((view) => isRecord(view) && view['type'] === 'form')
      )
      yield* Effect.forEach(
        forms.filter(isRecord),
        (view) =>
          fetchSourceJson(context.target, context.base, {
            method: 'GET',
            path: `/v0/meta/bases/${baseId}/views/${String(view['id'])}`,
          }).pipe(
            Effect.flatMap((response) =>
              context.sink.writeRaw(`raw/views/${String(view['id'])}.json`, response.bytes)
            )
          ),
        { discard: true }
      )
    }
    return { ids: [baseId, ...tableIds], apiVersion: 'v0' }
  }).pipe(Effect.withSpan('import.fetch-airtable-base'))
