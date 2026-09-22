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

import { Effect } from 'effect'
import { McpAuditRepository } from '@/application/ports/repositories/mcp/mcp-audit-repository'
import { isAdminRole } from '@/domain/models/app/auth/permission-evaluation'
import { logError } from '@/infrastructure/logging/logger'
import { runOnDomain } from '@/infrastructure/logging/request-effect'
import { toolFailure, toolSuccess, type McpToolResult } from './tool-call-helpers'
import type { DomainContext } from '@/infrastructure/logging/request-effect'
import type { McpCaller, McpCallerRole } from '@/presentation/api/mcp/auth'

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
 * Append one audit row through {@link McpAuditRepository}.
 *
 * Column-mapping notes (the columns themselves now live in the repository):
 * - `caller_type`: `'oauth' | 'token'` derived from the resolved caller
 *   (oauth callers carry a `userId`, static-token callers do not).
 * - `caller_id`: `userId` for oauth callers; the literal string `'token'`
 *   for static-token callers (we deliberately do NOT log the bearer token
 *   value — leaking it into the audit log would defeat the auth gate).
 * - `transport`: hard-coded `'streamable-http'` because the audit path
 *   only fires from the HTTP transport handler. The stdio transport runs
 *   in a separate code path (M-3) and is not currently audited.
 *
 * ERRORS ARE SWALLOWED HERE, AND ONLY HERE. The audit log MUST NOT break a
 * live tool dispatch, so a write failure is logged and the call proceeds. That
 * policy belongs to the dispatcher rather than to the store: the repository
 * REPORTS its failure, and this is the one place that decides to continue
 * anyway. The previous arrangement had the same swallow wrapped around a raw
 * `db.execute` that does not exist on `bun:sqlite`, so the trail was silently
 * empty on the zero-config default engine while every request still answered
 * 200 — the failure mode this split makes impossible to repeat unnoticed.
 */
const insertAuditRow = async (
  domainContext: DomainContext,
  entry: {
    readonly callerRole: McpCallerRole
    readonly callerId: string
    readonly callerType: 'oauth' | 'token'
    readonly toolName: string
    readonly inputArgs: Record<string, unknown>
    readonly outcome: DispatchOutcome
    readonly latencyMs: number
  }
): Promise<void> => {
  const write = Effect.gen(function* () {
    const repository = yield* McpAuditRepository
    yield* repository.recordToolCall({
      toolName: entry.toolName,
      callerType: entry.callerType,
      callerId: entry.callerId,
      callerRole: entry.callerRole,
      inputArgs: entry.inputArgs,
      result: entry.outcome.result,
      errorMessage: entry.outcome.errorMessage,
      errorCode: entry.outcome.errorCode,
      latencyMs: entry.latencyMs,
    })
  }).pipe(
    Effect.tapCause((cause) =>
      Effect.sync(() => logError('[mcp-audit] failed to persist tool-call audit row', cause))
    ),
    // effect-swallow: an audit-write failure must not break the live dispatch.
    // Logged above so an operator watching stderr sees the breakage.
    Effect.orElseSucceed(() => undefined)
  )
  return runOnDomain(domainContext, write)
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
  /** The resolved domain services this dispatch runs on. */
  readonly domainContext: DomainContext
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
  await insertAuditRow(input.domainContext, {
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

/**
 * Handle the internal audit-list tools/call. Admin-only — gate enforced
 * upstream by `tools/list` filtering AND by an explicit role check here so
 * a viewer who hand-crafts the tool name gets a -32603 instead of a 200.
 */
export const handleAuditListCall = async (input: {
  readonly caller: McpCaller
  readonly args: Record<string, unknown>
  readonly domainContext: DomainContext
}): Promise<McpToolResult> => {
  if (!isAdminRole(input.caller.role)) {
    return toolFailure(-32_603, 'Internal tool system.ai_tool_calls is admin-only')
  }

  const limitArg = input.args['limit']
  const limit = typeof limitArg === 'number' && limitArg > 0 ? Math.min(limitArg, 1000) : 50

  try {
    // The clamp and the 12-column projection are the two things that keep this
    // tier-1 handler distinct from the M-14 generic internals dispatcher; the
    // projection now lives in `McpAuditRepository` (which documents why it must
    // stay explicit), and the clamp stays HERE because it is argument
    // validation for this tool.
    const rows = await runOnDomain(
      input.domainContext,
      Effect.gen(function* () {
        const repository = yield* McpAuditRepository
        return yield* repository.listToolCalls(limit)
      })
    )

    return toolSuccess(rows)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return toolFailure(-32_603, `Audit-list query failed: ${message}`)
  }
}
