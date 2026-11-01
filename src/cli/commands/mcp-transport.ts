/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { PassThrough } from 'node:stream'
import {
  ProtocolError,
  Server,
  isJSONRPCErrorResponse,
  isJSONRPCRequest,
  isJSONRPCResultResponse,
} from '@modelcontextprotocol/server'
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio'
import {
  handleConfigToolCall,
  type ConfigToolsProvider,
} from '@/application/use-cases/config/config-mcp-tool-call'
import {
  compileConfigTools,
  isConfigToolName,
} from '@/application/use-cases/config/config-mcp-tools'
import { registerSkillPrompts } from '@/cli/commands/mcp-prompts'
import type {
  JSONRPCMessage,
  MessageExtraInfo,
  Transport,
  TransportSendOptions,
} from '@modelcontextprotocol/server'

/**
 * The stdio session of `sovrium mcp`: the transport that answers every request
 * before EOF ends it, the queue that runs tool calls in pipe order, and the
 * server one connection is pinned to. `mcp.ts` resolves the project and starts
 * the session.
 */

// ---------------------------------------------------------------------------
// The transport, and why it is wrapped
// ---------------------------------------------------------------------------

/**
 * `StdioServerTransport` plus the two things EOF needs.
 *
 * The SDK's transport treats end-of-input as the end of the session: since
 * 2.3.0 it listens for `end`/`close` on stdin and closes itself on the spot,
 * and `serveStdio` answers that by closing the server instance — which aborts
 * every request still in flight, unanswered. That truncates exactly the session
 * a client is entitled to: one that writes every request and closes the pipe in
 * one breath (which is what a piped `printf` does, and what the E2E harness
 * does). JSON-RPC owes a response to every request received, so EOF has to mean
 * "no more requests", not "drop the ones you have".
 *
 * So the inner transport never sees EOF. It reads from a {@link PassThrough}
 * that stdin is piped into with `end: false`; stdin's own `end`/`close` are
 * observed HERE. This counts inbound REQUESTS against outbound RESPONSES and
 * resolves {@link whenDrained} only once stdin has ended AND nothing is
 * outstanding; the caller then closes the handle, which closes the inner
 * transport. A class, not a closure over `let`s: `functional/immutable-data`
 * exempts classes precisely so a small piece of protocol bookkeeping can be
 * written plainly.
 */
export class DrainingStdioTransport implements Transport {
  // stdin reaches the SDK through this, never directly: see the class comment.
  private readonly feed = new PassThrough()
  private readonly inner = new StdioServerTransport(this.feed)
  private pending = 0
  private ended = false
  private settled = false
  private resolveDrained: () => void = () => undefined

  readonly whenDrained: Promise<void> = new Promise((resolve) => {
    this.resolveDrained = resolve
  })

  onclose?: (() => void) | undefined
  onerror?: ((error: Error) => void) | undefined
  onmessage?: (<T extends JSONRPCMessage>(message: T, extra?: MessageExtraInfo) => void) | undefined

  async start(): Promise<void> {
    this.inner.onclose = (): void => {
      this.markEnded()
      this.onclose?.()
    }
    this.inner.onerror = (error: Error): void => this.onerror?.(error)
    this.inner.onmessage = (message: JSONRPCMessage): void => {
      if (isJSONRPCRequest(message)) this.pending += 1
      this.onmessage?.(message)
    }
    // EOF is ours to observe, and never reaches the inner transport: `end:
    // false` keeps the feed open after stdin ends. Both events are registered
    // because a pipe that is destroyed rather than ended emits only `close`.
    process.stdin.on('error', (error: Error) => this.onerror?.(error))
    process.stdin.on('end', () => this.markEnded())
    process.stdin.on('close', () => this.markEnded())
    process.stdin.pipe(this.feed, { end: false })
    await this.inner.start()
  }

  async send(message: JSONRPCMessage, _options?: TransportSendOptions): Promise<void> {
    // `_options` is dropped, not forgotten: `relatedRequestId` tells a
    // per-request-stream transport which stream to write on, and stdio has one
    // channel. `StdioServerTransport.send` takes the message alone for exactly
    // that reason.
    await this.inner.send(message)
    // BOTH halves: an error response settles a request exactly as a result
    // does, and counting only results would hang a session whose last request
    // was refused.
    if (isJSONRPCResultResponse(message) || isJSONRPCErrorResponse(message)) {
      this.pending = Math.max(0, this.pending - 1)
      this.maybeFinish()
    }
  }

  async close(): Promise<void> {
    this.markEnded()
    process.stdin.unpipe(this.feed)
    await this.inner.close()
  }

  private markEnded(): void {
    this.ended = true
    this.maybeFinish()
  }

  private maybeFinish(): void {
    if (!this.ended || this.pending > 0 || this.settled) return
    this.settled = true
    this.resolveDrained()
  }
}

// ---------------------------------------------------------------------------
// The command
// ---------------------------------------------------------------------------

/**
 * Build the MCP instance one connection is pinned to.
 *
 * The low-level {@link Server} rather than `McpServer`, for the same reason the
 * HTTP mount uses it: `McpServer.registerTool` converts a thrown protocol error
 * into a tool RESULT with `isError: true`, which would make the refusal
 * `_config_schema` owes an unresolvable path unreachable as a JSON-RPC error.
 * `Server` also answers `initialize`, `ping` and `server/discover` itself, and
 * answers anything else with `-32601` — a refusal rather than a dropped pipe.
 */
export const buildStdioServer = (
  provider: ConfigToolsProvider,
  version: string,
  dir: string
): Server => {
  const server = new Server(
    { name: 'sovrium', version },
    // `prompts`: the binary's agent skills and the project's brief, re-read per
    // request (so no change notification), served here only — HTTP declares none.
    { capabilities: { tools: { listChanged: false }, prompts: { listChanged: false } } }
  )
  registerSkillPrompts(server, dir)
  // ONE gate, read once: the provider carries the write operations only where
  // A8 authorised them, so compiling from the same fact is what keeps
  // `tools/list` and the dispatcher below from disagreeing about which tools
  // exist. A name published but not dispatchable would be worse than either.
  const writeEnabled = provider.write !== undefined
  const tools = compileConfigTools(provider.appName, { writeEnabled })
  const queue = new ToolCallQueue()

  server.setRequestHandler('tools/list', async () => ({ tools }) as never)

  server.setRequestHandler('tools/call', async (request) => {
    const { params } = request as {
      readonly params?: { readonly name?: unknown; readonly arguments?: unknown }
    }
    const toolName = typeof params?.name === 'string' ? params.name : ''
    const args =
      typeof params?.arguments === 'object' &&
      params.arguments !== null &&
      !Array.isArray(params.arguments)
        ? (params.arguments as Record<string, unknown>)
        : {}
    return queue.run(async () => dispatchToolCall(provider, toolName, args)) as never
  })

  return server
}

/**
 * One tool call at a time, in the order the pipe delivered them.
 *
 * The SDK dispatches every inbound request the moment it arrives and awaits
 * none of its predecessors, so a client that writes `write_file` and then
 * `undo` in one breath — which is exactly what a piped session does, and what
 * an AI does when it decides an edit was wrong — has both handlers running at
 * once. Measured before this existed: `undo` answered FIRST and found an empty
 * history, because the write it was undoing had not finished taking its
 * snapshot.
 *
 * Concurrency is legal in JSON-RPC and harmless for the four reads, which is
 * why it went unnoticed through surface 9. It stops being harmless the moment
 * a tool has STATE behind it: these four share one project directory and one
 * snapshot history, and a pipe is an ordered channel, so honouring that order
 * is the only reading under which "write, then undo" means anything.
 *
 * A class, not a closure over a `let`, for the same reason
 * {@link DrainingStdioTransport} is one: `functional/immutable-data` exempts
 * classes precisely so a small piece of protocol bookkeeping can be written
 * plainly.
 */
class ToolCallQueue {
  private tail: Promise<unknown> = Promise.resolve()

  async run<T>(work: () => Promise<T>): Promise<T> {
    // BOTH arms run `work`: a predecessor that rejected has still finished, and
    // dropping the rest of the queue because one call was refused would hang
    // every request behind it.
    const next = this.tail.then(work, work)
    this.tail = next.catch(() => undefined)
    return next
  }
}

/** JSON-RPC `Method not found` — what an unknown TOOL earns, as the SDK does for a method. */
const METHOD_NOT_FOUND = -32_601

interface StdioToolResult {
  readonly content: ReadonlyArray<{ readonly type: 'text'; readonly text: string }>
}

const dispatchToolCall = async (
  provider: ConfigToolsProvider,
  toolName: string,
  args: Readonly<Record<string, unknown>>
): Promise<StdioToolResult> => {
  if (
    !isConfigToolName(provider.appName, toolName, { writeEnabled: provider.write !== undefined })
  ) {
    throw new ProtocolError(METHOD_NOT_FOUND, `Unknown tool: ${toolName}`)
  }
  const outcome = await handleConfigToolCall(provider, toolName, args)
  if (outcome.kind === 'refused') {
    // `data` rides along when there is any — bound 3's findings reach the client
    // in `sovrium validate --json`'s vocabulary rather than as prose it would
    // have to parse back apart.
    throw new ProtocolError(outcome.code, outcome.message, outcome.data)
  }
  return { content: [{ type: 'text', text: JSON.stringify(outcome.payload, undefined, 2) }] }
}
