/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * MCP `tools/call` audit logger.
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
 * value (no authorization decision flows from it)..
 *
 * Sibling to `mcp-rate-limit.ts` and `mcp-auth.ts`. Split out of
 * `mcp-routes.ts` so each module stays under the project-wide 400-line
 * `max-lines` ceiling.
 *
 * The internal admin tool `{appName}_system_ai_tool_calls_list` is also
 * implemented here — it queries the same table the logger writes
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
import { isAdminRole } from '@/domain/models/shared/permission-evaluation'
import { db } from '@/infrastructure/database'
import { executeRaw, executeRawTyped } from '@/infrastructure/database/sql/dialect-execute'
import { systemTableRef } from '@/infrastructure/database/sql/dialect-sql'
import { jsonbLiteral } from '@/infrastructure/database/sql/sql-utils'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import { logError } from '@/infrastructure/logging/logger'
import { toolFailure, toolSuccess, type McpToolResult } from './tool-call-helpers'
import type { McpCaller, McpCallerRole } from '@/infrastructure/server/route-setup/mcp/auth'

// ---------------------------------------------------------------------------
// Audit row insert
// ---------------------------------------------------------------------------

/**
 * Captured outcome of a `tools/call` dispatch — extracted from the JSON-RPC
 * result built by `toolSuccess` / `toolFailure`. Either the
 * `result` slot (success) or the `error` slot (failure) is populated; the
 * other is undefined.
 */
interface DispatchOutcome {
  readonly result: unknown | undefined
  readonly errorCode: number | undefined
  readonly errorMessage: string | undefined
}

/**
 * The `created_at` value the hand-written audit INSERT must supply.
 *
 * `id` and `created_at` are `NOT NULL` on both dialects, but only Postgres
 * backs them with a SQL-level `DEFAULT` (`gen_random_uuid()` / `now()`). The
 * SQLite mirror declares them as Drizzle `$defaultFn`s — application-level
 * generators the ORM runs while *building* an insert — and a raw `INSERT` like
 * this one never goes through that path. Left out, SQLite rejects the row with
 * `NOT NULL constraint failed`. Supplying both keeps ONE column list correct on
 * both engines.
 *
 * `created_at` is the half that cannot be shared, because the two dialects do
 * not merely format it differently — they store different types:
 * `timestamptz` on Postgres, an INTEGER of epoch **milliseconds** on SQLite
 * (`integer('created_at', { mode: 'timestamp_ms' })` in `schema-sqlite/ai.ts`).
 *
 * Deliberately NOT `nowExpr()` from `sql/dialect-sql.ts`, which is the
 * obvious-looking helper and the wrong one here: its SQLite arm emits an
 * ISO-8601 **TEXT** value, the right choice for the dynamic-table `TEXT`
 * timestamp family and the wrong one for this INTEGER column. SQLite's loose
 * typing would store that string without complaint, after which it sorts after
 * every genuine integer under the `ORDER BY created_at DESC` this table is read
 * with, and decodes to garbage through `timestamp_ms`. That failure is silent,
 * which is why it is called out rather than left to be rediscovered.
 */
const auditCreatedAt = () => (isSqliteRuntime() ? sql`${Date.now()}` : sql.raw('now()'))

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
  // float. The min(1) clamp guarantees a positive integer,
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
    // `executeRaw` picks the dialect's execution method: `.execute()` on the
    // Postgres client, `.all()` on SQLite. `db.execute` does not exist on
    // `bun-sqlite` at all, so the previous direct call threw
    // `TypeError: db.execute is not a function` — and because this catch
    // swallows everything, the request still returned 200 while the trail
    // stayed empty on the zero-config default engine.
    //
    // eslint-disable-next-line functional/no-expression-statements -- side-effecting INSERT into the audit log
    await executeRaw(
      db,
      sql`INSERT INTO ${systemTableRef('ai_tool_calls')}
          (id, created_at, tool_name, caller_type, caller_id, caller_role, input, output, error_message, error_code, latency_ms, transport)
          VALUES (
            ${crypto.randomUUID()},
            ${auditCreatedAt()},
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
    // Audit-write failures must reach operators without breaking the live
    // request — logError routes the error (and its `.cause` chain) to Sentry
    // and prints a local stack while still emitting visible output.
    logError('[mcp-audit] failed to persist tool-call audit row', error)
  }
}

/**
 * Derive the `(caller_type, caller_id)` pair from a resolved caller.
 *
 * Both credentials `/mcp` accepts — an API key and an OAuth access token —
 * resolve to a real Better Auth user, so the `'oauth'` branch is the live one
 * and `caller_id` is always a real subject. That is the audit property the
 * static tokens could not offer: having no identity, they wrote the literal
 * `'token'` as their own id, and every caller holding the same secret was
 * indistinguishable in the log.
 *
 * The `'token'` branch is now unreachable and kept as a fail-closed default —
 * a caller the auth gate somehow let through without a subject is recorded as
 * unidentified rather than attributed to someone. Note the label lags the
 * vocabulary: `'oauth'` now means "a Better Auth subject" rather than "arrived
 * over OAuth", and narrowing it to distinguish the two credentials would change
 * the meaning of a column that already holds rows written under the old
 * vocabulary.
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
  readonly dispatch: () => Promise<McpToolResult>
}

/**
 * Wrap a `tools/call` dispatch with audit logging.
 *
 * Under the SDK v2 handler a tool dispatch either RETURNS an
 * {@link McpToolResult} or THROWS a `ProtocolError` (the only way to surface a
 * JSON-RPC protocol error — see `toolFailure`). Both outcomes must be audited,
 * so the failure path catches, records, and re-throws rather than swallowing:
 * a denied call is exactly the kind of event the trail exists to capture.
 *
 * When `auditEnabled` is false the dispatch runs straight through with no
 * body read and no insert.
 */
export const auditedToolsCallDispatch = async (
  input: AuditDispatchInput
): Promise<McpToolResult> => {
  if (!input.auditEnabled) {
    return input.dispatch()
  }

  const start = Date.now()
  const settled = await runDispatchToOutcome(input.dispatch)
  const latencyMs = Date.now() - start
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
    outcome: settled.outcome,
    latencyMs,
  })

  if (settled.thrown !== undefined) {
    // eslint-disable-next-line functional/no-throw-statements -- re-raise the protocol error after the audit row lands
    throw settled.thrown
  }
  return settled.result as McpToolResult
}

interface SettledDispatch {
  readonly outcome: DispatchOutcome
  readonly result: McpToolResult | undefined
  readonly thrown: unknown | undefined
}

/**
 * Run the dispatch and normalize both outcomes into an auditable shape.
 *
 * A thrown `ProtocolError` carries `code` / `message`, which map onto the
 * `error_code` / `error_message` audit columns exactly as the hand-built
 * JSON-RPC error envelope used to.
 */
const runDispatchToOutcome = async (
  dispatch: () => Promise<McpToolResult>
): Promise<SettledDispatch> => {
  try {
    const result = await dispatch()
    return {
      outcome: { result, errorCode: undefined, errorMessage: undefined },
      result,
      thrown: undefined,
    }
  } catch (error) {
    const err = error as { readonly code?: unknown; readonly message?: unknown }
    return {
      outcome: {
        result: undefined,
        errorCode: typeof err.code === 'number' ? err.code : undefined,
        errorMessage: typeof err.message === 'string' ? err.message : 'Unknown error',
      },
      result: undefined,
      thrown: error,
    }
  }
}

// ---------------------------------------------------------------------------
// Internal tool: `{appName}_system_ai_tool_calls_list`
// ---------------------------------------------------------------------------
//
// The tool definition for `{appName}_system_ai_tool_calls_list` is generated
// by the M-14 registry-driven compiler (`compileInternalTools` in
// `mcp-internals.ts`) along with the rest of the InternalTableRegistry
// surface. The audit-list tool is special-cased in `mcp-routes.ts` and
// routed to `handleAuditListCall` (below) BEFORE the generic internals
// dispatcher claims it — because that dispatcher answers `SELECT *`, and
// `ai_tool_calls` declares `denylistFields: []`, so it would put `session_id`
// and `request_id` on the wire. The 12-column projection below is the whole
// point of the ordering, and `[internal ref]` pins it.
//
// Until 2026-08-27 this comment called that an anti-recursion gate — the claim
// that an audit-read would otherwise log a row for itself. It would not: the
// generic dispatcher is invoked outside `auditedToolsCallDispatch` too, so
// neither path writes an audit row. The constraint is real, but it
// is about data exposure, not bookkeeping.

/**
 * True when the given tool name is the internal audit-list tool for `appName`.
 * Used by `mcp-routes.ts` to route the dispatcher to `handleAuditListCall`
 * before it reaches the M-14 generic internals dispatcher, which would
 * otherwise also claim this tool name and answer it with `SELECT *` —
 * exposing `session_id` and `request_id`, since `ai_tool_calls` declares
 * `denylistFields: []`. It does NOT add an audit row (the wording here until
 * 2026-08-27): that path writes none either..
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
  readonly caller: McpCaller
  readonly args: Record<string, unknown>
}): Promise<McpToolResult> => {
  if (!isAdminRole(input.caller.role)) {
    return toolFailure(-32_603, 'Internal tool system.ai_tool_calls is admin-only')
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

    // The 12-column projection is load-bearing and must stay explicit: it is
    // the only thing that distinguishes this tier-1 handler from the M-14
    // generic internals dispatcher, which answers `SELECT *` and — because
    // `ai_tool_calls` declares `denylistFields: []` — would put `session_id`
    // and `request_id` on the wire. [internal ref] pins that difference.
    //
    // `executeRawTyped` selects the dialect's execution method AND normalizes
    // both driver result shapes, which is why no `.rows` unwrap follows: the
    // hand-rolled one that used to live here is now dead code.
    const rows = await executeRawTyped<AuditListRow>(
      db,
      sql`SELECT id, created_at, caller_role, caller_id, caller_type, tool_name, input, output, error_message, error_code, latency_ms, transport
          FROM ${systemTableRef('ai_tool_calls')}
          ORDER BY created_at DESC
          LIMIT ${sql.raw(String(safeLimit))}`
    )

    return toolSuccess(rows)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return toolFailure(-32_603, `Audit-list query failed: ${message}`)
  }
}
