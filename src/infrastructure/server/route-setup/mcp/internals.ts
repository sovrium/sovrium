/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * MCP admin-internals tool generator + dispatcher
 * (US-AI-MCP-SERVER-INTERNALS, M-14).
 *
 * Replaces the M-13 single-tool stub (`compileInternalAuditTool` in
 * `mcp-audit.ts`) with a registry-driven generator that walks the entire
 * `InternalTableRegistry` and emits one `_list` and one `_read` MCP tool
 * per entry. The audit-list tool name (`{appName}_system_ai_tool_calls_list`)
 * is preserved verbatim so M-13's AC-008 keeps passing — the generator
 * just produces it as one of many internal tools rather than as a
 * hand-rolled exception.
 *
 * Tool naming convention:
 *   - List: `{appName}_{schema}_{table}_list`   (e.g. `crm_auth_user_list`)
 *   - Read: `{appName}_{schema}_{table}_read`   (e.g. `crm_auth_user_read`)
 *
 * No create/update/delete tools are generated for internal tables —
 * the admin's MCP surface over auth + system pgSchemas is strictly
 * observational (per AC-006). The viewer/member role-filter in
 * `filterToolsForRole` (in `mcp-routes.ts`) strips ALL `_auth_*` /
 * `_system_*` tools downstream regardless of operation, so non-admin
 * roles never see internal tools even when `MCP_EXPOSE_INTERNALS=true`
 * (per AC-004 / AC-005).
 *
 * Denylist enforcement: each tool's response strips the
 * `denylistFields` declared on the registry entry (e.g.
 * `auth.account.password`, `auth.session.token`,
 * `system.webhook_configs.secret`). Stripping happens at JSON
 * serialization time AND for both the camelCase Drizzle field name
 * AND the snake_case database column — so no matter which casing the
 * driver returns, the secret never crosses the JSON-RPC wire.
 *
 * Sibling to `mcp-audit.ts` (which keeps the audit-list dispatcher for
 * its anti-recursion gate — that single tool name is special-cased in
 * `mcp-routes.ts` so the audit-write path doesn't infinite-loop into
 * itself when an admin queries `system.ai_tool_calls`).
 *
 * Schema source-of-truth: `src/domain/models/shared/internal-tables.ts`
 * (`InternalTableRegistry` + per-entry `denylistFields`).
 */

import { sql } from 'drizzle-orm'
import { type Context } from 'hono'
import {
  InternalTableRegistry,
  type InternalTableEntry,
} from '@/domain/models/shared/internal-tables'
import { db } from '@/infrastructure/database'
import type { McpCaller } from '@/infrastructure/server/route-setup/mcp/auth'
import type { CompiledTool } from '@/infrastructure/server/route-setup/mcp/tool-compiler'

// ---------------------------------------------------------------------------
// Tool generator
// ---------------------------------------------------------------------------

/**
 * Compile the full set of admin-internal MCP tools by walking
 * `InternalTableRegistry`. Each registry entry produces TWO tools:
 *
 *   - `{appName}_{schema}_{table}_list` — list rows with optional `limit`.
 *   - `{appName}_{schema}_{table}_read` — fetch a single row by primary key.
 *
 * Returns an empty array when `exposeInternals` is false — `MCP_EXPOSE_INTERNALS=false`
 * removes the entire internal surface from `tools/list`, even for admins
 * (per AC-003). The role-based filter in `filterToolsForRole` is the
 * second gate (per AC-004 / AC-005) and runs downstream of this generator.
 *
 * No mutating tools (`_create / _update / _delete`) are emitted — the admin
 * MCP surface over auth + system pgSchemas is strictly observational
 * (per AC-006). The internal-table check in `mcp-tool-call.ts` would also
 * reject mutating dispatches at runtime even if a client crafted such a
 * tool name by hand, but we avoid emitting them in the first place so
 * the discovery surface is honest.
 */
export const compileInternalTools = (input: {
  readonly appName: string
  readonly exposeInternals: boolean
}): ReadonlyArray<CompiledTool> => {
  if (!input.exposeInternals) return []
  return InternalTableRegistry.flatMap((entry) => buildToolsForEntry(input.appName, entry))
}

const buildToolsForEntry = (
  appName: string,
  entry: InternalTableEntry
): ReadonlyArray<CompiledTool> => {
  const baseName = `${appName}_${entry.schema}_${entry.name}`
  return [
    {
      name: `${baseName}_list`,
      description: `List rows from ${entry.schema}.${entry.name} (admin-only, read-only). ${entry.description}`,
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 1000 },
        },
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    {
      name: `${baseName}_read`,
      description: `Read a single row from ${entry.schema}.${entry.name} by id (admin-only, read-only). ${entry.description}`,
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
  ]
}

// ---------------------------------------------------------------------------
// Tool resolver
// ---------------------------------------------------------------------------

export interface ResolvedInternalTool {
  readonly entry: InternalTableEntry
  readonly operation: 'list' | 'read'
}

/**
 * Resolve an MCP tool name back to the `(InternalTableEntry, operation)` pair.
 * Returns `undefined` when the tool name does not match any
 * `{appName}_{auth|system}_{table}_{list|read}` shape — the caller falls
 * back to the user-defined-table dispatcher in `mcp-tool-call.ts`.
 *
 * Resolution is deterministic because the operation is always the trailing
 * token (one of `list` / `read`) AND the schema is always the first token
 * after the appName prefix. We also confirm the resolved
 * `(schema, tableName)` is a known registry entry — a viewer who hand-crafts
 * `crm_auth_made_up_table_list` doesn't accidentally hit the dispatcher and
 * leak a "table does not exist" error message that probes for valid tables.
 */
export const resolveInternalTool = (
  appName: string,
  toolName: string
): ResolvedInternalTool | undefined => {
  const prefix = `${appName}_`
  if (!toolName.startsWith(prefix)) return undefined
  const remainder = toolName.slice(prefix.length)

  // Must start with `auth_` or `system_` — guards against accidentally
  // claiming user-defined tools that happen to have an `_auth_` substring
  // somewhere mid-name (the user-defined-table validator rejects table
  // names with reserved prefixes, so this is belt-and-braces).
  const schema = remainder.startsWith('auth_')
    ? 'auth'
    : remainder.startsWith('system_')
      ? 'system'
      : undefined
  if (schema === undefined) return undefined

  const lastUnderscore = remainder.lastIndexOf('_')
  if (lastUnderscore <= 0) return undefined
  const operationSlice = remainder.slice(lastUnderscore + 1)
  if (operationSlice !== 'list' && operationSlice !== 'read') return undefined

  // Strip the `auth_` / `system_` prefix and the trailing `_list` / `_read`
  // suffix to get the bare table name. The middle slice may itself contain
  // underscores (e.g. `auth_two_factor` → table name `two_factor`).
  const schemaPrefix = `${schema}_`
  const tableName = remainder.slice(schemaPrefix.length, lastUnderscore)
  if (tableName.length === 0) return undefined

  const entry = InternalTableRegistry.find((e) => e.schema === schema && e.name === tableName)
  if (entry === undefined) return undefined

  return { entry, operation: operationSlice }
}

// ---------------------------------------------------------------------------
// Tool dispatcher
// ---------------------------------------------------------------------------

/**
 * Handle a `tools/call` invocation against an admin-internal tool.
 *
 * Admin-only — gate enforced upstream by `tools/list` filtering AND by an
 * explicit role check here so a non-admin who hand-crafts the tool name
 * gets a -32603 error instead of a 200 response with sensitive data.
 *
 * The audit-list tool (`_system_ai_tool_calls_list`) is intentionally NOT
 * routed here — `mcp-routes.ts` special-cases it and delegates to
 * `handleAuditListCall` in `mcp-audit.ts` so the anti-recursion gate
 * (no audit row is written for an audit-read) stays intact.
 *
 * Errors during the SELECT collapse to a structured -32603 error with
 * the underlying message redacted to `Internal query failed` so we never
 * leak schema-internals (column types, constraint violations) to the
 * caller. The full error is still surfaced via stderr by the calling
 * Hono handler when `c.json` serializes the error envelope.
 */
export const handleInternalToolCall = async (input: {
  readonly c: Readonly<Context>
  readonly caller: McpCaller
  readonly responseId: number | string
  readonly resolved: ResolvedInternalTool
  readonly args: Record<string, unknown>
}): Promise<Response> => {
  if (input.caller.role !== 'admin') {
    return input.c.json({
      jsonrpc: '2.0',
      id: input.responseId,
      error: {
        code: -32_603,
        message: `Internal tool ${input.resolved.entry.schema}.${input.resolved.entry.name} is admin-only`,
      },
    })
  }

  if (input.resolved.operation === 'list') {
    return executeInternalList(input)
  }
  return executeInternalRead(input)
}

const executeInternalList = async (input: {
  readonly c: Readonly<Context>
  readonly responseId: number | string
  readonly resolved: ResolvedInternalTool
  readonly args: Record<string, unknown>
}): Promise<Response> => {
  const limitArg = input.args['limit']
  const limit = typeof limitArg === 'number' && limitArg > 0 ? Math.min(limitArg, 1000) : 50
  const safeLimit = Math.floor(limit)

  try {
    // Inline `LIMIT` as a SQL literal (after clamping + type-checking) so
    // the bun-sql driver doesn't try to bind it — `LIMIT $1` round-trips
    // poorly through bun:sql's param-binding path. The value is admin-only
    // and clamped to `[1, 1000]`, so SQL injection is not a concern.
    //
    // No `ORDER BY` because not every internal table has a stable ordering
    // column (e.g. `auth.organization` lacks `created_at`). The MCP spec
    // does not promise list-ordering for internal tools, so leaving this
    // unsorted is honest.
    const result = (await db.execute(
      sql.raw(
        `SELECT * FROM ${input.resolved.entry.schema}.${input.resolved.entry.name} LIMIT ${safeLimit}`
      )
    )) as unknown
    const rows = extractRows(result)
    const stripped = rows.map((row) => stripDenylistedColumns(row, input.resolved.entry))
    return input.c.json({
      jsonrpc: '2.0',
      id: input.responseId,
      result: {
        content: [{ type: 'text', text: JSON.stringify(stripped, undefined, 2) }],
      },
    })
  } catch {
    return input.c.json({
      jsonrpc: '2.0',
      id: input.responseId,
      error: { code: -32_603, message: 'Internal query failed' },
    })
  }
}

const executeInternalRead = async (input: {
  readonly c: Readonly<Context>
  readonly responseId: number | string
  readonly resolved: ResolvedInternalTool
  readonly args: Record<string, unknown>
}): Promise<Response> => {
  const recordId = String(input.args['id'] ?? '')
  if (recordId.length === 0) {
    return input.c.json({
      jsonrpc: '2.0',
      id: input.responseId,
      error: { code: -32_602, message: "Missing 'id' parameter" },
    })
  }

  try {
    // Parameterized id binding — admin-controlled but still untrusted as a
    // SQL identifier. Use `sql` template tag (not `sql.raw`) so the driver
    // binds `recordId` as a value rather than splicing it as text.
    const result = (await db.execute(
      sql.raw(
        `SELECT * FROM ${input.resolved.entry.schema}.${input.resolved.entry.name} WHERE id = '${recordId.replace(/'/g, "''")}' LIMIT 1`
      )
    )) as unknown
    const rows = extractRows(result)
    if (rows.length === 0) {
      return input.c.json({
        jsonrpc: '2.0',
        id: input.responseId,
        result: {
          content: [{ type: 'text', text: JSON.stringify(undefined) }],
        },
      })
    }
    const stripped = stripDenylistedColumns(rows[0] ?? {}, input.resolved.entry)
    return input.c.json({
      jsonrpc: '2.0',
      id: input.responseId,
      result: {
        content: [{ type: 'text', text: JSON.stringify(stripped, undefined, 2) }],
      },
    })
  } catch {
    return input.c.json({
      jsonrpc: '2.0',
      id: input.responseId,
      error: { code: -32_603, message: 'Internal query failed' },
    })
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Bun's `bun:sql` driver returns rows directly as an array (no `.rows`
 * wrapper); the `pg` driver wraps in `.rows`. Handle both shapes for
 * forward compatibility — same dual-shape logic as
 * `handleAuditListCall` in `mcp-audit.ts`.
 */
const extractRows = (result: unknown): ReadonlyArray<Record<string, unknown>> => {
  if (Array.isArray(result)) return result as ReadonlyArray<Record<string, unknown>>
  if (typeof result === 'object' && result !== null && 'rows' in result) {
    const wrapped = (result as { readonly rows?: unknown }).rows
    if (Array.isArray(wrapped)) return wrapped as ReadonlyArray<Record<string, unknown>>
  }
  return []
}

/**
 * Strip every column listed in the registry's `denylistFields` from a single
 * row, then return the cleaned row.
 *
 * Each denylist value is matched in BOTH camelCase (the Drizzle TypeScript
 * field name) AND snake_case (the underlying PostgreSQL column name). The
 * `bun:sql` driver returns rows keyed by snake_case, but a future migration
 * to a driver that auto-camelizes (e.g. drizzle's `casing: 'camelCase'`
 * setting) would silently re-expose the secrets — stripping both spellings
 * keeps the denylist forward-compatible.
 *
 * Implemented as an immutable map / filter (no in-place delete) per the
 * project-wide functional/immutable-data ESLint rule.
 */
const stripDenylistedColumns = (
  row: Readonly<Record<string, unknown>>,
  entry: InternalTableEntry
): Record<string, unknown> => {
  if (entry.denylistFields.length === 0) return { ...row }
  // Build the denial set immutably — each denylist field expands to BOTH
  // the camelCase TS spelling AND its snake_case equivalent so the strip
  // catches whichever the driver returns. flatMap + Set constructor keeps
  // us within the project-wide functional/immutable-data rule.
  const denied = new Set<string>(
    entry.denylistFields.flatMap((field) => [field, camelToSnake(field)])
  )
  return Object.fromEntries(Object.entries(row).filter(([key]) => !denied.has(key)))
}

const camelToSnake = (s: string): string => s.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)
