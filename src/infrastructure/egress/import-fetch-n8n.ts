/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The n8n fetcher: every workflow of one instance, n8n Cloud or self-hosted,
 * read through its public API v1 (pinned under
 * `[internal ref]`).
 *
 * ```
 * n8n:<instance URL>      n8n:https://acme.app.n8n.cloud    n8n:acme.app.n8n.cloud
 * ```
 *
 * - `GET /api/v1/workflows?limit=250` page by page, the `nextCursor` each page
 *   names as the next one's `cursor`, until it is `null`
 *   (`raw/workflows/page-0001.json`, …). The list carries every workflow's
 *   nodes and connections, so it is usually all the fetch reads.
 * - `GET /api/v1/workflows/{id}` only for a workflow the list served without
 *   its nodes (`raw/workflows/<id>.json`).
 * - `excludePinnedData=true` on both: pinned data is sample run data, which a
 *   definition does not need and which may hold real records.
 *
 * Only `GET` is sent, with the API key as `X-N8N-API-KEY`. A workflow holds
 * credential NAMES only, never their secrets; the credentials endpoints and
 * the CLI's decrypted export are never used. Archived and inactive
 * workflows are read like the others.
 *
 * The instance must be reached over HTTPS (plain HTTP on a loopback host
 * only), on a public host: a private or link-local address is refused unless
 * the operator opted out of that guard for the whole instance. A URL holding a
 * user name, a password, a query or a fragment is refused, and a refusal never
 * repeats the URL.
 */

import { Effect } from 'effect'
import { isRecord } from '@/domain/kernel/config-parsing/plain-object'
import { fetchSourceJson, type ImportFetchError } from './import-fetch-client'
import { heldOrFetched, type FetchContext, type FetchSummary } from './import-fetch-sink'
import { validateOutboundUrl } from './validate-outbound-url'

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]', '::1'])

/** Workflows per page: the API's maximum. */
const PAGE_SIZE = '250'

/** The API path every request sits under, which an instance URL may already end with. */
const API_PATH = '/api/v1'

const USAGE =
  'An n8n source is n8n:<instance URL>, e.g. n8n:https://acme.app.n8n.cloud or n8n:https://n8n.example.com.'

/** Why an instance URL is refused, or `undefined`. */
const urlRefusal = (url: URL): string | undefined => {
  if (url.username !== '' || url.password !== '' || url.search !== '' || url.hash !== '') {
    return 'The n8n URL may not carry a user name, a password, a query or a fragment: the API key is read from the environment.'
  }
  const loopback = LOOPBACK.has(url.hostname)
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) {
    return 'The n8n URL must use https (plain http is accepted for a loopback host only).'
  }
  return loopback || validateOutboundUrl(url.origin).ok
    ? undefined
    : 'The n8n URL names a private or link-local host, which the fetch does not reach. Use the instance’s public address, or allow private outbound requests for this machine (SOVRIUM_ALLOW_PRIVATE_OUTBOUND=1).'
}

/**
 * The base URL an `n8n:` address names, or why it is refused. A bare host is
 * read as `https://<host>`; a trailing `/api/v1` is dropped.
 */
export const parseN8nAddress = (
  address: string
):
  | { readonly ok: true; readonly baseUrl: string }
  | { readonly ok: false; readonly reason: string } => {
  const written = /^[a-z][a-z0-9+.-]*:\/\//i.test(address) ? address : `https://${address}`
  const url = address === '' ? null : URL.parse(written)
  if (url === null || url.hostname === '') return { ok: false, reason: USAGE }
  const refusal = urlRefusal(url)
  if (refusal !== undefined) return { ok: false, reason: refusal }
  const path = url.pathname.replace(/\/+$/, '')
  const base = path.endsWith(API_PATH) ? path.slice(0, -API_PATH.length) : path
  return { ok: true, baseUrl: `${url.origin}${base}` }
}

/** Why what follows `n8n:` is refused, or `undefined`. */
export const refuseN8nSource = (address: string): string | undefined => {
  const parsed = parseN8nAddress(address)
  return parsed.ok ? undefined : parsed.reason
}

/** How n8n is reached, given the operator's API key and the instance address. */
export const n8nTarget = (token: string, address: string) => {
  const parsed = parseN8nAddress(address)
  return {
    tool: 'n8n',
    realBaseUrl: parsed.ok ? parsed.baseUrl : 'https://invalid.invalid',
    headers: { 'x-n8n-api-key': token },
    lockoutSeconds: 60,
  }
}

type Json = Readonly<Record<string, unknown>>

const workflowsOf = (page: unknown): readonly Json[] =>
  (isRecord(page) && Array.isArray(page['data']) ? page['data'] : []).filter(isRecord)

/** The workflow ids a list page holds. */
const idsOf = (page: unknown): readonly string[] =>
  workflowsOf(page).flatMap((workflow) =>
    typeof workflow['id'] === 'string' ? [workflow['id']] : []
  )

/** The ids of the workflows a list page served without their nodes. */
const withoutNodesOf = (page: unknown): readonly string[] =>
  workflowsOf(page).flatMap((workflow) =>
    typeof workflow['id'] === 'string' && !Array.isArray(workflow['nodes']) ? [workflow['id']] : []
  )

/** The cursor of the next page, or `undefined` on the last one. */
const nextCursorOf = (page: unknown): string | undefined => {
  const next = isRecord(page) ? page['nextCursor'] : undefined
  return typeof next === 'string' && next !== '' ? next : undefined
}

const pagePath = (page: number): string =>
  `raw/workflows/page-${String(page).padStart(4, '0')}.json`

const RESOURCE = 'workflows'

/** The list pages a previous run already wrote. */
const heldPages = (
  context: FetchContext,
  pages: number
): Effect.Effect<readonly unknown[], ImportFetchError> =>
  Effect.forEach(
    Array.from({ length: pages }, (_unused, index) => pagePath(index + 1)),
    (path) => context.sink.readRaw(path)
  )

/** One list page, at `cursor` when it is not the first. */
const listPage = (context: FetchContext, cursor: string | undefined) =>
  fetchSourceJson(context.target, context.base, {
    method: 'GET',
    path: `${API_PATH}/workflows`,
    query: {
      limit: PAGE_SIZE,
      excludePinnedData: 'true',
      ...(cursor === undefined ? {} : { cursor }),
    },
  })

/** Every list page of the instance, from where a previous run stopped. */
const listWorkflows = (
  context: FetchContext
): Effect.Effect<readonly unknown[], ImportFetchError> => {
  const previous = context.sink.cursorOf(RESOURCE)
  const step = (
    pages: number,
    cursor: string | undefined,
    held: readonly unknown[]
  ): Effect.Effect<readonly unknown[], ImportFetchError> =>
    listPage(context, cursor).pipe(
      Effect.tap((response) => context.sink.writeRaw(pagePath(pages + 1), response.bytes)),
      Effect.flatMap((response) => {
        const found = [...held, response.json]
        const next = nextCursorOf(response.json)
        const complete = next === undefined || workflowsOf(response.json).length === 0
        return context.sink
          .saveCursor({
            resource: RESOURCE,
            pages: pages + 1,
            complete,
            ...(complete ? {} : { cursor: next }),
          })
          .pipe(
            Effect.flatMap(() => (complete ? Effect.succeed(found) : step(pages + 1, next, found)))
          )
      })
    )
  const pages = previous?.pages ?? 0
  const held = heldPages(context, pages)
  return previous?.complete === true
    ? held
    : held.pipe(Effect.flatMap((list) => step(pages, previous?.cursor, list)))
}

/** One workflow in full, unless a previous run already wrote it. */
const fetchWorkflow = (
  context: FetchContext,
  workflowId: string
): Effect.Effect<void, ImportFetchError> =>
  heldOrFetched(
    context,
    `raw/workflows/${workflowId}.json`,
    `${API_PATH}/workflows/${encodeURIComponent(workflowId)}`,
    { excludePinnedData: 'true' }
  ).pipe(Effect.asVoid)

/** Fetch every workflow of one n8n instance into the snapshot. */
export const fetchN8nInstance = (
  context: FetchContext,
  address: string
): Effect.Effect<FetchSummary, ImportFetchError> =>
  Effect.gen(function* () {
    const pages = yield* listWorkflows(context)
    yield* Effect.forEach(
      pages.flatMap(withoutNodesOf),
      (workflowId) => fetchWorkflow(context, workflowId),
      { discard: true }
    )
    const parsed = parseN8nAddress(address)
    return {
      ids: [parsed.ok ? new URL(parsed.baseUrl).host : '', ...pages.flatMap(idsOf)],
      apiVersion: 'v1',
    }
  }).pipe(Effect.withSpan('import.fetch-n8n-instance'))
