/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { RecordsClient, TableClient, ViewRecordsClient } from '@/presentation/api/client'

/**
 * The RPC clients the islands read the records API through.
 *
 * The TYPES are Hono's (`@/presentation/api/client` names what `hc<T>()`
 * returns for each route area); the runtime is this path-collecting proxy,
 * which sends the request `hono/client` sends for the subset the islands use —
 * `param`, `query` and `json` on a `$<method>` call. It replaces `hono/client`
 * itself, which brought ~4.9 KB into the mount cost of every island that reads
 * records: its request class, its URL helpers, and the cookie serializer for
 * an `args.cookie` no island passes. `rpc-client.test.ts` pins every call
 * shape the islands make to the request the real library sends.
 */

/** The request arguments the islands pass: path params, a query, a JSON body. */
interface RpcArgs {
  readonly param?: Readonly<Record<string, string | undefined>>
  readonly query?: Readonly<Record<string, string | readonly string[] | undefined>>
  readonly json?: unknown
}

/** A route segment's param name: `:tableId`, `:tableId{[0-9]+}` and `:tableId?` all name `tableId`. */
const paramName = (segment: string): string | undefined =>
  segment.startsWith(':') ? segment.slice(1).replace(/\{[^/]+\}$|\?$/, '') : undefined

/**
 * Substitute path params as `hono/client` does: the value inserted as given,
 * an empty one dropping its segment, an unnamed one leaving the segment as is.
 */
const substituteParams = (
  segments: readonly string[],
  params: Readonly<Record<string, string | undefined>>
): readonly string[] =>
  segments.flatMap((segment) => {
    const name = paramName(segment)
    if (name === undefined || !Object.hasOwn(params, name)) return [segment]
    const value = params[name]
    return value ? [value] : []
  })

/** A query as `hono/client`'s `buildSearchParams` writes it: arrays repeated, `undefined` skipped. */
const toSearchParams = (
  query: Readonly<Record<string, string | readonly string[] | undefined>>
): URLSearchParams =>
  new URLSearchParams(
    Object.entries(query).flatMap(([key, value]) =>
      value === undefined
        ? []
        : typeof value === 'string'
          ? [[key, value]]
          : value.flatMap((item) => (item === undefined ? [] : [[key, item]]))
    )
  )

/** The request URL: the base, the substituted path, and the query when it has one. */
const buildRequestUrl = (
  baseUrl: string,
  segments: readonly string[],
  args: RpcArgs | undefined
): string => {
  const path = substituteParams(segments, args?.param ?? {}).join('/')
  const url = `${baseUrl.replace(/\/+$/, '')}/${path}`
  const search = args?.query === undefined ? '' : toSearchParams(args.query).toString()
  return search === '' ? url : `${url}?${search}`
}

/** Send one `$<method>(args)` call; a JSON body and its content type go on every method but GET and HEAD. */
const sendRpcRequest = (
  baseUrl: string,
  segments: readonly string[],
  method: string,
  args: RpcArgs | undefined
): Promise<Response> => {
  const hasBody = method !== 'GET' && method !== 'HEAD' && args?.json !== undefined
  return fetch(buildRequestUrl(baseUrl, segments, args), {
    body: hasBody ? JSON.stringify(args.json) : undefined,
    method,
    headers: new Headers(hasBody ? { 'Content-Type': 'application/json' } : undefined),
  })
}

/**
 * Property reads append a segment; calling the last one, a `$<method>`,
 * sends the request. `then` reads as absent so a client is never a thenable.
 */
const createRpcProxy = (baseUrl: string, segments: readonly string[]): unknown =>
  new Proxy(() => undefined, {
    get: (_target, key) =>
      typeof key !== 'string' || key === 'then'
        ? undefined
        : createRpcProxy(baseUrl, [...segments, key]),
    apply: (_target, _this, args: readonly unknown[]) =>
      sendRpcRequest(
        baseUrl,
        segments.slice(0, -1),
        (segments.at(-1) ?? '').replace(/^\$/, '').toUpperCase(),
        args[0] as RpcArgs | undefined
      ),
  })

/**
 * A typed RPC client for table record operations.
 *
 * @example
 * ```typescript
 * const client = createRecordsClient(window.location.origin)
 * const res = await client.api.tables[':tableId'].records.$get({
 *   param: { tableId: 'my-table' },
 *   query: { page: '1', limit: '25' },
 * })
 * ```
 */
export const createRecordsClient = (baseUrl: string): RecordsClient =>
  createRpcProxy(baseUrl, []) as RecordsClient

/**
 * A typed RPC client for table-level operations (list, get, permissions).
 *
 * @example
 * ```typescript
 * const client = createTableClient(window.location.origin)
 * const res = await client.api.tables[':tableId'].permissions.$get({
 *   param: { tableId: 'my-table' },
 * })
 * ```
 */
export const createTableClient = (baseUrl: string): TableClient =>
  createRpcProxy(baseUrl, []) as TableClient

/**
 * A typed RPC client for reading through a table's declared views.
 *
 * @example
 * ```typescript
 * const client = createViewRecordsClient(window.location.origin)
 * const res = await client.api.tables[':tableId'].views[':viewId'].records.$get({
 *   param: { tableId: 'campaigns', viewId: 'open_campaigns' },
 *   query: { page: '1', limit: '25' },
 * })
 * ```
 */
export const createViewRecordsClient = (baseUrl: string): ViewRecordsClient =>
  createRpcProxy(baseUrl, []) as ViewRecordsClient
