/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The JSON-RPC 2.0 framing of the MCP Streamable HTTP transport, at the
 * protocol revision {@link MCP_PROTOCOL_VERSION}: the request bodies the client
 * sends and the reading of what a server answers. No I/O.
 *
 * A server answers a request either with `application/json` (one JSON-RPC
 * message) or with `text/event-stream`, whose `data:` events carry JSON-RPC
 * messages — possibly server requests and notifications before the response.
 * Either way the client looks for the RESPONSE with the id it sent.
 */

/** The protocol revision this client asks for. */
export const MCP_PROTOCOL_VERSION = '2025-06-18'

/** The `clientInfo` sent on `initialize`. */
export const MCP_CLIENT_INFO = { name: 'sovrium', version: '1' } as const

export interface JsonRpcRequest {
  readonly jsonrpc: '2.0'
  readonly id?: number
  readonly method: string
  readonly params?: Readonly<Record<string, unknown>>
}

export const rpcRequest = (
  id: number,
  method: string,
  params?: Readonly<Record<string, unknown>>
): JsonRpcRequest => ({ jsonrpc: '2.0', id, method, ...(params !== undefined && { params }) })

export const rpcNotification = (method: string): JsonRpcRequest => ({ jsonrpc: '2.0', method })

/**
 * The `initialize` params. `elicitation` declares the client capability in
 * form mode only (`{ form: {} }`): a server may then ask a question during a
 * tool call. URL mode is never declared — the client never sends a person to a
 * server's address.
 */
export const initializeParams = (
  options: { readonly elicitation?: boolean } = {}
): Readonly<Record<string, unknown>> => ({
  protocolVersion: MCP_PROTOCOL_VERSION,
  capabilities: options.elicitation === true ? { elicitation: { form: {} } } : {},
  clientInfo: MCP_CLIENT_INFO,
})

/** What a response carried: a result, or the server's JSON-RPC error. */
export type RpcOutcome =
  | { readonly kind: 'result'; readonly result: Readonly<Record<string, unknown>> }
  | { readonly kind: 'error'; readonly message: string }
  /** No response with that id: the body was not JSON-RPC. */
  | { readonly kind: 'malformed'; readonly message: string }

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

/** The JSON payload of one event's `data:` fields, or `undefined` for an event with none. */
const eventData = (event: string): string =>
  event
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).replace(/^ /, ''))
    .join('\n')

/** The JSON payloads of the `data:` fields of an event stream, one per event. */
const eventStreamMessages = (body: string): readonly unknown[] =>
  body
    .replace(/\r\n?/g, '\n')
    .split('\n\n')
    .map(eventData)
    .filter((data) => data.length > 0)
    .map(parseJson)

/**
 * An event-stream reader fed one chunk of text at a time, as the body arrives:
 * each call returns the messages of the events the chunk completed, and keeps
 * the incomplete tail for the next one. `end` reads what is left.
 *
 * Linear in the bytes read, whatever the chunking: a chunk is normalised and
 * searched for an event boundary on its own (plus the one character before
 * it), and the tail is read only when an event completes. A server trickling
 * one event in tiny chunks would otherwise cost a scan of everything held per
 * chunk, and hold the event loop for minutes within the body cap. A `\r` that
 * ends a chunk waits for the next one, so a `\r\n` split across two chunks is
 * one line break, never an event boundary.
 */
export const createEventStreamReader = (): {
  readonly feed: (chunk: string) => readonly unknown[]
  readonly end: () => readonly unknown[]
} => {
  let held = ''
  let last = ''
  let carriedReturn = false
  return {
    feed: (chunk) => {
      const raw = (carriedReturn ? '\r' : '') + chunk
      carriedReturn = raw.endsWith('\r')
      const text = (carriedReturn ? raw.slice(0, -1) : raw).replace(/\r\n?/g, '\n')
      if (text.length === 0) return []
      const before = last
      const found = (before + text).lastIndexOf('\n\n')
      // Never reading `held` until an event completes keeps it a cheap concatenation.
      const cut = held.length - before.length + found
      held += text
      last = text.charAt(text.length - 1)
      if (found < 0) return []
      const complete = held.slice(0, cut)
      held = held.slice(cut + 2)
      last = held.charAt(held.length - 1)
      return eventStreamMessages(complete)
    },
    end: () => {
      const rest = held + (carriedReturn ? '\n' : '')
      held = ''
      last = ''
      carriedReturn = false
      return eventStreamMessages(rest)
    },
  }
}

/** The JSON-RPC messages of a whole answer, `application/json` or an event stream. */
export const messagesOf = (contentType: string, body: string): readonly unknown[] => {
  if (contentType.toLowerCase().includes('text/event-stream')) return eventStreamMessages(body)
  const parsed = parseJson(body)
  return Array.isArray(parsed) ? parsed : [parsed]
}

/** Whether `message` is the RESPONSE to request `id` (not a server request sharing the id). */
export const isResponseTo = (message: unknown, id: number): boolean =>
  isRecord(message) &&
  message['id'] === id &&
  message['method'] === undefined &&
  ('result' in message || 'error' in message)

/** What one JSON-RPC response carried; anything else is malformed. */
export const readResponseMessage = (response: unknown): RpcOutcome => {
  if (!isRecord(response)) {
    return { kind: 'malformed', message: 'the server did not answer with a JSON-RPC response' }
  }
  if (isRecord(response['error'])) {
    const text = response['error']['message']
    return {
      kind: 'error',
      message: `the server answered a JSON-RPC error${typeof text === 'string' ? `: ${text.slice(0, 200)}` : ''}`,
    }
  }
  return isRecord(response['result'])
    ? { kind: 'result', result: response['result'] }
    : { kind: 'malformed', message: 'the server answered a JSON-RPC response with no result' }
}

/** Read the response to request `id` out of a server's answer. */
export const readRpcResponse = (contentType: string, body: string, id: number): RpcOutcome =>
  readResponseMessage(messagesOf(contentType, body).find((message) => isResponseTo(message, id)))

/** A request the SERVER sent the client, on the stream of one of the client's requests. */
export interface ServerRequest {
  readonly id: string | number
  readonly method: string
  readonly params: Readonly<Record<string, unknown>>
}

/** `message` as a server request (an id AND a method), or `undefined`. */
export const readServerRequest = (message: unknown): ServerRequest | undefined => {
  if (!isRecord(message) || typeof message['method'] !== 'string') return undefined
  const { id } = message
  if (typeof id !== 'string' && typeof id !== 'number') return undefined
  return {
    id,
    method: message['method'],
    params: isRecord(message['params']) ? message['params'] : {},
  }
}

/** The client's JSON-RPC response to a server request: a result, or an error. */
export const rpcReply = (
  id: string | number,
  reply:
    | { readonly result: Readonly<Record<string, unknown>> }
    | { readonly error: { readonly code: number; readonly message: string } }
): Readonly<Record<string, unknown>> => ({ jsonrpc: '2.0', id, ...reply })

/** One tool of a `tools/list` result, before it is attributed to a server. */
export interface ListedTool {
  readonly name: string
  readonly description: string
  readonly inputSchema: Readonly<Record<string, unknown>>
  readonly readOnly: boolean
}

/** The tools of one `tools/list` page, and the cursor of the next one. */
export const readToolsPage = (
  result: Readonly<Record<string, unknown>>
): { readonly tools: readonly ListedTool[]; readonly nextCursor: string | undefined } => {
  const tools = Array.isArray(result['tools']) ? result['tools'] : []
  const cursor = result['nextCursor']
  return {
    tools: tools.flatMap((tool): readonly ListedTool[] => {
      if (!isRecord(tool) || typeof tool['name'] !== 'string' || tool['name'] === '') return []
      const annotations = isRecord(tool['annotations']) ? tool['annotations'] : {}
      return [
        {
          name: tool['name'],
          description: typeof tool['description'] === 'string' ? tool['description'] : '',
          inputSchema: isRecord(tool['inputSchema'])
            ? tool['inputSchema']
            : { type: 'object', properties: {} },
          // Only an explicit `true` counts: a hint from an untrusted server is
          // read conservatively, so anything else means "may write".
          readOnly: annotations['readOnlyHint'] === true,
        },
      ]
    }),
    nextCursor: typeof cursor === 'string' && cursor !== '' ? cursor : undefined,
  }
}

/** The text of a `tools/call` result: its text parts, joined; other parts named. */
export const readToolCallResult = (
  result: Readonly<Record<string, unknown>>
): { readonly text: string; readonly isError: boolean } => {
  const content = Array.isArray(result['content']) ? result['content'] : []
  const parts = content.map((part) => {
    if (!isRecord(part)) return ''
    if (part['type'] === 'text' && typeof part['text'] === 'string') return part['text']
    return `[${typeof part['type'] === 'string' ? part['type'] : 'unknown'} content omitted]`
  })
  const structured = result['structuredContent']
  const text =
    parts.length > 0 ? parts.join('\n') : isRecord(structured) ? JSON.stringify(structured) : ''
  return { text, isError: result['isError'] === true }
}
