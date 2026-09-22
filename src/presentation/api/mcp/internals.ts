/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * MCP admin-internals tool generator + dispatcher
 *.
 *
 * Replaces the M-13 single-tool stub (`compileInternalAuditTool` in
 * `mcp-audit.ts`) with a registry-driven generator that walks the entire
 * `InternalTableRegistry` and emits one `_list` and one `_read` MCP tool
 * per entry. The audit-list tool name (`{appName}_system_ai_tool_calls_list`)
 * is preserved verbatim so M-13's [internal ref] keeps passing — the generator
 * just produces it as one of many internal tools rather than as a
 * hand-rolled exception.
 *
 * Tool naming convention:
 *   - List: `{appName}_{schema}_{table}_list`   (e.g. `crm_auth_user_list`)
 *   - Read: `{appName}_{schema}_{table}_read`   (e.g. `crm_auth_user_read`)
 *
 * No create/update/delete tools are generated for internal tables —
 * the admin's MCP surface over auth + system pgSchemas is strictly
 * observational. The viewer/member role-filter in
 * `filterToolsForRole` (in `mcp-routes.ts`) strips ALL `_auth_*` /
 * `_system_*` tools downstream regardless of operation, so non-admin
 * roles never see internal tools even when `MCP_EXPOSE_INTERNALS=true`
 *.
 *
 * Denylist enforcement: each tool's response strips the
 * `denylistFields` declared on the registry entry (e.g.
 * `auth.account.password`, `auth.session.token`,
 * `system.webhook_configs.secret`). Stripping happens at JSON
 * serialization time AND for both the camelCase Drizzle field name
 * AND the snake_case database column — so no matter which casing the
 * driver returns, the secret never crosses the JSON-RPC wire.
 *
 * Sibling to `mcp-audit.ts`, which keeps its own audit-list dispatcher: that
 * single tool name is special-cased in `mcp-routes.ts` and never reaches this
 * module, because the handler there projects 12 named columns while the
 * generic `_list` below answers `SELECT *` — and `ai_tool_calls` declares
 * `denylistFields: []`, so `session_id` and `request_id` would survive to the
 * wire. `[internal ref]` pins the difference.
 *
 * Until 2026-08-27 this said the special-casing stops the audit-write path
 * "infinite-looping into itself". No such loop exists or ever did: dispatch
 * here happens outside `auditedToolsCallDispatch`, so this module writes no
 * audit row at all. The constraint is data exposure, not recursion.
 *
 * Schema source-of-truth: `src/domain/models/app/tables/internal-tables.ts`
 * (`InternalTableRegistry` + per-entry `denylistFields`).
 */

import { Effect } from 'effect'
import { McpInternalsRepository } from '@/application/ports/repositories/mcp/mcp-internals-repository'
import { isAdminRole } from '@/domain/models/app/auth/permission-evaluation'
import {
  InternalTableRegistry,
  type InternalTableEntry,
} from '@/domain/models/app/tables/internal-tables'
import { runOnDomain } from '@/infrastructure/logging/request-effect'
import { toolFailure, toolSuccess, type McpToolResult } from './tool-call-helpers'
import type { DomainContext } from '@/infrastructure/logging/request-effect'
import type { McpCaller } from '@/presentation/api/mcp/auth'
import type { CompiledTool } from '@/presentation/api/mcp/tool-compiler'

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
 *. The role-based filter in `filterToolsForRole` is the
 * second gate and runs downstream of this generator.
 *
 * No mutating tools (`_create / _update / _delete`) are emitted — the admin
 * MCP surface over auth + system pgSchemas is strictly observational
 *. The internal-table check in `mcp-tool-call.ts` would also
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
 * `handleAuditListCall` in `mcp-audit.ts`, whose explicit 12-column projection
 * withholds `session_id` and `request_id`. The `SELECT *` below would expose
 * both, since `ai_tool_calls` declares `denylistFields: []`. That is the
 * reason for the ordering — not the "no audit row is written for an
 * audit-read" property claimed here until 2026-08-27, which holds on this
 * path too and so distinguishes nothing.
 *
 * Errors during the SELECT collapse to a structured -32603 error with
 * the underlying message redacted to `Internal query failed` so we never
 * leak schema-internals (column types, constraint violations) to the
 * caller. The full error is still surfaced via stderr by the calling
 * Hono handler when `c.json` serializes the error envelope.
 */
export const handleInternalToolCall = async (input: {
  readonly caller: McpCaller
  readonly resolved: ResolvedInternalTool
  readonly args: Record<string, unknown>
  readonly domainContext: DomainContext
}): Promise<McpToolResult> => {
  if (!isAdminRole(input.caller.role)) {
    return toolFailure(
      -32_603,
      `Internal tool ${input.resolved.entry.schema}.${input.resolved.entry.name} is admin-only`
    )
  }

  if (input.resolved.operation === 'list') {
    return executeInternalList(input)
  }
  return executeInternalRead(input)
}

const executeInternalList = async (input: {
  readonly resolved: ResolvedInternalTool
  readonly args: Record<string, unknown>
  readonly domainContext: DomainContext
}): Promise<McpToolResult> => {
  const limitArg = input.args['limit']
  const limit = typeof limitArg === 'number' && limitArg > 0 ? Math.min(limitArg, 1000) : 50
  const safeLimit = Math.floor(limit)

  try {
    // The dialect-aware table reference and the unordered `SELECT` now live in
    // `McpInternalsRepository`, which takes the registry ENTRY rather than a
    // name so the `auth` / `system` namespacing decision cannot be made at a
    // call site. The clamp stays here: it is this tool's argument validation.
    const rows = await runOnDomain(
      input.domainContext,
      Effect.gen(function* () {
        const repository = yield* McpInternalsRepository
        return yield* repository.listRows(input.resolved.entry, safeLimit)
      })
    )
    const stripped = rows.map((row) => stripDenylistedColumns(row, input.resolved.entry))
    return toolSuccess(stripped)
  } catch {
    return toolFailure(-32_603, 'Internal query failed')
  }
}

const executeInternalRead = async (input: {
  readonly resolved: ResolvedInternalTool
  readonly args: Record<string, unknown>
  readonly domainContext: DomainContext
}): Promise<McpToolResult> => {
  const recordId = String(input.args['id'] ?? '')
  if (recordId.length === 0) {
    return toolFailure(-32_602, "Missing 'id' parameter")
  }

  try {
    // `recordId` is first-order user input (`args.id` off the JSON-RPC
    // envelope). It is bound as a VALUE inside the repository, never spliced as
    // text — quote doubling is not an escaping strategy, it is a coincidence
    // that holds until the first backslash or dollar-quote (S3).
    const row = await runOnDomain(
      input.domainContext,
      Effect.gen(function* () {
        const repository = yield* McpInternalsRepository
        return yield* repository.readRow(input.resolved.entry, recordId)
      })
    )
    if (row === undefined) {
      return toolSuccess(undefined)
    }
    const stripped = stripDenylistedColumns(row, input.resolved.entry)
    return toolSuccess(stripped)
  } catch {
    return toolFailure(-32_603, 'Internal query failed')
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
): Readonly<Record<string, unknown>> => {
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
