/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  initializeParams,
  MCP_PROTOCOL_VERSION,
  readRpcResponse,
  readToolsPage,
  rpcNotification,
  rpcRequest,
  type JsonRpcRequest,
  type ListedTool,
} from './mcp-json-rpc'
import { checkMcpServerAddress, type ResolveHost } from './mcp-outbound-guard'
import type { McpHttpFailure, McpHttpOpen, McpHttpPost, McpHttpResponse } from './mcp-http'
import type { McpServerState } from '@/application/ports/services/mcp-client'
import type { McpClientServerConfig } from '@/domain/models/process-env/mcp-client'

/**
 * One MCP session with one declared server: the handshake that opens it (the
 * `tools/call` that uses it is `mcp-tool-call.ts`).
 *
 * Handshake, in protocol order: `initialize` (declaring the `elicitation`
 * capability, form mode only, when the client may relay a server's question,
 * and keeping the `Mcp-Session-Id` the server issues), the
 * `notifications/initialized` notification, then `tools/list`, following `nextCursor` for at most {@link MAX_LIST_PAGES} pages.
 * Every request carries the server's credential and, once negotiated, the
 * `MCP-Protocol-Version` header; each is bounded by the client timeout.
 *
 * Every reason this module produces is written here, never copied from a
 * header, and is passed through {@link redact} before it leaves: a server that
 * echoes the credential back in an error cannot route it into a status page.
 */

/** An open session. */
export interface McpSession {
  readonly sessionId: string | undefined
  readonly protocolVersion: string
  readonly tools: readonly ListedTool[]
}

/** How one connection attempt ended. */
export type ConnectOutcome =
  | { readonly state: 'connected'; readonly session: McpSession }
  | { readonly state: Exclude<McpServerState, 'connected'>; readonly reason: string }

/** Everything a session needs, injected so a test can stand in for the network. */
export interface SessionDeps {
  readonly post: McpHttpPost
  /** The streamed transport of a `tools/call`; absent, it is read whole through `post`. */
  readonly open?: McpHttpOpen
  /** Whether the client declares the `elicitation` capability (form mode) on `initialize`. */
  readonly elicitation?: boolean
  readonly timeoutMs: number
  /** A fresh JSON-RPC id per request. */
  readonly nextId: () => number
  readonly resolve?: ResolveHost
}

const MAX_LIST_PAGES = 10

/** Replace every credential in `text` — a server may echo what it was sent. */
export const redact = (text: string, server: McpClientServerConfig): string =>
  server.token === undefined || server.token === ''
    ? text
    : text.replaceAll(server.token, '[redacted]')

/** The credential header of `server`, if it has one. */
export const authHeaders = (server: McpClientServerConfig): Readonly<Record<string, string>> => {
  if (server.token === undefined) return {}
  if (server.authType === 'bearer') return { Authorization: `Bearer ${server.token}` }
  if (server.authType === 'header' && server.headerName !== undefined) {
    return { [server.headerName]: server.token }
  }
  return {}
}

export const headersFor = (
  server: McpClientServerConfig,
  session: Pick<McpSession, 'sessionId' | 'protocolVersion'> | undefined
): Readonly<Record<string, string>> => ({
  'Content-Type': 'application/json',
  Accept: 'application/json, text/event-stream',
  ...(session !== undefined && { 'MCP-Protocol-Version': session.protocolVersion }),
  ...(session?.sessionId !== undefined && { 'Mcp-Session-Id': session.sessionId }),
  ...authHeaders(server),
})

/** A request that failed before a JSON-RPC answer was read. */
export interface Failed {
  readonly state: 'unavailable' | 'error'
  readonly reason: string
  readonly kind: McpHttpFailure['kind'] | 'status'
  readonly status?: number
}

export const fromHttpFailure = (failure: McpHttpFailure): Failed => ({
  state: failure.kind === 'network' || failure.kind === 'timeout' ? 'unavailable' : 'error',
  reason: failure.message,
  kind: failure.kind,
})

const send = (
  deps: SessionDeps,
  server: McpClientServerConfig,
  session: Pick<McpSession, 'sessionId' | 'protocolVersion'> | undefined,
  message: JsonRpcRequest
): Effect.Effect<McpHttpResponse, Failed> =>
  deps
    .post({
      url: server.url,
      headers: headersFor(server, session),
      body: JSON.stringify(message),
      timeoutMs: deps.timeoutMs,
    })
    .pipe(
      Effect.mapError(fromHttpFailure),
      Effect.filterOrElse(
        (response) => response.status >= 200 && response.status < 300,
        (response) =>
          Effect.fail<Failed>({
            state: 'error',
            reason: `the server answered HTTP ${response.status}`,
            kind: 'status',
            status: response.status,
          })
      )
    )

/** One server, as a request to it needs it: the transport, the server, its session. */
interface Peer {
  readonly deps: SessionDeps
  readonly server: McpClientServerConfig
  readonly session?: Pick<McpSession, 'sessionId' | 'protocolVersion'>
}

/** Send request `method` and read its result. */
const call = (
  peer: Peer,
  method: string,
  params?: Readonly<Record<string, unknown>>
): Effect.Effect<
  { readonly response: McpHttpResponse; readonly result: Readonly<Record<string, unknown>> },
  Failed
> => {
  const id = peer.deps.nextId()
  return send(peer.deps, peer.server, peer.session, rpcRequest(id, method, params)).pipe(
    Effect.flatMap((response) => {
      const outcome = readRpcResponse(response.contentType, response.body, id)
      return outcome.kind === 'result'
        ? Effect.succeed({ response, result: outcome.result })
        : Effect.fail<Failed>({ state: 'error', reason: outcome.message, kind: 'status' })
    })
  )
}

const listTools = (
  peer: Peer,
  cursor: string | undefined,
  page: number
): Effect.Effect<readonly ListedTool[], Failed> =>
  call(peer, 'tools/list', cursor === undefined ? undefined : { cursor }).pipe(
    Effect.flatMap(({ result }) => {
      const { tools, nextCursor } = readToolsPage(result)
      return nextCursor === undefined || page >= MAX_LIST_PAGES
        ? Effect.succeed(tools)
        : listTools(peer, nextCursor, page + 1).pipe(Effect.map((rest) => [...tools, ...rest]))
    })
  )

const handshake = (
  deps: SessionDeps,
  server: McpClientServerConfig
): Effect.Effect<McpSession, Failed> =>
  Effect.gen(function* () {
    const { response, result } = yield* call(
      { deps, server },
      'initialize',
      initializeParams({ elicitation: deps.elicitation === true })
    )
    const negotiated = result['protocolVersion']
    const opened = {
      sessionId: response.sessionId,
      protocolVersion: typeof negotiated === 'string' ? negotiated : MCP_PROTOCOL_VERSION,
    }
    yield* send(deps, server, opened, rpcNotification('notifications/initialized'))
    const tools = yield* listTools({ deps, server, session: opened }, undefined, 1)
    return { ...opened, tools }
  })

/**
 * Open a session with `server`: the outbound guard first (nothing is sent to a
 * refused address), then the handshake. Never fails: every ending is an outcome.
 */
export const connectMcpServer = (
  deps: SessionDeps,
  server: McpClientServerConfig
): Effect.Effect<ConnectOutcome> =>
  checkMcpServerAddress(server.url, deps.resolve).pipe(
    Effect.flatMap((verdict) => {
      if (!verdict.ok) {
        return Effect.succeed<ConnectOutcome>({
          state: verdict.refused ? 'refused' : 'unavailable',
          reason: verdict.reason,
        })
      }
      return handshake(deps, server).pipe(
        Effect.map((session): ConnectOutcome => ({ state: 'connected', session })),
        Effect.catch((failed) =>
          Effect.succeed<ConnectOutcome>({
            state: failed.state,
            reason: redact(failed.reason, server),
          })
        )
      )
    })
  )
