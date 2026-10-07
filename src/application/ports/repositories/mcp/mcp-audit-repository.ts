/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data, type Effect } from 'effect'
import type { McpInternalListQuery } from './mcp-internals-repository'

/** Database error for the MCP tool-call audit trail. */
export class McpAuditDatabaseError extends Data.TaggedError('McpAuditDatabaseError')<{
  readonly cause: unknown
}> {}

/** What one dispatched tool call is recorded as. */
export interface McpToolCallAuditEntry {
  readonly toolName: string
  readonly callerType: 'oauth' | 'token'
  /**
   * `userId` for an OAuth caller; the literal `'token'` for a static-token
   * caller. The bearer value is NEVER recorded — putting it in the audit log
   * would defeat the auth gate the log exists to observe.
   */
  readonly callerId: string
  readonly callerRole: string
  readonly inputArgs: Record<string, unknown>
  readonly result: unknown | undefined
  readonly errorMessage: string | undefined
  readonly errorCode: number | undefined
  /**
   * Wall-clock duration. The implementation clamps and rounds it to a positive
   * integer ([internal ref] [internal ref]) — callers pass the raw measurement.
   */
  readonly latencyMs: number
}

/**
 * One audit row as the admin-only `*_system_ai_tool_calls_list` tool returns it.
 *
 * SNAKE_CASE ON PURPOSE. These keys are the MCP tool's published response and
 * an admin client reads them by name, so camel-casing them here would be a wire
 * break dressed as a style fix.
 *
 * The twelve fields are the whole projection, and the omissions are the point:
 * `session_id` and `request_id` are columns of the backing table and are NOT
 * here. `ai_tool_calls` declares `denylistFields: []`, so the generic internals
 * dispatcher — which answers `SELECT *` — would put both on the wire. This
 * narrower shape is the only thing that distinguishes the two paths, and
 * an AI MCP audit spec pins the difference.
 */
/**
 * The ledger list's projection, in answer order: exactly the keys of
 * {@link McpToolCallAuditRow}. It is also the `where` allow-list of the ledger
 * list tool, so a filter can name only a column the tool answers — an equality
 * on a withheld column would be an oracle for it.
 */
export const TOOL_CALL_LEDGER_COLUMNS = [
  'id',
  'created_at',
  'caller_role',
  'caller_id',
  'caller_type',
  'tool_name',
  'input',
  'output',
  'error_message',
  'error_code',
  'latency_ms',
  'transport',
] as const satisfies ReadonlyArray<keyof McpToolCallAuditRow>

export interface McpToolCallAuditRow {
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
 * Port over the MCP tool-call audit trail (`system.ai_tool_calls`).
 *
 * Introduced in W5b of the layout programme. Before it, the audit module held a
 * live `db` handle and two hand-written SQL statements — one of which had
 * already shipped a dialect bug (a direct `db.execute` that does not exist on
 * `bun:sqlite`, swallowed by the same `catch` that keeps an audit failure from
 * breaking a live dispatch, so the request returned 200 with an empty trail on
 * the zero-config default engine). Keeping the SQL behind this interface is
 * what puts both statements in one dialect-aware place.
 */
export class McpAuditRepository extends Context.Service<
  McpAuditRepository,
  {
    /**
     * Append one dispatched tool call to the trail.
     *
     * The caller decides what a failure means. This method REPORTS it rather
     * than swallowing it: the audit path must not break a live dispatch, but
     * "must not break" is the dispatcher's policy to apply, not a silence to
     * bake into the store. The dispatcher logs the cause and carries on.
     */
    readonly recordToolCall: (
      entry: McpToolCallAuditEntry
    ) => Effect.Effect<void, McpAuditDatabaseError>

    /**
     * One page of calls, newest first by `created_at` (then `id` descending),
     * filtered by `since` and the `where` equalities, continuing after the
     * `after` row — the raw-list rules every internal list follows.
     *
     * The query is validated by the CALLER before it arrives: `limit` clamped
     * to `[1, 1000]`, every `where` column one of
     * {@link TOOL_CALL_LEDGER_COLUMNS} and every value one its column can hold.
     * Re-validating here would put the rules in two places that could disagree.
     */
    readonly listToolCalls: (
      query: McpInternalListQuery
    ) => Effect.Effect<ReadonlyArray<McpToolCallAuditRow>, McpAuditDatabaseError>
  }
>()('McpAuditRepository') {}
