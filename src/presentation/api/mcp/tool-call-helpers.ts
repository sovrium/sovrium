/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * MCP `tools/call` framing helpers.
 *
 * Extracted from `mcp-tool-call.ts` so the dispatcher stays under the project
 * 400-line max-lines ceiling. These helpers encode the MCP wire format
 * (success result wrapped in `content[0].text`, error envelope with JSON-RPC
 * 2.0 `code`/`message`) and the Effect-runner glue that bridges the
 * application-layer programs into a JSON-RPC response.
 */

import { ProtocolError } from '@modelcontextprotocol/server'
import { Effect } from 'effect'
import {
  findMultiSelectSelectionOverflows,
  findUndeclaredMultiSelectValues,
} from '@/domain/models/app/tables/multi-select-values-validation'
import { provideTableLive, type TableServices } from '@/infrastructure/layers/table-layer'
import type { Table } from '@/domain/models/app'

/**
 * The MCP `tools/call` success payload.
 *
 * Under the SDK v2 handler a tool result is a plain object the handler
 * serializes; the JSON-RPC envelope (`jsonrpc`/`id`) is owned by the SDK and
 * is no longer hand-built here. That is why these helpers no longer take a
 * Hono `Context` or a response id.
 */
export interface McpToolResult {
  readonly content: ReadonlyArray<{ readonly type: 'text'; readonly text: string }>
}

export interface RunProgramInput<A> {
  /**
   * The program to run. Its requirement channel is DECLARED as the set
   * `provideTableLive` discharges, rather than left `unknown` and asserted to
   * `never` at the call below: a tool program reaching for a service outside
   * that set now fails to compile here instead of dying as a missing-service
   * defect inside a `tools/call`.
   */
  readonly program: Effect.Effect<A, unknown, TableServices>
  readonly formatSuccess?: (value: A) => unknown
  readonly notFoundResult?: unknown
}

/**
 * Run an Effect program with `TableLive` provided and convert the outcome
 * to an MCP `tools/call` JSON-RPC envelope. Success → wraps the value in
 * the `result.content[0].text` slot per the MCP wire format. Either-Left
 * errors collapse to -32603 with the underlying error message.
 */
export async function runProgramAsToolResult<A>(input: RunProgramInput<A>): Promise<McpToolResult> {
  const provided = provideTableLive(input.program)
  const outcome = await Effect.runPromise(Effect.result(provided))

  if (outcome._tag === 'Failure') {
    const message =
      outcome.failure instanceof Error ? outcome.failure.message : String(outcome.failure)
    return toolFailure(-32_603, message)
  }

  const formatted = input.formatSuccess ? input.formatSuccess(outcome.success) : outcome.success
  if (formatted === undefined) {
    return toolSuccess(input.notFoundResult ?? { error: 'Record not in scope' })
  }
  return toolSuccess(formatted)
}

/** Wrap a value in the MCP `content[0].text` success slot. */
export function toolSuccess(data: unknown): McpToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, undefined, 2) }] }
}

/**
 * Fail a `tools/call` with a JSON-RPC PROTOCOL error (`-32602`, `-32603`, …).
 *
 * This must throw rather than return: the SDK v2 handler distinguishes a tool
 * EXECUTION error (returned as a `CallToolResult` with `isError: true`, HTTP
 * 200, inside `result`) from a PROTOCOL error (a JSON-RPC `error` member), and
 * a thrown `ProtocolError` from a low-level `Server` request handler is the
 * only way to produce the latter. Sovrium's RBAC and field-permission denials
 * are asserted as protocol errors by the spec suite
 * (`[internal ref]` → -32603, `[internal ref]` → -32602), so the
 * distinction is load-bearing and not stylistic.
 */
export function toolFailure(code: number, message: string): never {
  // eslint-disable-next-line functional/no-throw-statements -- the SDK surfaces a JSON-RPC protocol error only via a thrown ProtocolError
  throw new ProtocolError(code, message)
}

// ---------------------------------------------------------------------------
// Read-side field-exposure filter (M-10)
// ---------------------------------------------------------------------------

/**
 * System fields that surface in record envelopes and must be preserved
 * regardless of `aiAccess.fieldExposure` mode. They identify and timestamp
 * the record itself; stripping them would break id-based follow-up calls
 * (e.g. `tools/call read` after `tools/call list`).
 */
const ENVELOPE_SYSTEM_FIELDS: ReadonlySet<string> = new Set([
  'id',
  'fields',
  'createdAt',
  'updatedAt',
  'createdBy',
  'updatedBy',
  'deletedBy',
])

/**
 * Field-level system metadata that lives inside the inner `fields` object
 * (snake_case from the database transformer) and is never user-authored.
 * Stripping these would make trash/soft-delete semantics opaque to the AI
 * client; whitelist mode targets user-authored data, not system bookkeeping.
 */
const FIELDS_SYSTEM_KEYS: ReadonlySet<string> = new Set([
  'deleted_at',
  'deleted_by',
  'created_at',
  'updated_at',
  'created_by',
  'updated_by',
])

/**
 * Apply `aiAccess.fieldExposure` to a single record envelope on the read
 * side (list / read tools). The cross-validator already ensured that
 * `'whitelist'` mode is paired with a non-empty `whitelistFields` array
 * at decode time, so when this branch runs the allowlist is guaranteed
 * to be authoritative. RBAC field-level filtering already ran upstream
 * in `filterReadableFields`; this stage layers the *additional*
 * schema-author whitelist on top — the two intersect.
 *
 * Modes:
 * - `'whitelist'`: strip every non-whitelisted user field from both the
 *   nested `fields` object AND the root flat-spread aliases. System
 *   fields (id / timestamps / authorship) are always preserved.
 * - `'all'` and `'permissioned'` (and undefined): pass-through. RBAC has
 *   already filtered fields the caller's role cannot read; this stage
 *   does not narrow further.
 */
export function applyMcpFieldExposureToRecord(
  record: Readonly<Record<string, unknown>>,
  table: Readonly<Table>
): Readonly<Record<string, unknown>> {
  const access = table.aiAccess
  if (typeof access !== 'object') return { ...record }
  if (access.fieldExposure !== 'whitelist') return { ...record }
  const allowed = new Set(access.whitelistFields ?? [])

  // Filter nested `fields` object — user-authored fields outside the
  // whitelist drop; system metadata (deleted_at etc.) survives.
  const { fields } = record
  const filteredFields =
    typeof fields === 'object' && fields !== null && !Array.isArray(fields)
      ? Object.fromEntries(
          Object.entries(fields as Record<string, unknown>).filter(
            ([key]) => allowed.has(key) || FIELDS_SYSTEM_KEYS.has(key)
          )
        )
      : fields

  // Filter root-level flat aliases (read program spreads field values at
  // root) but always preserve the envelope system fields above.
  const filteredRoot = Object.fromEntries(
    Object.entries(record).filter(([key]) => ENVELOPE_SYSTEM_FIELDS.has(key) || allowed.has(key))
  )

  return { ...filteredRoot, fields: filteredFields }
}

/**
 * Vector form: applies `applyMcpFieldExposureToRecord` to every record in
 * a list response. Returns a new array; never mutates the input.
 */
export function applyMcpFieldExposureToRecords(
  records: ReadonlyArray<Readonly<Record<string, unknown>>>,
  table: Readonly<Table>
): ReadonlyArray<Record<string, unknown>> {
  return records.map((record) => applyMcpFieldExposureToRecord(record, table))
}

/**
 * The first `multi-select` contract violation in an MCP write payload —
 * option MEMBERSHIP, then selection CARDINALITY — phrased for a JSON-RPC
 * `-32602 Invalid params` error, or `undefined` when the payload is clean.
 *
 * Why the MCP surface needs its own check. `tool-compiler.ts` advertises the
 * declared options as a JSON Schema `enum` on the tool inputSchema, and its
 * comment there says "the runtime relies on PostgreSQL + the records-API for
 * the authoritative validation". Neither holds on this path: an inputSchema
 * `enum` is a hint an MCP client MAY honour and a sloppy or hostile one simply
 * ignores; the write goes straight to `createRecordProgram` /
 * `updateRecordProgram` without traversing the records-API validation chain in
 * `presentation/api/validation`; and the PostgreSQL CHECK that would otherwise
 * have caught it is deliberately not emitted on SQLite, the shipped default
 * (`sql/sql-check-constraints.ts`). An undeclared option therefore persisted.
 *
 * The rules and the message wording are the records-API's, so an MCP client
 * and an HTTP client get the same answer for the same payload.
 */
export function findFirstMultiSelectViolation(
  table: Table,
  fields: Readonly<Record<string, unknown>>
): string | undefined {
  const undeclared = findUndeclaredMultiSelectValues(table.fields, fields)[0]
  if (undeclared) {
    return `Invalid option for field '${undeclared.field}'. Allowed options: ${undeclared.allowed.join(', ')}`
  }

  const overflow = findMultiSelectSelectionOverflows(table.fields, fields)[0]
  if (overflow) {
    return `Too many selections for field '${overflow.field}'. max selections allowed: ${overflow.maxSelections}`
  }

  return undefined
}
