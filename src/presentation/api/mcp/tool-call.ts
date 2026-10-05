/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * MCP `tools/call` dispatcher.
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
import { createListRecordsProgram } from '@/application/use-cases/tables/list-records-program'
import {
  loadCurrentUserContext,
  toSessionProjection,
} from '@/application/use-cases/tables/permissions/row-level-enforcement'
import { createGetRecordProgram } from '@/application/use-cases/tables/read-record-programs'
import { deleteRecordProgram } from '@/application/use-cases/tables/record-lifecycle-programs'
import { getUserAccessRoles, getUserGroups } from '@/application/use-cases/tables/user-groups'
import {
  createRecordProgram,
  updateRecordProgram,
} from '@/application/use-cases/tables/write-record-programs'
import { isAiAccessEnabled, toolSafeTableName } from '@/domain/models/app/auth/ai-access'
import { isGuestSession } from '@/domain/models/app/auth/guest-session'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles'
import { isRecordKeyShaped } from '@/domain/models/app/tables/record-id-service'
import { type CurrentUserContext } from '@/domain/models/app/tables/row-level-evaluator-service'
import { provideTableLive } from '@/infrastructure/layers/table-layer'
import { runOnDomain } from '@/infrastructure/logging/request-effect'
import { handleActionCall, resolveActionTemplateTool } from './action-call'
import { handleAutomationCall, resolveAutomationTool } from './automation-call'
import {
  findFirstFieldWriteViolation,
  passesTablePermission,
  resolveCallerAuthority,
  type CallerAuthority,
} from './caller-authority'
import { buildReadListFilter, recordPassesReadPredicate } from './row-level-read-gate'
import { createIsInScope, existingRowIsInScope } from './row-level-write-gate'
import {
  applyMcpFieldExposureToRecord,
  applyMcpFieldExposureToRecords,
  toolFailure,
  toolSuccess,
  type McpToolResult,
  runProgramAsToolResult,
} from './tool-call-helpers'
import { applyCreateRules, applyUpdateRules, refuseLockedRecord } from './write-tool-rules'
import type { McpCaller } from './auth'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { LinkReader } from '@/application/use-cases/tables/linked-row-visibility'
import type { App, Table } from '@/domain/models/app'
import type { AiAccess, AiAccessOperation } from '@/domain/models/app/auth/ai-access'
import type { DomainContext } from '@/infrastructure/logging/request-effect'

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
  app: App,
  caller: McpCaller,
  envelope: CallEnvelope,
  domainContext: DomainContext
): Promise<McpToolResult> {
  // M-8: Manual-trigger automation tools take precedence over the
  // table-record dispatcher because the `_automation_` infix is
  // unambiguous (table tools end in one of the 5 CRUD operation
  // suffixes; automation tools live under a dedicated infix).
  const automation = resolveAutomationTool(app, envelope.toolName)
  if (automation !== undefined) {
    return handleAutomationCall({ app, caller, automation, envelope, domainContext })
  }

  // M-9: Action-template tools share the same infix-based separation as
  // automation tools. The `_action_` infix is unambiguous against table
  // tools (which always end in a CRUD operation suffix), so the order of
  // these two prefix probes is incidental — kept symmetric with M-8 so
  // each dispatcher's resolver has the first chance to claim a tool name
  // it owns.
  const template = resolveActionTemplateTool(app, envelope.toolName)
  if (template !== undefined) {
    // `tools/list` withholds every action from a viewer (an action is a side
    // effect by definition); a hand-named call is refused the same way, since
    // an action template declares no role gate of its own.
    if (caller.role === 'viewer') {
      return toolFailure(-32_603, "Operation 'action' is not permitted for the viewer role")
    }
    return handleActionCall({ app, caller, template, envelope, domainContext })
  }

  const resolved = resolveTool(app, envelope.toolName)
  if (resolved === undefined) {
    return toolFailure(-32_601, `Tool not found: ${envelope.toolName}`)
  }

  const opGateError = checkOperationGate(resolved.table, resolved.operation, caller.role)
  if (opGateError !== undefined) {
    return toolFailure(-32_603, opGateError)
  }

  // One permission identity for the whole call — the account role plus its
  // groups — so the table gate, the field-write check, the row-level context
  // and the programs' field-read filtering all see the role the records API
  // sees, never the three-tier MCP view `caller.role` holds.
  const authority = await resolveCallerAuthority({
    app,
    caller,
    lookupGroups: (userId) => runOnDomain(domainContext, getUserGroups(userId)),
    // Assignment roles count only on a table with row-level rules, as on the
    // records route, so they are read only there.
    lookupAccessRoles: (userId) =>
      resolved.table.rowLevelPermissions === undefined
        ? Promise.resolve([])
        : Effect.runPromise(provideTableLive(getUserAccessRoles(userId))),
  })
  if (!passesTablePermission(app, resolved.table, resolved.operation, authority)) {
    // The records API's own refusal, byte for byte: a caller the table does not
    // admit learns nothing from MCP that it would not learn from REST.
    return toolFailure(-32_603, 'Resource not found')
  }

  return executeTool({ app, caller, authority, envelope, resolved, domainContext })
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

  const toolTable = remainder.slice(0, lastUnderscore)
  const table = (app.tables ?? []).find((t) => toolSafeTableName(t.name) === toolTable)
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
  readonly app: App
  readonly caller: McpCaller
  readonly authority: CallerAuthority
  readonly envelope: CallEnvelope
  readonly resolved: ResolvedTool
  readonly domainContext: DomainContext
}

/**
 * Dispatch the resolved (table, operation) pair to the matching application
 * program. Each branch wraps the program in `provideTableLive` and converts
 * thrown / Either errors into JSON-RPC -32603. Authorization-time errors
 * (field-write violation, scoped-row-out-of-bounds, soft-deleted) bubble
 * up as -32602 / -32603 per the user-story spec.
 */
async function executeTool(input: ExecuteToolInput): Promise<McpToolResult> {
  const { app, caller, authority, envelope, resolved, domainContext } = input
  const { operation, table } = resolved
  const session = synthesizeSession(caller.userId)
  const branch = { app, caller, authority, envelope, table, session, domainContext }

  if (operation === 'list') return executeList(branch)
  if (operation === 'create') return executeCreate(branch)
  // An id no key of the table could hold names no record — answered as the
  // records API answers it, before any query runs.
  const recordId = envelope.args['id']
  const spelled = typeof recordId === 'number' ? String(recordId) : recordId
  if (typeof spelled === 'string' && spelled !== '' && !isRecordKeyShaped(spelled, table)) {
    return toolFailure(-32_603, RECORD_NOT_FOUND)
  }
  if (operation === 'read') return executeRead(branch)
  if (operation === 'update') return executeUpdate(branch)
  return executeDelete(branch)
}

interface ExecBranchInput {
  readonly app: App
  readonly caller: McpCaller
  readonly authority: CallerAuthority
  readonly envelope: CallEnvelope
  readonly table: Table
  readonly session: UserSession
  readonly domainContext: DomainContext
}

async function executeList(input: ExecBranchInput): Promise<McpToolResult> {
  const { app, caller, authority, envelope, table, session } = input
  const limitArg = envelope.args['limit']
  const limit = typeof limitArg === 'number' ? limitArg : undefined
  const offsetArg = envelope.args['offset']
  const offset = typeof offsetArg === 'number' ? offsetArg : undefined

  const userCtx = await resolveUserContextOrUndefined(caller.userId, authority, table, app)
  const filter = buildReadListFilter(table, userCtx)
  if (filter === 'empty') {
    return toolSuccess([])
  }
  if (filter === 'reject') {
    return toolSuccess([])
  }

  return runProgramAsToolResult({
    program: createListRecordsProgram({
      session,
      tableName: table.name,
      app,
      userRole: authority.role,
      userGroups: authority.groups,
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

async function executeRead(input: ExecBranchInput): Promise<McpToolResult> {
  const { app, caller, authority, envelope, table, session } = input
  const recordId = String(envelope.args['id'] ?? '')
  if (!recordId) {
    return toolFailure(-32_602, "Missing 'id' parameter")
  }

  const userCtx = await resolveUserContextOrUndefined(caller.userId, authority, table, app)
  return runProgramAsToolResult({
    program: createGetRecordProgram({
      session,
      tableName: table.name,
      recordId,
      app,
      userRole: authority.role,
      userGroups: authority.groups,
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

async function executeCreate(input: ExecBranchInput): Promise<McpToolResult> {
  const { app, caller, authority, envelope, table, session } = input
  const requested = checkWritePermissions(input, extractFields(envelope.args))
  const fields = await applyCreateRules(ruleInput(input), requested)

  // The records API evaluates `create.when` on the validated row and refuses an
  // out-of-scope one with 404; a note filed under someone else's name is
  // refused here the same way, before anything is written.
  const userCtx = await resolveUserContextOrUndefined(caller.userId, authority, table, app)
  if (!createIsInScope(table, fields, userCtx)) {
    return toolFailure(-32_603, RECORD_NOT_FOUND)
  }

  return runProgramAsToolResult({
    program: createRecordProgram({
      session,
      tableName: table.name,
      fields,
      app,
      userRole: authority.role,
      userGroups: authority.groups,
      linkReader: linkReaderOf(input),
    }),
    // The echoed record answers to the same whitelist a read does: a write
    // naming only whitelisted fields must not hand back the rest of the row.
    formatSuccess: (out) => applyMcpFieldExposureToRecord(out as Record<string, unknown>, table),
  })
}

async function executeUpdate(input: ExecBranchInput): Promise<McpToolResult> {
  const { app, authority, envelope, table, session } = input
  const recordId = String(envelope.args['id'] ?? '')
  if (!recordId) {
    return toolFailure(-32_602, "Missing 'id' parameter")
  }
  // Row scope first, as the records API does: a caller learns nothing about a
  // row it may not write — not its values, not which of its fields it could
  // have touched — nor about any row of a table she may not read.
  const change = extractFields(envelope.args)
  if (!readsTable(input) || !(await rowIsInScope(input, recordId, 'write', change)))
    return toolFailure(-32_603, RECORD_NOT_FOUND)
  await refuseLockedRecord(table, session, recordId, app)
  const requested = checkWritePermissions(input, change)
  const fields = await applyUpdateRules(ruleInput(input), requested)

  return runProgramAsToolResult({
    program: updateRecordProgram(session, table.name, recordId, {
      fields,
      app,
      userRole: authority.role,
      userGroups: authority.groups,
      linkReader: linkReaderOf(input),
    }),
    formatSuccess: (out) => applyMcpFieldExposureToRecord(out as Record<string, unknown>, table),
  })
}

async function executeDelete(input: ExecBranchInput): Promise<McpToolResult> {
  const { app, envelope, table, session } = input
  const recordId = String(envelope.args['id'] ?? '')
  if (!recordId) {
    return toolFailure(-32_602, "Missing 'id' parameter")
  }
  // A table the caller may not read answers as a record that does not exist.
  if (!readsTable(input)) return toolSuccess(MISSING_RECORD_DELETE)
  if (!(await rowIsInScope(input, recordId, 'delete')))
    return toolFailure(-32_603, RECORD_NOT_FOUND)
  return runProgramAsToolResult({
    program: deleteRecordProgram(session, table.name, recordId, app),
  })
}

/** The records API's refusal for anything out of the caller's reach. */
const RECORD_NOT_FOUND = 'Resource not found'

/** What `deleteRecordProgram` answers for a record that does not exist. */
const MISSING_RECORD_DELETE = { success: false, setNullPerformed: false, restrictViolation: false }

/**
 * Whether the caller reads the table at all. A write on a stored record of a
 * table she may not read answers exactly as one on a missing record, and
 * nothing is written — as on the records API.
 */
const readsTable = (input: ExecBranchInput): boolean =>
  passesTablePermission(input.app, input.table, 'read', input.authority)

/**
 * Whether the caller may write or delete the row: readable under its
 * row-level rules, and inside the operation's own rule.
 */
async function rowIsInScope(
  input: ExecBranchInput,
  recordId: string,
  op: 'write' | 'delete',
  change?: Readonly<Record<string, unknown>>
): Promise<boolean> {
  const { app, caller, authority, table, session } = input
  const ctx = await resolveUserContextOrUndefined(caller.userId, authority, table, app)
  return existingRowIsInScope({ app, table, session, recordId, ctx, op, change })
}

/**
 * The permission rules a write tool enforces before the value rules, in the
 * records API's order: the MCP whitelist, then field-level write permission
 * under the caller's full authority (role and groups). Throws the first
 * violation as a JSON-RPC error; returns the requested values.
 */
function checkWritePermissions(
  input: ExecBranchInput,
  fields: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> {
  const { app, authority, table } = input
  const whitelistError = findFirstWhitelistViolation(table, fields)
  if (whitelistError !== undefined) {
    return toolFailure(-32_602, `Field '${whitelistError}' is not in aiAccess.whitelistFields`)
  }
  const writeError = findFirstFieldWriteViolation(app, table, authority, fields)
  if (writeError !== undefined) {
    return toolFailure(-32_602, `Cannot write to field '${writeError}': insufficient permissions`)
  }
  return fields
}

/**
 * Whose read rules judge the rows a write links to: the caller's full
 * authority, groups included, exactly as the records API judges them.
 */
const linkReaderOf = (input: ExecBranchInput): LinkReader => ({
  session: input.session,
  role: input.authority.role,
  groups: input.authority.groups,
})

/** What the records API's value rules are keyed on for this call. */
const ruleInput = (input: ExecBranchInput) => ({
  app: input.app,
  table: input.table,
  userRole: input.authority.role,
  userGroups: input.authority.groups,
  signedOut: isGuestSession(input.session.userId),
  domainContext: input.domainContext,
})

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
function extractFields(args: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
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
 * programs. Every authenticated caller names a user; `userId` is `undefined`
 * only on the unreachable fail-closed fallback caller, for which the
 * authorship helpers fall back to `null` for created_by / updated_by. The
 * four `null`s are required by the Better Auth-shaped UserSession contract —
 * the fields are not meaningful for an MCP-issued session but the typed shape
 * demands them.
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
 * Resolve a `CurrentUserContext` from the authenticated caller. Returns
 * `undefined` when no userId is available — only the unreachable fail-closed
 * fallback caller, since every credential `/mcp` accepts names a user. The
 * row-level gates read an absent context as "no identity" and DENY every row
 * a rule governs, the same way that caller is already denied every tool.
 */
async function resolveUserContextOrUndefined(
  userId: string | undefined,
  authority: CallerAuthority,
  table: Table,
  app: App
): Promise<CurrentUserContext | undefined> {
  if (!userId) return undefined
  const projection = toSessionProjection(
    { userId },
    { role: authority.role, isUnrestricted: isAdminEquivalent(authority.role, app) }
  )
  return Effect.runPromise(
    provideTableLive(loadCurrentUserContext(projection, table.rowLevelPermissions))
  )
}
