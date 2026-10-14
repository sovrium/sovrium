/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { McpToolDescriptor } from '@/domain/models/app/agents/mcp-tool-service'
import type { McpClientAuthType } from '@/domain/models/process-env/mcp-client'
import type { Effect } from 'effect'

/**
 * The external MCP servers the operator declared, as this instance sees them:
 * a session per server over the Streamable HTTP transport, the tools each one
 * listed, and the calls to them.
 *
 * Servers come from the environment only (`MCP_CLIENT_SERVERS`); nothing here
 * adds one. Credentials stay inside the implementation: no value this port
 * returns carries one.
 */

/**
 * Where one declared server stands.
 *
 * - `connected`: the session is open; `toolCount` tools were listed.
 * - `unavailable`: it could not be reached (refused connection, DNS, timeout).
 * - `refused`: the outbound guard refused its address; nothing was sent.
 * - `error`: it answered, but not as an MCP server (a redirect, a non-2xx, a
 *   body that is not JSON-RPC, a JSON-RPC error).
 */
export type McpServerState = 'connected' | 'unavailable' | 'refused' | 'error'

/** One declared server, as the status route reports it. Never a credential. */
export interface McpServerStatus {
  readonly name: string
  /** The declared address, without any user-info part. */
  readonly url: string
  readonly authType: McpClientAuthType
  readonly headerName?: string
  readonly status: McpServerState
  /** How many tools it listed; present when `connected`. */
  readonly toolCount?: number
  /** Why it is not connected; present otherwise. */
  readonly reason?: string
}

/** Why a `tools/call` produced no result. */
export type McpToolCallFailure =
  /** The server is not declared, or did not list this tool. */
  | 'unknown-tool'
  /** The server is not connected (unreachable, refused or erroring). */
  | 'unavailable'
  /** The call outlasted `MCP_CLIENT_TIMEOUT` and was abandoned. */
  | 'timeout'
  /** The server answered, but not with a tool result. */
  | 'error'

export class McpToolCallError extends Data.TaggedError('McpToolCallError')<{
  readonly server: string
  readonly tool: string
  readonly reason: McpToolCallFailure
  /** Safe to show the model and the operator: never carries a credential. */
  readonly message: string
}> {}

/**
 * A tool's answer, as text from an UNTRUSTED source.
 *
 * `untrusted: true` is the contract with whoever hands it to a model: it is
 * data, to be quoted (`quoteUntrustedToolResult`), never spliced into a prompt
 * as instructions.
 */
export interface McpToolResult {
  readonly server: string
  readonly tool: string
  readonly untrusted: true
  /** The text parts of the result, joined. */
  readonly text: string
  /** The server's own `isError` flag: the tool ran and reported a failure. */
  readonly isError: boolean
}

/**
 * A question a server asked while it ran a tool (`elicitation/create`, form
 * mode): its words and its form, as the server sent them — untrusted, and
 * checked before anyone is shown them.
 */
export interface McpElicitationRequest {
  /** The declared name of the server asking. */
  readonly server: string
  readonly message: string
  readonly requestedSchema: unknown
}

/**
 * The client's answer to a server's question, sent as the JSON-RPC response to
 * it: the elicitation result (`accept` with the form's values, `decline`,
 * `cancel`), or a JSON-RPC error — `-32602` for a form that cannot be shown.
 */
export type McpElicitationReply =
  | { readonly action: 'accept'; readonly content: Readonly<Record<string, unknown>> }
  | { readonly action: 'decline' | 'cancel' }
  | { readonly error: { readonly code: number; readonly message: string } }

/**
 * What the caller does with a server's question: answer it at once, or
 * `'relay'` it to a person — the call then pauses on it (`asked`).
 */
export type McpElicitationPolicy = (request: McpElicitationRequest) => McpElicitationReply | 'relay'

/**
 * How a `tools/call` stands once it has to wait for nobody but the server: it
 * has its `result`, or it is paused on a question for a person (`asked`), and
 * `answer` sends her reply and finishes the call.
 *
 * A question nobody answers within the elicitation lifetime (one hour, as for
 * the agent's own `ask_user`) is answered `cancel` by the client and its
 * stream closed; `answer` then fails.
 */
export type McpToolCallOutcome =
  | { readonly kind: 'result'; readonly result: McpToolResult }
  | {
      readonly kind: 'asked'
      readonly question: McpElicitationRequest
      readonly answer: (
        reply: McpElicitationReply
      ) => Effect.Effect<McpToolResult, McpToolCallError>
    }

export class McpClient extends Context.Service<
  McpClient,
  {
    /** False when the operator declared no server (client mode off). */
    readonly enabled: boolean
    /**
     * Every declared server's state, in declaration order. Waits for a
     * connection attempt still in flight, which is itself bounded by
     * `MCP_CLIENT_TIMEOUT`.
     */
    readonly statuses: Effect.Effect<readonly McpServerStatus[]>
    /** The tools of every connected server, in declaration then listing order. */
    readonly tools: Effect.Effect<readonly McpToolDescriptor[]>
    /**
     * Send `tools/call` to `server` for a tool it listed. Never retried; bounded
     * by `MCP_CLIENT_TIMEOUT`. The caller is responsible for the approval of a
     * tool that is not read-only.
     */
    readonly callTool: (
      server: string,
      tool: string,
      args: Readonly<Record<string, unknown>>
    ) => Effect.Effect<McpToolResult, McpToolCallError>
    /**
     * {@link callTool}, where a question the server asks during the call is
     * put to `policy`: answered at once, or relayed (`asked`). `callTool`
     * answers every question `cancel`.
     */
    readonly startToolCall: (
      server: string,
      tool: string,
      args: Readonly<Record<string, unknown>>,
      policy: McpElicitationPolicy
    ) => Effect.Effect<McpToolCallOutcome, McpToolCallError>
  }
>()('McpClient') {}
