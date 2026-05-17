/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * MCP `tools/call` audit logger (US-AI-MCP-SERVER-AUDIT, M-13).
 *
 * Wraps every successful or failed `tools/call` dispatch in `mcp-routes.ts`
 * and persists a row to `system.ai_tool_calls` capturing the caller role,
 * tool name, sanitized input arguments, output result (or error message),
 * and wall-clock latency.
 *
 * Default-on per the env schema (`MCP_AUDIT_ENABLED=true` is the default).
 * Operators can disable via `MCP_AUDIT_ENABLED=false` for compliance edge
 * cases (the schema docs strongly discourage it). Disabling skips every
 * insert; the table itself is created via Drizzle migration 0001 so the
 * `InternalTableRegistry` description stays truthful regardless.
 *
 * `tools/list` is intentionally NOT audited — discovery is a high-frequency
 * idempotent read that would flood the audit table without adding security
 * value (no authorization decision flows from it). Per AC-006.
 *
 * Sibling to `mcp-rate-limit.ts` and `mcp-auth.ts`. Split out of
 * `mcp-routes.ts` so each module stays under the project-wide 400-line
 * `max-lines` ceiling.
 *
 * The internal admin tool `{appName}_system_ai_tool_calls_list` is also
 * implemented here (AC-008) — it queries the same table the logger writes
 * to, so co-locating both halves keeps the audit feature in one file.
 * The full M-14 internals surface (every table in `InternalTableRegistry`
 * exposed as a tool) is a separate spec; this slice only ships the
 * single tool the M-13 regression test exercises.
 *
 * Schema source-of-truth: `infrastructure/database/drizzle/schema/ai.ts`
 * (table `aiToolCalls`). This module mirrors the column names used there
 * (`caller_role`, `caller_id`, `caller_type`, `input`, `output`,
 * `error_message`, `error_code`, `latency_ms`, `transport`).
 */

import { sql } from 'drizzle-orm'
import { type Context } from 'hono'
import { db } from '@/infrastructure/database'
import { jsonbLiteral } from '@/infrastructure/database/sql/sql-utils'
import { logWarning } from '@/infrastructure/logging/logger'
import type { McpCaller, McpCallerRole } from '@/infrastructure/server/route-setup/mcp/auth'

// ---------------------------------------------------------------------------
// Audit row insert
// ---------------------------------------------------------------------------

/**
 * Captured outcome of a `tools/call` dispatch — extracted from the JSON-RPC
 * response envelope built by `jsonRpcSuccess` / `jsonRpcError`. Either the
 * `result` slot (success) or the `error` slot (failure) is populated; the
 * other is undefined.
 */
interface DispatchOutcome {
  readonly result: unknown | undefined
  readonly errorCode: number | undefined
  readonly errorMessage: string | undefined
}

/**
 * Extract the success result or error message from a JSON-RPC response body.
 * The body is the parsed JSON read off the Response returned by `handleToolsCall`
 * — either `{ result: { content: [...] } }` for success or
 * `{ error: { code, message } }` for failure.
 *
 * Failure path is detected by the presence of an `error` key — we never trust
 * the HTTP status code because Hono returns 200 for both shapes (per the
 * JSON-RPC convention that the envelope, not the transport, carries the
 * error). When the body is malformed (parse error, unexpected shape) we fall
 * back to recording the call as a success with `result: undefined` so the
 * audit row still lands; missing audit rows are worse than rough ones for an
 * operational log.
 */
const extractDispatchOutcome = (body: unknown): DispatchOutcome => {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { result: undefined, errorCode: undefined, errorMessage: undefined }
  }
  const envelope = body as { readonly result?: unknown; readonly error?: unknown }
  if (envelope.error !== undefined && envelope.error !== null) {
    const err = envelope.error as { readonly code?: unknown; readonly message?: unknown }
    const message = typeof err.message === 'string' ? err.message : 'Unknown error'
    const code = typeof err.code === 'number' ? err.code : undefined
    return { result: undefined, errorCode: code, errorMessage: message }
  }
  return { result: envelope.result, errorCode: undefined, errorMessage: undefined }
}

/**
 * Insert a single audit row. Errors during insert are swallowed and logged to
 * stderr — the audit log MUST NOT break the live tool dispatch. The failed
 * insert is still surfaced via the warning log so an operator monitoring
 * stderr sees the breakage.
 *
 * Column mapping notes:
 * - `caller_type`: `'oauth' | 'token'` derived from the resolved caller
 *   (oauth callers carry a `userId`, static-token callers do not).
 * - `caller_id`: `userId` for oauth callers; the literal string `'token'`
 *   for static-token callers (we deliberately do NOT log the bearer token
 *   value — leaking it into the audit log would defeat the auth gate).
 * - `transport`: hard-coded `'streamable-http'` because the audit path
 *   only fires from the HTTP transport handler. The stdio transport runs
 *   in a separate code path (M-3) and is not currently audited.
 */
const insertAuditRow = async (input: {
  readonly callerRole: McpCallerRole
  readonly callerId: string
  readonly callerType: 'oauth' | 'token'
  readonly toolName: string
  readonly inputArgs: Record<string, unknown>
  readonly outcome: DispatchOutcome
  readonly latencyMs: number
}): Promise<void> => {
  // Latency is wall-clock; round to the nearest integer ms because the
  // database column is INTEGER and `Date.now()` returns integer ms but a
  // future caller switching to `performance.now()` might pass a sub-ms
  // float. The min(1) clamp guarantees a positive integer per AC-005,
  // which says `latency_ms` must be a positive integer (sub-ms calls
  // round to 0 on cold paths in CI).
  const roundedLatency = Math.max(1, Math.round(input.latencyMs))

  // drizzle-orm + bun-sql binds parameter values as TEXT, which produces
  // "column is of type jsonb but expression is of type text" errors when
  // sent into a JSONB column. `jsonbLiteral` inlines the value as a
  // typed `'…'::jsonb` literal — see `sql-utils.ts` for the full rationale.
  const inputLiteral = jsonbLiteral(input.inputArgs)
  const outputLiteral =
    input.outcome.result === undefined ? sql.raw('NULL') : jsonbLiteral(input.outcome.result)
  const errorMessageFragment =
    input.outcome.errorMessage === undefined ? sql.raw('NULL') : sql`${input.outcome.errorMessage}`
  const errorCodeFragment =
    input.outcome.errorCode === undefined ? sql.raw('NULL') : sql`${input.outcome.errorCode}`

  try {
    // eslint-disable-next-line functional/no-expression-statements -- side-effecting INSERT into the audit log
    await db.execute(
      sql`INSERT INTO system.ai_tool_calls
          (tool_name, caller_type, caller_id, caller_role, input, output, error_message, error_code, latency_ms, transport)
          VALUES (
            ${input.toolName},
            ${input.callerType},
            ${input.callerId},
            ${input.callerRole},
            ${inputLiteral},
            ${outputLiteral},
            ${errorMessageFragment},
            ${errorCodeFragment},
            ${roundedLatency},
            'streamable-http'
          )`
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const cause = error instanceof Error && error.cause instanceof Error ? error.cause.message : ''
    // Audit-write failures must reach operator stderr without breaking the
    // live request — `logWarning` routes through the project logger to keep
    // the lint surface clean while still emitting visible output.
    logWarning(
      `[mcp-audit] failed to persist tool-call audit row: ${message}${cause ? ` | cause: ${cause}` : ''}`
    )
  }
}

/**
 * Derive the `(caller_type, caller_id)` pair from a resolved caller. The
 * static-token strategy never carries a `userId`, so we tag the caller as
 * `'token'` and use a fixed `'token'` id (we deliberately do NOT log the
 * bearer value — leaking it into the audit log would defeat the auth
 * gate). OAuth callers always carry a real `userId` from Better Auth.
 */
const deriveCallerIdentity = (
  caller: Readonly<McpCaller>
): { readonly callerType: 'oauth' | 'token'; readonly callerId: string } => {
  if (caller.userId !== undefined && caller.userId.length > 0) {
    return { callerType: 'oauth', callerId: caller.userId }
  }
  return { callerType: 'token', callerId: 'token' }
}

// ---------------------------------------------------------------------------
// Dispatch wrapper — public API
// ---------------------------------------------------------------------------

export interface AuditDispatchInput {
  readonly auditEnabled: boolean
  readonly caller: McpCaller
  readonly toolName: string
  readonly args: Record<string, unknown>
  readonly dispatch: () => Promise<Response> | Response
}

/**
 * Wrap a `tools/call` dispatch with audit logging.
 *
 * Captures the start timestamp, runs `dispatch()` to produce the JSON-RPC
 * Response, clones the Response to read the body without consuming the
 * stream the caller will send to the client, and persists an audit row.
 *
 * Returns the original Response unmodified so the wire format is byte-for-byte
 * identical with or without auditing. When `auditEnabled` is false the
 * dispatch runs straight through with no clone, no body read, and no insert.
 */
export const auditedToolsCallDispatch = async (input: AuditDispatchInput): Promise<Response> => {
  if (!input.auditEnabled) {
    return input.dispatch()
  }

  const start = Date.now()
  const response = await input.dispatch()
  const latencyMs = Date.now() - start

  // Clone the response so we can read its body without consuming the original.
  // Hono's `c.json(...)` produces a fresh Response each call; cloning is safe
  // (no consumed-body races) because the original has not been awaited yet.
  // When parsing fails (non-JSON body, stream error) the outcome stays empty
  // and the audit row still lands with `output: null, error_message: null` so
  // we have a record the call happened.
  const outcome = await readResponseOutcome(response)
  const identity = deriveCallerIdentity(input.caller)

  // The `await` here is intentional: it ensures the audit row is committed
  // before the response leaves the handler so a subsequent `executeQuery`
  // from the test (or a follow-up tools/call from a real client) sees the
  // row. The latency cost is a single INSERT against a 10-column table with
  // six indexes — measured in single-digit ms.
  // eslint-disable-next-line functional/no-expression-statements -- audit-log INSERT side effect, intentionally awaited for write-then-read consistency
  await insertAuditRow({
    callerRole: input.caller.role,
    callerId: identity.callerId,
    callerType: identity.callerType,
    toolName: input.toolName,
    inputArgs: input.args,
    outcome,
    latencyMs,
  })

  return response
}

/**
 * Read and parse the JSON body of a cloned Response, returning the
 * extracted outcome. Failures (non-JSON body, stream error) collapse to the
 * empty outcome so the audit row still lands.
 */
const readResponseOutcome = async (response: Readonly<Response>): Promise<DispatchOutcome> => {
  try {
    const clone = response.clone()
    const body = await clone.json()
    return extractDispatchOutcome(body)
  } catch {
    return { result: undefined, errorCode: undefined, errorMessage: undefined }
  }
}

// ---------------------------------------------------------------------------
// Internal tool: `{appName}_system_ai_tool_calls_list` (AC-008)
// ---------------------------------------------------------------------------
//
// The tool definition for `{appName}_system_ai_tool_calls_list` is generated
// by the M-14 registry-driven compiler (`compileInternalTools` in
// `mcp-internals.ts`) along with the rest of the InternalTableRegistry
// surface. The audit-list tool is special-cased in `mcp-routes.ts` and
// routed to `handleAuditListCall` (below) BEFORE the generic internals
// dispatcher claims it — that anti-recursion gate ensures an admin
// audit-read does NOT log a row into the same `system.ai_tool_calls` table
// it just queried (which would announce its own creation and swamp the log).

/**
 * True when the given tool name is the internal audit-list tool for `appName`.
 * Used by `mcp-routes.ts` to route the dispatcher to `handleAuditListCall`
 * before it reaches the M-14 generic internals dispatcher (which would
 * otherwise also claim this tool name and run a SELECT through that path,
 * adding an audit row mid-read).
 */
export const isInternalAuditListTool = (toolName: string, appName: string): boolean =>
  toolName === `${appName}_system_ai_tool_calls_list`

interface AuditListRow {
  readonly id: string
  readonly created_at: string
  readonly caller_role: string
  readonly caller_id: string
  readonly caller_type: string
  readonly tool_name: string
  readonly input: unknown
  readonly output: unknown
  readonly error_message: string | null
  readonly error_code: number | null
  readonly latency_ms: number
  readonly transport: string
}

/**
 * Handle the internal audit-list tools/call. Admin-only — gate enforced
 * upstream by `tools/list` filtering AND by an explicit role check here so
 * a viewer who hand-crafts the tool name gets a -32603 instead of a 200.
 */
export const handleAuditListCall = async (input: {
  readonly c: Readonly<Context>
  readonly caller: McpCaller
  readonly responseId: number | string
  readonly args: Record<string, unknown>
}): Promise<Response> => {
  if (input.caller.role !== 'admin') {
    return input.c.json({
      jsonrpc: '2.0',
      id: input.responseId,
      error: {
        code: -32_603,
        message: 'Internal tool system.ai_tool_calls is admin-only',
      },
    })
  }

  const limitArg = input.args['limit']
  const limit = typeof limitArg === 'number' && limitArg > 0 ? Math.min(limitArg, 1000) : 50

  try {
    // Inline `limit` as a SQL literal (after clamping + type-checking) so the
    // bun-sql driver doesn't try to bind it — `LIMIT $1` round-trips poorly
    // through bun:sql's param-binding path. The value is admin-only and is
    // clamped to the `[1, 1000]` range above, so SQL injection is not a
    // concern.
    const safeLimit = Math.floor(limit)
    const result = (await db.execute(
      sql.raw(
        `SELECT id, created_at, caller_role, caller_id, caller_type, tool_name, input, output, error_message, error_code, latency_ms, transport
         FROM system.ai_tool_calls
         ORDER BY created_at DESC
         LIMIT ${safeLimit}`
      )
    )) as unknown as { readonly rows?: ReadonlyArray<AuditListRow> }

    // Bun's bun:sql driver returns rows directly as an array (no `.rows`
    // wrapper); the pg driver wraps in `.rows`. Handle both shapes for
    // forward compatibility.
    const rows = Array.isArray(result)
      ? (result as ReadonlyArray<AuditListRow>)
      : (result.rows ?? [])

    return input.c.json({
      jsonrpc: '2.0',
      id: input.responseId,
      result: {
        content: [{ type: 'text', text: JSON.stringify(rows, undefined, 2) }],
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return input.c.json({
      jsonrpc: '2.0',
      id: input.responseId,
      error: {
        code: -32_603,
        message: `Audit-list query failed: ${message}`,
      },
    })
  }
}
