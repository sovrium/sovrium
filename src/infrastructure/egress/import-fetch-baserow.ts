/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The Baserow fetcher: the tables of one database, read through the REST API
 * of Baserow Cloud or of the self-hosted instance the source URI names
 * (pinned under `[internal ref]`).
 *
 * ```
 * baserow:<instance URL>#<database id>     baserow:https://api.baserow.io#598437
 * ```
 *
 * - **Read-only, with a database token** (`Authorization: Token …`), the only
 *   credential a Baserow user can mint for the API: `GET` on the table list,
 *   then each table's fields and its rows, `user_field_names=true`, 200 rows
 *   a page. Nothing else: a database token cannot read views or automations,
 *   which the workspace export ZIP carries instead.
 * - **The instance is the one the operator named**, over HTTPS (plain HTTP is
 *   accepted for a loopback host only, since the token travels with every
 *   request). A URL holding a user name, a password, a query or a fragment
 *   other than the database id is refused.
 * - **Pages are built, never followed.** Baserow's `next` link can be an
 *   `http://` URL even on HTTPS (Cloud does this), and following it would send
 *   the token in clear; the fetcher asks for page n+1 itself.
 * - **Files** are downloaded during the fetch, from the instance's own host
 *   or from the storage it serves files from; self-hosted URLs carry no
 *   expiry, Cloud's do not either, but a download now keeps the snapshot
 *   whole on its own.
 *
 * Baserow Cloud refuses an 11th concurrent request with a `429` and no
 * `Retry-After`: requests here go one at a time, and a `429` is waited out.
 */

import { Effect } from 'effect'
import { arrayOf, isRecord } from '@/domain/kernel/config-parsing/plain-object'
import {
  BASEROW_TABLES_PATH,
  baserowFieldsPath,
  baserowRowsPath,
} from '@/domain/models/import/baserow-rest-adapter-service'
import { fetchSourceJson, type ImportFetchError } from './import-fetch-client'
import {
  heldOrFetched,
  fetchAttachment,
  type FetchContext,
  type FetchSummary,
} from './import-fetch-sink'

/** Rows per page: Baserow's default maximum. */
const PAGE_SIZE = '200'

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]', '::1'])

/** A parsed `baserow:` address: the instance's base URL and the database id. */
export interface BaserowAddress {
  readonly baseUrl: string
  readonly databaseId: string
}

/** Why an instance URL is refused, or `undefined`: credentials or a query, or plain http off loopback. */
const urlRefusal = (url: URL): string | undefined => {
  if (url.username !== '' || url.password !== '' || url.search !== '') {
    return 'The Baserow URL may not carry a user name, a password or a query: the token is read from the environment.'
  }
  const secure =
    url.protocol === 'https:' || (url.protocol === 'http:' && LOOPBACK.has(url.hostname))
  return secure
    ? undefined
    : 'The Baserow URL must use https (plain http is accepted for a loopback host only).'
}

/**
 * Read `<instance URL>#<database id>`, or say why it is refused. The reason
 * never repeats the URL: an operator may have pasted one holding a secret.
 */
export const parseBaserowAddress = (
  address: string
):
  | { readonly ok: true; readonly address: BaserowAddress }
  | { readonly ok: false; readonly reason: string } => {
  const hash = address.lastIndexOf('#')
  const databaseId = hash === -1 ? '' : address.slice(hash + 1)
  const url = hash === -1 ? undefined : URL.parse(address.slice(0, hash))
  if (url === null || url === undefined || !/^\d+$/.test(databaseId)) {
    return {
      ok: false,
      reason:
        'A Baserow source is baserow:<instance URL>#<database id>, e.g. baserow:https://api.baserow.io#123.',
    }
  }
  const refusal = urlRefusal(url)
  if (refusal !== undefined) return { ok: false, reason: refusal }
  return {
    ok: true,
    address: { baseUrl: `${url.origin}${url.pathname.replace(/\/+$/, '')}`, databaseId },
  }
}

/** How Baserow is reached, given the operator's token and the address. */
export const baserowTarget = (token: string, address: string) => {
  const parsed = parseBaserowAddress(address)
  return {
    tool: 'baserow',
    realBaseUrl: parsed.ok ? parsed.address.baseUrl : 'https://api.baserow.io',
    headers: { authorization: `Token ${token}` },
    lockoutSeconds: 5,
  }
}

/** Every file of a rows page: `{ url, name, visible_name }` inside a cell list. */
const filesOf = (page: unknown) =>
  arrayOf(isRecord(page) ? page['results'] : undefined).flatMap((row) =>
    Object.values(isRecord(row) ? row : {}).flatMap((cell) =>
      arrayOf(cell).flatMap((item) =>
        isRecord(item) && typeof item['url'] === 'string' && typeof item['name'] === 'string'
          ? [
              {
                source: item['name'],
                url: item['url'],
                filename:
                  typeof item['visible_name'] === 'string' ? item['visible_name'] : item['name'],
              },
            ]
          : []
      )
    )
  )

/** Every rows page of one table, from where a previous run stopped. */
const fetchRows = (
  context: FetchContext,
  tableId: string
): Effect.Effect<void, ImportFetchError> => {
  const resource = `tables/${tableId}/rows`
  const previous = context.sink.cursorOf(resource)
  if (previous?.complete === true) return Effect.void
  const step = (pages: number): Effect.Effect<void, ImportFetchError> =>
    fetchSourceJson(context.target, context.base, {
      method: 'GET',
      path: `/api/database/rows/table/${tableId}/`,
      query: { user_field_names: 'true', size: PAGE_SIZE, page: String(pages + 1) },
    }).pipe(
      Effect.tap((response) =>
        context.sink.writeRaw(baserowRowsPath(tableId, pages + 1), response.bytes)
      ),
      Effect.tap((response) =>
        Effect.forEach(filesOf(response.json), (file) => fetchAttachment(context, file), {
          discard: true,
        })
      ),
      Effect.flatMap((response) => {
        const more = isRecord(response.json) && typeof response.json['next'] === 'string'
        return context.sink
          .saveCursor({
            resource,
            pages: pages + 1,
            complete: !more,
            ...(more ? { cursor: String(pages + 2) } : {}),
          })
          .pipe(Effect.flatMap(() => (more ? step(pages + 1) : Effect.void)))
      })
    )
  return step(previous?.pages ?? 0)
}

/** Fetch one Baserow database into the snapshot. */
export const fetchBaserowDatabase = (
  context: FetchContext,
  address: string
): Effect.Effect<FetchSummary, ImportFetchError> =>
  Effect.gen(function* () {
    const parsed = parseBaserowAddress(address)
    const databaseId = parsed.ok ? parsed.address.databaseId : ''
    const listed = yield* heldOrFetched(
      context,
      BASEROW_TABLES_PATH,
      '/api/database/tables/all-tables/'
    )
    const tableIds = arrayOf(listed)
      .filter(isRecord)
      .filter((table) => String(table['database_id']) === databaseId)
      .map((table) => String(table['id']))
    yield* Effect.forEach(
      tableIds,
      (tableId) =>
        heldOrFetched(
          context,
          baserowFieldsPath(tableId),
          `/api/database/fields/table/${tableId}/`
        ),
      { discard: true }
    )
    if (context.domains.includes('data')) {
      yield* Effect.forEach(tableIds, (tableId) => fetchRows(context, tableId), { discard: true })
    }
    return { ids: [databaseId, ...tableIds] }
  }).pipe(Effect.withSpan('import.fetch-baserow-database'))
