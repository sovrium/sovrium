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

import { Effect } from 'effect'
import { type Context } from 'hono'
import { provideTableLive } from '@/infrastructure/layers/table-layer'
import type { Table } from '@/domain/models/app'

export interface RunProgramInput<A> {
  readonly c: Readonly<Context>
  readonly responseId: number | string
  readonly program: Effect.Effect<A, unknown, unknown>
  readonly formatSuccess?: (value: A) => unknown
  readonly notFoundResult?: unknown
}

/**
 * Run an Effect program with `TableLive` provided and convert the outcome
 * to an MCP `tools/call` JSON-RPC envelope. Success → wraps the value in
 * the `result.content[0].text` slot per the MCP wire format. Either-Left
 * errors collapse to -32603 with the underlying error message.
 */
export async function runProgramAsToolResult<A>(input: RunProgramInput<A>): Promise<Response> {
  const provided = provideTableLive(
    input.program as Effect.Effect<A, unknown, never>
  ) as Effect.Effect<A, unknown, never>
  const outcome = await Effect.runPromise(Effect.either(provided))

  if (outcome._tag === 'Left') {
    const message = outcome.left instanceof Error ? outcome.left.message : String(outcome.left)
    return jsonRpcError(input.c, input.responseId, -32_603, message)
  }

  const formatted = input.formatSuccess ? input.formatSuccess(outcome.right) : outcome.right
  if (formatted === undefined) {
    const replacement = input.notFoundResult ?? { error: 'Record not in scope' }
    return jsonRpcSuccess(input.c, input.responseId, replacement)
  }
  return jsonRpcSuccess(input.c, input.responseId, formatted)
}

export function jsonRpcSuccess(
  c: Readonly<Context>,
  responseId: number | string,
  data: unknown
): Response {
  return c.json({
    jsonrpc: '2.0',
    id: responseId,
    result: {
      content: [{ type: 'text', text: JSON.stringify(data, undefined, 2) }],
    },
  })
}

export function jsonRpcError(
  c: Readonly<Context>,
  responseId: number | string,
  code: number,
  message: string
): Response {
  return c.json({
    jsonrpc: '2.0',
    id: responseId,
    error: { code, message },
  })
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
): Record<string, unknown> {
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
