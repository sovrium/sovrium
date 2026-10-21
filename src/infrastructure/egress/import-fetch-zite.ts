/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The Zite fetcher: one database, read through the Zite Database API
 * (pinned under `[internal ref]`).
 *
 * - `GET /api/v1/bases/{databaseId}` — the tables, each with its fields and
 *   views (`raw/database.json`).
 * - `GET /api/v1/bases/{databaseId}/tables/{tableId}/fields` — each table's
 *   fields in display order (`raw/tables/<tableId>/fields.json`).
 * - `POST /api/v1/bases/{databaseId}/tables/{tableId}/records/list` page by
 *   page, `{ offset, limit: 2000 }` in the body (the API's cap), `offset` as
 *   the cursor, while the page says `hasMore`
 *   (`raw/tables/<tableId>/records-0001.json`, …). It is a POST only because
 *   its parameters travel in a body: it reads, and writes nothing.
 * - Every attachment value (`[{ url, filename }]`) is downloaded with its page.
 *   Zite does not document how long its attachment links live, so a link that
 *   cannot be downloaded is counted as skipped rather than stopping the fetch.
 *
 * Nothing else is sent: never the SQL endpoint, never a webhook route, never a
 * write. Zite allows 30 requests a second per database, so the fetcher paces
 * itself under that; a rate-limited answer names no wait, so it waits a second.
 * Zite workflows are code in the app's repository, not database content, so
 * nothing here reads them.
 */

import { Cause, Effect } from 'effect'
import { arrayOf, isRecord } from '@/domain/kernel/config-parsing/plain-object'
import { fetchSourceJson, type ImportFetchError } from './import-fetch-client'
import {
  heldOrFetched,
  fetchAttachment,
  type FetchContext,
  type FetchSummary,
} from './import-fetch-sink'

/** How Zite is reached, given the operator's API key. */
export const ziteTarget = (token: string) => ({
  tool: 'zite',
  realBaseUrl: 'https://tables.zite.com',
  headers: { authorization: `Bearer ${token}` },
  lockoutSeconds: 1,
  minIntervalMs: 40,
})

/** Why what follows `zite:` is not a database id, or `undefined`. */
export const refuseZiteSource = (id: string): string | undefined =>
  /^[A-Za-z0-9_-]{1,64}$/.test(id)
    ? undefined
    : `"zite:${id}" does not name a Zite database. Write it zite:<databaseId>, the id in the database's URL.`

/** Records per page: the API's cap. */
const PAGE_SIZE = 2000

const API = '/api/v1/bases'

/** Every attachment of a records page: `{ url, filename }` items in a record's `data`. */
const attachmentsOf = (page: unknown) =>
  arrayOf(isRecord(page) ? page['records'] : undefined).flatMap((record) =>
    Object.values(isRecord(record) && isRecord(record['data']) ? record['data'] : {}).flatMap(
      (cell) =>
        arrayOf(cell).flatMap((item) =>
          isRecord(item) && typeof item['url'] === 'string' && URL.canParse(item['url'])
            ? [
                {
                  source: item['url'],
                  url: item['url'],
                  filename:
                    typeof item['filename'] === 'string' && item['filename'] !== ''
                      ? item['filename']
                      : (new URL(item['url']).pathname.split('/').at(-1) ?? 'file'),
                },
              ]
            : []
        )
    )
  )

/**
 * Download one attachment; a link that cannot be fetched is recorded as
 * skipped, because Zite's link lifetime is unknown and a dead link must not
 * hold the rest of the database back.
 */
const fetchZiteAttachment = (
  context: FetchContext,
  attachment: { readonly source: string; readonly url: string; readonly filename: string }
): Effect.Effect<void, ImportFetchError> =>
  fetchAttachment(context, attachment).pipe(
    Effect.tapCause((cause) =>
      Effect.logWarning('import.fetch-zite: an attachment could not be downloaded', {
        // The host only: a link's path may itself be a signed credential.
        host: URL.parse(attachment.url)?.host ?? '',
        cause: String(Cause.squash(cause)),
      })
    ),
    // Swallowed on purpose, download failures only (a snapshot write failure is
    // not resumable and still stops the fetch): the attachment is counted as
    // skipped, and the record keeps its file name.
    Effect.catchIf(
      (error) => error.resumable,
      () =>
        context.sink.attachment({
          kind: 'skipped',
          source: attachment.source,
          filename: attachment.filename,
        })
    )
  )

const pageName = (page: number): string => `records-${String(page).padStart(4, '0')}.json`

/** Every records page of one table, from where a previous run stopped. */
const fetchRecords = (
  context: FetchContext,
  databaseId: string,
  tableId: string
): Effect.Effect<void, ImportFetchError> => {
  const resource = `tables/${tableId}/records`
  const previous = context.sink.cursorOf(resource)
  if (previous?.complete === true) return Effect.void
  const step = (pages: number, offset: number): Effect.Effect<void, ImportFetchError> =>
    fetchSourceJson(context.target, context.base, {
      method: 'POST',
      path: `${API}/${databaseId}/tables/${tableId}/records/list`,
      body: { offset, limit: PAGE_SIZE },
    }).pipe(
      Effect.tap((response) =>
        context.sink.writeRaw(`raw/tables/${tableId}/${pageName(pages + 1)}`, response.bytes)
      ),
      Effect.tap((response) =>
        Effect.forEach(
          attachmentsOf(response.json),
          (attachment) => fetchZiteAttachment(context, attachment),
          { discard: true }
        )
      ),
      Effect.flatMap((response) => {
        const page = isRecord(response.json) ? response.json : {}
        const served = arrayOf(page['records']).length
        const complete = page['hasMore'] !== true || served === 0
        const next = offset + served
        return context.sink
          .saveCursor({
            resource,
            pages: pages + 1,
            complete,
            ...(complete ? {} : { cursor: String(next) }),
          })
          .pipe(Effect.flatMap(() => (complete ? Effect.void : step(pages + 1, next))))
      })
    )
  return step(previous?.pages ?? 0, Number(previous?.cursor ?? 0))
}

/** Fetch one Zite database into the snapshot. */
export const fetchZiteDatabase = (
  context: FetchContext,
  databaseId: string
): Effect.Effect<FetchSummary, ImportFetchError> =>
  Effect.gen(function* () {
    const database = yield* heldOrFetched(context, 'raw/database.json', `${API}/${databaseId}`)
    const tableIds = arrayOf(isRecord(database) ? database['tables'] : undefined).flatMap(
      (table) => (isRecord(table) && typeof table['id'] === 'string' ? [table['id']] : [])
    )
    yield* Effect.forEach(
      tableIds,
      (tableId) =>
        heldOrFetched(
          context,
          `raw/tables/${tableId}/fields.json`,
          `${API}/${databaseId}/tables/${tableId}/fields`
        ).pipe(
          Effect.flatMap(() =>
            context.domains.includes('data')
              ? fetchRecords(context, databaseId, tableId)
              : Effect.void
          )
        ),
      { discard: true }
    )
    return { ids: [databaseId, ...tableIds], apiVersion: 'v1' }
  }).pipe(Effect.withSpan('import.fetch-zite-database'))
