/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * MCP `tools/call` dispatcher (US-AI-MCP-SERVER-RBAC, M-6).
 *
 * Translates a JSON-RPC `tools/call` request into the same application-layer
 * programs that the HTTP record handlers run, so RBAC, field-level read /
 * write permissions, Z-3 row-level enforcement, and soft-delete semantics
 * all flow through one authorization pipeline.
 *
 * Tool naming convention compiled by `mcp-routes.ts#compileMcpTools`:
 *   `{appName}_{tableName}_{operation}` where operation ∈ {read, list, create, update, delete}
 *
 * Error model — JSON-RPC 2.0 error codes mapped to authorization outcomes:
 *   -32601 method not found  → unknown tool name
 *   -32602 invalid params    → field-level write permission denied; bad shape
 *   -32603 internal error    → role/operation gate denied (RBAC); runtime fault
 */

import { Effect } from 'effect'
import { type Context } from 'hono'
import {
  collectAssignmentScopeTables,
  loadCurrentUserContext,
  toSessionProjection,
} from '@/application/use-cases/tables/permissions/row-level-enforcement'
import {
  createGetRecordProgram,
  createListRecordsProgram,
  createRecordProgram,
  deleteRecordProgram,
  updateRecordProgram,
} from '@/application/use-cases/tables/programs'
import { hasPermission } from '@/domain/models/app/tables/permissions'
import { isAiAccessEnabled } from '@/domain/models/shared/ai-access'
import {
  evaluateRecordAgainstPredicate,
  projectPredicateToFilter,
  type CurrentUserContext,
} from '@/domain/validators/row-level-evaluator'
import { provideTableLive } from '@/infrastructure/layers/table-layer'
import { handleActionCall, resolveActionTemplateTool } from './action-call'
import { handleAutomationCall, resolveAutomationTool } from './automation-call'
import {
  applyMcpFieldExposureToRecord,
  applyMcpFieldExposureToRecords,
  jsonRpcError,
  jsonRpcSuccess,
  runProgramAsToolResult,
} from './tool-call-helpers'
import type { McpCaller } from './auth'
import type { UserSession } from '@/application/ports/models/user-session'
import type { App, Table } from '@/domain/models/app'
import type { AiAccess, AiAccessOperation } from '@/domain/models/shared/ai-access'

const SUPPORTED_OPERATIONS: ReadonlySet<AiAccessOperation> = new Set([
  'read',
  'list',
  'create',
  'update',
  'delete',
])

interface CallEnvelope {
  readonly toolName: string
  readonly args: Record<string, unknown>
  readonly responseId: number | string
}

interface ResolvedTool {
  readonly table: Table
  readonly operation: AiAccessOperation
}

/**
 * Entry point for the MCP `tools/call` handler. Returns a Hono Response
 * carrying a JSON-RPC envelope (success or error). Never throws — every
 * authorization or runtime fault collapses to a structured -32603 error so
 * the client always sees a parseable JSON-RPC body.
 */
export async function handleToolsCall(
  c: Readonly<Context>,
  app: App,
  caller: McpCaller,
  envelope: CallEnvelope
): Promise<Response> {
  // M-8: Manual-trigger automation tools take precedence over the
  // table-record dispatcher because the `_automation_` infix is
  // unambiguous (table tools end in one of the 5 CRUD operation
  // suffixes; automation tools live under a dedicated infix).
  const automation = resolveAutomationTool(app, envelope.toolName)
  if (automation !== undefined) {
    return handleAutomationCall({ c, app, caller, automation, envelope })
  }

  // M-9: Action-template tools share the same infix-based separation as
  // automation tools. The `_action_` infix is unambiguous against table
  // tools (which always end in a CRUD operation suffix), so the order of
  // these two prefix probes is incidental — kept symmetric with M-8 so
  // each dispatcher's resolver has the first chance to claim a tool name
  // it owns.
  const template = resolveActionTemplateTool(app, envelope.toolName)
  if (template !== undefined) {
    return handleActionCall({ c, app, caller, template, envelope })
  }

  const resolved = resolveTool(app, envelope.toolName)
  if (resolved === undefined) {
    return jsonRpcError(c, envelope.responseId, -32_601, `Tool not found: ${envelope.toolName}`)
  }

  const opGateError = checkOperationGate(resolved.table, resolved.operation, caller.role)
  if (opGateError !== undefined) {
    return jsonRpcError(c, envelope.responseId, -32_603, opGateError)
  }

  return executeTool({ c, app, caller, envelope, resolved })
}

/**
 * Map a tool name like `crm_contacts_list` back to the source table +
 * operation. The split is deterministic because the operation is always the
 * trailing token (one of read/list/create/update/delete) and the appName
 * prefix matches `app.name`.
 */
function resolveTool(app: App, toolName: string): ResolvedTool | undefined {
  const prefix = `${app.name}_`
  if (!toolName.startsWith(prefix)) return undefined
  const remainder = toolName.slice(prefix.length)
  const lastUnderscore = remainder.lastIndexOf('_')
  if (lastUnderscore <= 0) return undefined

  const operation = remainder.slice(lastUnderscore + 1) as AiAccessOperation
  if (!SUPPORTED_OPERATIONS.has(operation)) return undefined

  const tableName = remainder.slice(0, lastUnderscore)
  const table = (app.tables ?? []).find((t) => t.name === tableName)
  if (table === undefined) return undefined
  if (!isAiAccessEnabled(table.aiAccess)) return undefined
  if (!isOperationAllowedByAiAccess(table.aiAccess, operation)) return undefined
  return { table, operation }
}

function isOperationAllowedByAiAccess(
  access: AiAccess | undefined,
  operation: AiAccessOperation
): boolean {
  if (access === undefined || typeof access === 'boolean') return true
  if (access.operations === undefined) return true
  return access.operations.includes(operation)
}

/**
 * RBAC role-gate at the operation level. Mirrors `filterToolsForRole` in
 * `mcp-routes.ts` (which hides destructive tools from viewers in
 * `tools/list`) but enforced again at `tools/call` time so a viewer who
 * crafts the tool name by hand still gets a -32603 instead of a 200.
 */
function checkOperationGate(
  _table: Table,
  operation: AiAccessOperation,
  role: McpCaller['role']
): string | undefined {
  if (role !== 'viewer') return undefined
  if (operation === 'create' || operation === 'update' || operation === 'delete') {
    return `Operation '${operation}' is not permitted for the viewer role`
  }
  return undefined
}

interface ExecuteToolInput {
  readonly c: Readonly<Context>
  readonly app: App
  readonly caller: McpCaller
  readonly envelope: CallEnvelope
  readonly resolved: ResolvedTool
}

/**
 * Dispatch the resolved (table, operation) pair to the matching application
 * program. Each branch wraps the program in `provideTableLive` and converts
 * thrown / Either errors into JSON-RPC -32603. Authorization-time errors
 * (field-write violation, scoped-row-out-of-bounds, soft-deleted) bubble
 * up as -32602 / -32603 per the user-story spec.
 */
async function executeTool(input: ExecuteToolInput): Promise<Response> {
  const { c, app, caller, envelope, resolved } = input
  const { operation, table } = resolved
  const session = synthesizeSession(caller.userId)

  if (operation === 'list') {
    return executeList({ c, app, caller, envelope, table, session })
  }
  if (operation === 'read') {
    return executeRead({ c, app, caller, envelope, table, session })
  }
  if (operation === 'create') {
    return executeCreate({ c, app, caller, envelope, table, session })
  }
  if (operation === 'update') {
    return executeUpdate({ c, app, caller, envelope, table, session })
  }
  return executeDelete({ c, app, caller, envelope, table, session })
}

interface ExecBranchInput {
  readonly c: Readonly<Context>
  readonly app: App
  readonly caller: McpCaller
  readonly envelope: CallEnvelope
  readonly table: Table
  readonly session: UserSession
}

async function executeList(input: ExecBranchInput): Promise<Response> {
  const { c, app, caller, envelope, table, session } = input
  const limitArg = envelope.args['limit']
  const limit = typeof limitArg === 'number' ? limitArg : undefined
  const offsetArg = envelope.args['offset']
  const offset = typeof offsetArg === 'number' ? offsetArg : undefined

  const userCtx = await resolveUserContextOrUndefined(caller, table)
  const filter = buildReadListFilter(table, userCtx)
  if (filter === 'empty') {
    return jsonRpcSuccess(c, envelope.responseId, [])
  }
  if (filter === 'reject') {
    return jsonRpcSuccess(c, envelope.responseId, [])
  }

  return runProgramAsToolResult({
    c,
    responseId: envelope.responseId,
    program: createListRecordsProgram({
      session,
      tableName: table.name,
      app,
      userRole: caller.role,
      filter: filter ?? undefined,
      limit,
      offset,
    }),
    formatSuccess: (out) => {
      const records = (out as { records?: ReadonlyArray<Record<string, unknown>> }).records ?? []
      // M-10: Apply schema-author-declared field-exposure whitelist on top
      // of the per-role RBAC filter that already ran in `processRecords`.
      // Pass-through for `'all'` and `'permissioned'` modes — RBAC is the
      // only narrowing in those modes.
      return applyMcpFieldExposureToRecords(records, table)
    },
  })
}

async function executeRead(input: ExecBranchInput): Promise<Response> {
  const { c, app, caller, envelope, table, session } = input
  const recordId = String(envelope.args['id'] ?? '')
  if (!recordId) {
    return jsonRpcError(c, envelope.responseId, -32_602, "Missing 'id' parameter")
  }

  const userCtx = await resolveUserContextOrUndefined(caller, table)
  return runProgramAsToolResult({
    c,
    responseId: envelope.responseId,
    program: createGetRecordProgram({
      session,
      tableName: table.name,
      recordId,
      app,
      userRole: caller.role,
    }),
    formatSuccess: (out) => {
      const record = out as Record<string, unknown>
      if (!recordPassesReadPredicate(table, record, userCtx)) return undefined
      // M-10: Strip non-whitelisted fields from both the nested `fields`
      // object and the root flat-spread aliases when whitelist mode is on.
      return applyMcpFieldExposureToRecord(record, table)
    },
    notFoundResult: undefined,
  })
}

async function executeCreate(input: ExecBranchInput): Promise<Response> {
  const { c, app, caller, envelope, table, session } = input
  const fields = extractFields(envelope.args)
  const whitelistError = findFirstWhitelistViolation(table, fields)
  if (whitelistError !== undefined) {
    return jsonRpcError(
      c,
      envelope.responseId,
      -32_602,
      `Field '${whitelistError}' is not in aiAccess.whitelistFields`
    )
  }
  const writeError = findFirstFieldWriteViolation(table, caller.role, fields)
  if (writeError !== undefined) {
    return jsonRpcError(
      c,
      envelope.responseId,
      -32_602,
      `Cannot write to field '${writeError}': insufficient permissions`
    )
  }

  return runProgramAsToolResult({
    c,
    responseId: envelope.responseId,
    program: createRecordProgram({
      session,
      tableName: table.name,
      fields,
      app,
      userRole: caller.role,
    }),
  })
}

async function executeUpdate(input: ExecBranchInput): Promise<Response> {
  const { c, app, caller, envelope, table, session } = input
  const recordId = String(envelope.args['id'] ?? '')
  if (!recordId) {
    return jsonRpcError(c, envelope.responseId, -32_602, "Missing 'id' parameter")
  }
  const fields = extractFields(envelope.args)
  const whitelistError = findFirstWhitelistViolation(table, fields)
  if (whitelistError !== undefined) {
    return jsonRpcError(
      c,
      envelope.responseId,
      -32_602,
      `Field '${whitelistError}' is not in aiAccess.whitelistFields`
    )
  }
  const writeError = findFirstFieldWriteViolation(table, caller.role, fields)
  if (writeError !== undefined) {
    return jsonRpcError(
      c,
      envelope.responseId,
      -32_602,
      `Cannot write to field '${writeError}': insufficient permissions`
    )
  }

  return runProgramAsToolResult({
    c,
    responseId: envelope.responseId,
    program: updateRecordProgram(session, table.name, recordId, {
      fields,
      app,
      userRole: caller.role,
    }),
  })
}

async function executeDelete(input: ExecBranchInput): Promise<Response> {
  const { c, app, envelope, table, session } = input
  const recordId = String(envelope.args['id'] ?? '')
  if (!recordId) {
    return jsonRpcError(c, envelope.responseId, -32_602, "Missing 'id' parameter")
  }
  return runProgramAsToolResult({
    c,
    responseId: envelope.responseId,
    program: deleteRecordProgram(session, table.name, recordId, app),
  })
}

/**
 * Walk the requested fields and return the first field name the role lacks
 * write permission on (per `table.permissions.fields[].write`). Returns
 * `undefined` when every requested field is writable. Mirrors the
 * `validateFieldWritePermissions` helper in `presentation/api/utils/field-permission-validator`
 * but inlined here because `infrastructure-server` cannot import from
 * `presentation-api-util` per the layer boundary rules.
 */
function findFirstFieldWriteViolation(
  table: Table,
  role: McpCaller['role'],
  fields: Readonly<Record<string, unknown>>
): string | undefined {
  const fieldPerms = table.permissions?.fields
  if (!fieldPerms) return undefined
  return Object.keys(fields).find((fieldName) => {
    const fieldPermission = fieldPerms.find((fp) => fp.field === fieldName)
    return fieldPermission?.write !== undefined && !hasPermission(fieldPermission.write, role)
  })
}

/**
 * When `aiAccess.fieldExposure: 'whitelist'` is set, reject any payload that
 * references a field outside `aiAccess.whitelistFields`. Returns the first
 * non-whitelisted field name, or `undefined` when the table has no whitelist
 * declared (other exposure modes pass through unchanged).
 */
function findFirstWhitelistViolation(
  table: Table,
  fields: Readonly<Record<string, unknown>>
): string | undefined {
  const access = table.aiAccess
  if (typeof access !== 'object') return undefined
  if (access.fieldExposure !== 'whitelist') return undefined
  const allowed = new Set(access.whitelistFields ?? [])
  return Object.keys(fields).find((fieldName) => !allowed.has(fieldName))
}

/**
 * Extract the JSON-RPC params payload as a plain field map. Accepts either
 * `{ data: { ... } }` (canonical shape advertised in the input schema) or
 * a flat `{ field: value, ... }` shape (more ergonomic for AI-generated
 * payloads). The flat shape strips the `id` key (used as the path param).
 */
function extractFields(args: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const { data } = args
  if (isPlainObject(data)) {
    return { ...data }
  }
  const { id: _id, limit: _limit, offset: _offset, ...rest } = args
  return rest
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object') return false
  if (value === undefined) return false
  if (value === null) return false
  return !Array.isArray(value)
}

/**
 * Build a synthetic UserSession suitable for the application-layer
 * programs. With static-token strategy `userId` is `undefined`; the
 * authorship helpers tolerate this and fall back to `null` for
 * created_by / updated_by columns. The four `null`s are required by
 * the Better Auth-shaped UserSession contract — the fields are not
 * meaningful for an MCP-issued session but the typed shape demands them.
 */
function synthesizeSession(userId: string | undefined): UserSession {
  const now = new Date()
  /* eslint-disable unicorn/no-null -- UserSession fields are typed string | null */
  return {
    id: 'mcp-session',
    userId: userId ?? '',
    token: 'mcp-bearer',
    expiresAt: now,
    createdAt: now,
    updatedAt: now,
    ipAddress: null,
    userAgent: null,
    impersonatedBy: null,
    activeOrganizationId: null,
  }
  /* eslint-enable unicorn/no-null */
}

/**
 * Build the Z-3 read-side filter for list queries. Returns:
 *   - `undefined`  → no row-level predicate (or admin bypass) — list everything
 *   - `'empty'`    → predicate resolves to "match nothing" (e.g. user has no
 *                    user_access rows for the scope) — caller short-circuits
 *   - `'reject'`   → predicate could not be projected — same short-circuit
 *   - `{ and }`    → AND clause to merge with the request filter
 */
function buildReadListFilter(
  table: Table,
  ctx: CurrentUserContext | undefined
):
  | undefined
  | 'empty'
  | 'reject'
  | { readonly and: readonly { field: string; operator: string; value: unknown }[] } {
  const rlp = table.rowLevelPermissions
  if (!rlp?.read?.when) return undefined
  if (!ctx || ctx.isUnrestricted) return undefined

  const projected = projectPredicateToFilter(rlp.read.when, ctx)
  if (!projected) return 'reject'
  if (
    projected.operator === 'in' &&
    Array.isArray(projected.value) &&
    projected.value.length === 0
  ) {
    return 'empty'
  }
  return { and: [projected] }
}

/**
 * Apply the row-level read predicate to a single fetched record. Returns
 * true when the record is in scope for the caller, false otherwise.
 */
function recordPassesReadPredicate(
  table: Table,
  record: Readonly<Record<string, unknown>>,
  ctx: CurrentUserContext | undefined
): boolean {
  const predicate = table.rowLevelPermissions?.read?.when
  if (!predicate) return true
  if (!ctx || ctx.isUnrestricted) return true
  return evaluateRecordAgainstPredicate(record, predicate, ctx)
}

/**
 * Resolve a `CurrentUserContext` from the OAuth-authenticated caller. Returns
 * `undefined` when no userId is available (static-token strategy) — Z-3
 * filtering is skipped in that case, matching the user-story decision that
 * static tokens are operator-issued and have no per-user identity.
 */
async function resolveUserContextOrUndefined(
  caller: McpCaller,
  table: Table
): Promise<CurrentUserContext | undefined> {
  if (!caller.userId) return undefined
  const projection = toSessionProjection(
    { userId: caller.userId },
    { role: caller.role, isUnrestricted: caller.role === 'admin' }
  )
  const scopeTables = collectAssignmentScopeTables(table.rowLevelPermissions)
  return Effect.runPromise(provideTableLive(loadCurrentUserContext(projection, scopeTables)))
}
