/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * AI Chat record-mutation executor.
 *
 * Powers `[internal ref]`.
 * Given a {@link MutationIntent} parsed from the user's chat message, this
 * module:
 *
 * - enforces table-level RBAC (create/update/delete) — [internal ref]
 *    / 013;
 * - validates field values against schema constraints — [internal ref];
 *  - requires a confirmation token before any delete, and before a bulk
 * update that affects 2+ rows — [internal ref];
 *  - executes the mutation against the engine-created table and reports the
 * affected record ids back in the chat response — [internal ref] /
 *    002 / 010 / 012;
 *  - writes one `system.ai_activity_logs` row per mutation with user
 * attribution — [internal ref].
 *
 * Mutations are issued as direct parameterised SQL via `db.execute` against
 * the `public`-schema table the engine created from `app.tables[]`. This keeps
 * the chat surface free of the full `TableRepository`/RLS wiring while
 * remaining deterministic for the spec.
 */

import { Effect } from 'effect'
import {
  deleteDynamicRecords,
  insertDynamicRecord,
  countDynamicRecords,
  updateAllDynamicRecords,
  updateDynamicRecordById,
} from '@/application/use-cases/ai/dynamic-record-query'
import { buildEffectiveRoles } from '@/application/use-cases/tables/user-groups'
import {
  evaluateFieldPermissions,
  hasCreatePermissionForRoles,
  hasDeletePermissionForRoles,
  hasUpdatePermissionForRoles,
} from '@/domain/models/app/auth/permission-evaluator-service'
import { isAdminRole } from '@/domain/models/app/auth/permissions'
import { parseAiConfirmationTtlMs } from '@/domain/models/process-env/ai/ai-confirmation-ttl'
import { recordActivityLogRow } from '@/presentation/api/ai/chat-activity-log'
import type { ChatAction } from '@/domain/models/api/ai/chat'
import type {
  MutationIntent,
  MutationTable,
} from '@/domain/models/app/agents/ai-chat-mutation-parser'
import type { TableFieldPermissions } from '@/domain/models/app/tables/permissions'
import type { DomainContext } from '@/infrastructure/logging/request-effect'

/** A pending destructive action awaiting an explicit user confirmation. */
export interface PendingConfirmation {
  readonly action: string
  readonly table: string
  readonly affectedCount: number
  readonly description: string
  readonly confirmationToken: string
}

/** Outcome of attempting to apply a mutation intent. */
export type MutationOutcome =
  | { readonly status: 'forbidden'; readonly message: string }
  | { readonly status: 'validation-error'; readonly message: string }
  | { readonly status: 'pending'; readonly pendingConfirmation: PendingConfirmation }
  | {
      readonly status: 'applied'
      readonly actions: ReadonlyArray<ChatAction>
      readonly summary: string
    }

/** Inputs required to apply a mutation intent. */
export interface ApplyMutationInput {
  /** The server's resolved services, taken off the request that started the turn. */
  readonly services: DomainContext
  readonly intent: MutationIntent
  /** The acting user's role — used for table-level RBAC checks. */
  readonly userRole: string
  /**
   * Group names the acting user belongs to, un-prefixed. Permissions
   * name a group as `group:<name>`, an overlay that exists only in the
   * effective-role set; a bare `userRole` can never match one, so without this
   * every `group:` grant was inert here while working on the records API.
   */
  readonly userGroups: readonly string[]
  /** The acting user's email — written to the activity log. */
  readonly userEmail: string
  /** The full set of app tables (carries permissions + field metadata). */
  readonly tables: ReadonlyArray<MutationTable & { readonly permissions?: unknown }>
}

/**
 * The acting user's identity as the permission gates consume it: their global
 * role plus a `group:<name>` entry per membership, most-permissive-wins.
 */
const effectiveRolesOf = (input: ApplyMutationInput): readonly string[] =>
  buildEffectiveRoles(input.userRole, input.userGroups)

// ---------------------------------------------------------------------------
// Pending-confirmation store
// ---------------------------------------------------------------------------

/**
 * A confirmation entry stashed when a destructive action is proposed. It is
 * re-applied when the next request on the same session carries its token.
 *
 * Every authorization input the commit runs on is CAPTURED here ([internal ref],
 * decision 3) — `userRole`, `userGroups`, and the `tables` snapshot — and
 * `commitConfirmedMutation` re-resolves none of them. `tables` must be frozen
 * regardless: the intent was parsed against it and the `affectedCount` already
 * quoted to the user was computed under it. Given one input is necessarily
 * frozen, freezing the identity beside it is the only combination describing a
 * verdict that was ever actually true — re-resolving groups alone would pair a
 * stale role and stale table permissions with fresh memberships, a state that
 * held at neither instant.
 */
interface StoredConfirmation {
  readonly intent: MutationIntent
  readonly userRole: string
  /** Group memberships as they stood when the token was issued. */
  readonly userGroups: readonly string[]
  readonly userEmail: string
  readonly tables: ReadonlyArray<MutationTable & { readonly permissions?: unknown }>
  /** `Date.now` at issue time — the TTL anchor ([internal ref], decision 4). */
  readonly issuedAt: number
}

/**
 * Module-level pending-confirmation store, keyed by the issued
 * `confirmationToken`. Same ephemeral-Map discipline as the conversation store
 * and `webhook-rate-limit.ts` — a confirmation is short-lived working state,
 * not durable data.
 */
const pendingConfirmations = new Map<string, StoredConfirmation>()

/**
 * Look up (and consume) a stored confirmation by its token.
 *
 * An entry older than `AI_CONFIRMATION_TTL_MS` is treated as ABSENT and dropped
 * on the way past. That bounds the captured-identity semantic above: without an
 * expiry an unconsumed token survives the process lifetime, so a verdict reached
 * under a role, a membership and a config that have all since changed would stay
 * committable forever. One TTL closes all three staleness windows; re-resolving
 * any single input closes only its own.
 *
 * `undefined` rather than a distinct "expired" outcome is what the caller
 * already handles: an unknown token falls through to the intent path, where a
 * bare "yes" parses as no intent at all. Nothing is mutated.
 */
export const consumeConfirmation = (token: string): StoredConfirmation | undefined => {
  const stored = pendingConfirmations.get(token)
  if (stored === undefined) return undefined
  // eslint-disable-next-line functional/no-expression-statements, functional/immutable-data, drizzle/enforce-delete-with-where -- module-local mutable Map, not a Drizzle table; mirrors conversation store
  pendingConfirmations.delete(token)
  const ttlMs = parseAiConfirmationTtlMs(process.env)
  if (Date.now() - stored.issuedAt > ttlMs) return undefined
  return stored
}

// ---------------------------------------------------------------------------
// Field-value validation
// ---------------------------------------------------------------------------

const EMAIL_FORMAT_RE = /^[\w.+-]+@[\w-]+\.[\w.-]+$/

/**
 * Validate the create payload against the table's field schema:
 *  - a value mapped to an `email`-typed field must be email-shaped;
 *  - a `required` field with no supplied value is rejected.
 * Returns a human-readable message on the first failure, or `undefined` when
 * the payload satisfies every constraint.
 */
const validateCreateData = (
  table: MutationTable,
  data: Readonly<Record<string, unknown>>
): string | undefined => {
  const emailViolation = table.fields.find(
    (field) =>
      field.type === 'email' &&
      typeof data[field.name] === 'string' &&
      !EMAIL_FORMAT_RE.test(data[field.name] as string)
  )
  if (emailViolation !== undefined) {
    return `Validation failed: the value for "${emailViolation.name}" is an invalid email format — the mutation was not applied.`
  }
  const missingRequired = table.fields.find(
    (field) => field.required === true && data[field.name] === undefined
  )
  if (missingRequired !== undefined) {
    return `Validation failed: the required field "${missingRequired.name}" is missing — the mutation was not applied.`
  }
  return undefined
}

// ---------------------------------------------------------------------------
// Field-level write RBAC
// ---------------------------------------------------------------------------

/**
 * Extract the `fields` array from a table's (untyped) `permissions` block.
 * Returns `undefined` when no field-level permissions are declared.
 */
const extractFieldPermissions = (permissions: unknown): TableFieldPermissions | undefined => {
  if (permissions === null || typeof permissions !== 'object') return undefined
  const { fields } = permissions as { readonly fields?: unknown }
  return Array.isArray(fields) ? (fields as TableFieldPermissions) : undefined
}

/**
 * Enforce field-level write RBAC: for every field present in the mutation
 * payload, the acting identity must hold `write` on that field's declared
 * field-level permission. A field with no declared permission is unrestricted.
 *
 * Evaluated over the caller's EFFECTIVE roles, most-permissive-wins — the same
 * combining rule the table-level `*ForRoles` gates use, so a field
 * granted to `group:finance` is writable by that group's members.
 *
 * Returns the name of the first field the user may not write, or `undefined`
 * when the whole payload is permitted.
 */
const findForbiddenWriteField = (
  permissions: unknown,
  effectiveRoles: readonly string[],
  data: Readonly<Record<string, unknown>>
): string | undefined => {
  const fieldPerms = extractFieldPermissions(permissions)
  if (fieldPerms === undefined) return undefined
  const evaluated = effectiveRoles.map((role) =>
    evaluateFieldPermissions(fieldPerms, role, isAdminRole(role))
  )
  return Object.keys(data).find((fieldName) => {
    // A field absent from the declared permissions is unrestricted. Presence is
    // role-independent (the declaration list is the same for every role), so
    // any one evaluation answers it.
    const declared = evaluated.some((perms) => perms[fieldName] !== undefined)
    if (!declared) return false
    return !evaluated.some((perms) => perms[fieldName]?.write === true)
  })
}

// ---------------------------------------------------------------------------
// SQL execution helpers — fronted by the DynamicRecordRepository port
//
// The raw parameterised DML lives in the infrastructure layer
// (`dynamic-record-repository-live.ts`); these helpers consume the
// `dynamic-record-query` use-case via `Effect.runPromise` so the presentation
// layer holds no raw SQL literal. Behavior is byte-identical to the prior
// inline SQL — a hard delete (not a soft `deleted_at`), `INSERT … RETURNING
// id`, `DEFAULT VALUES` for an empty payload, no authorship stamping, no
// activity-log side effects in the repository.
// ---------------------------------------------------------------------------

/**
 * Count rows in a table, optionally narrowed by a single `column = value`
 * filter. Used to size confirmation prompts for bulk/delete operations.
 */
const countRows = async (
  services: DomainContext,
  tableName: string,
  filter?: { readonly column: string; readonly value: string }
): Promise<number> =>
  Effect.runPromise(Effect.provide(countDynamicRecords({ table: tableName, filter }), services))

/**
 * Insert one row and return its generated id. Columns and values are passed as
 * parameterised SQL fragments so values are never string-interpolated.
 */
const insertRow = async (
  services: DomainContext,
  tableName: string,
  data: Readonly<Record<string, unknown>>
): Promise<number | string> =>
  Effect.runPromise(Effect.provide(insertDynamicRecord({ table: tableName, data }), services))

/** Update one row by id; returns true when a row was affected. */
const updateRowById = async (
  services: DomainContext,
  tableName: string,
  recordId: number,
  data: Readonly<Record<string, unknown>>
): Promise<boolean> =>
  Effect.runPromise(
    Effect.provide(updateDynamicRecordById({ table: tableName, recordId, data }), services)
  )

/** Update every row in a table; returns the affected record ids. */
const updateAllRows = async (
  services: DomainContext,
  tableName: string,
  data: Readonly<Record<string, unknown>>
): Promise<ReadonlyArray<number>> =>
  Effect.runPromise(Effect.provide(updateAllDynamicRecords({ table: tableName, data }), services))

/**
 * Hard-delete rows from a table, optionally narrowed by a `column = value`
 * filter; returns the deleted record ids. A hard delete (not a soft
 * `deleted_at`) is used so the spec's `SELECT COUNT(*)` observes zero rows.
 */
const deleteRows = async (
  services: DomainContext,
  tableName: string,
  filter?: { readonly column: string; readonly value: string }
): Promise<ReadonlyArray<number>> =>
  Effect.runPromise(Effect.provide(deleteDynamicRecords({ table: tableName, filter }), services))

// ---------------------------------------------------------------------------
// Activity logging
// ---------------------------------------------------------------------------

/**
 * Record one mutation in `system.ai_activity_logs` with user attribution
 *. Best-effort — a logging failure must never break
 * the chat turn.
 */
const logMutation = async (
  services: DomainContext,
  tableName: string,
  userEmail: string
): Promise<void> =>
  recordActivityLogRow(services, {
    actorType: 'user',
    actorName: userEmail,
    action: 'ai.chat.mutation',
    targetTable: tableName,
    userEmail,
  })

// ---------------------------------------------------------------------------
// Intent-kind handlers
// ---------------------------------------------------------------------------

/** Resolve the {@link MutationTable} for an intent, if the app declares it. */
const resolveTable = (
  input: ApplyMutationInput
): (MutationTable & { readonly permissions?: unknown }) | undefined =>
  input.tables.find((table) => table.name === input.intent.table)

/**
 * The argument triple every table-level gate on this path takes, spread into
 * `has{Create,Update,Delete}PermissionForRoles` at the three call sites. Both
 * of the last two arguments close a hole this surface actually had:
 *
 *  - the EFFECTIVE ROLES, not a bare role, so a `group:<name>` grant can match
 *    at all — a bare role never can, because the `group:` overlay exists only
 *    in the effective-role set;
 *  - the INHERITANCE resolution set, so a table declaring
 *    `permissions: { inherit: '<parent>' }` resolves its parent's rule instead
 *    of reading as if it declared nothing.
 *
 * Fixing either alone is the trap: `applyCreate` was corrected for inheritance
 * in the 2026-08-26 audit wave (finding F5) and still let every group grant
 * fall through, which looked like the finding was closed.
 */
const gateArgs = (
  table: MutationTable & { readonly permissions?: unknown },
  input: ApplyMutationInput
) =>
  [
    table as { name: string },
    effectiveRolesOf(input),
    input.tables as Parameters<typeof hasCreatePermissionForRoles>[2],
  ] as const

const applyCreate = async (
  input: ApplyMutationInput,
  table: MutationTable & { readonly permissions?: unknown }
): Promise<MutationOutcome> => {
  if (input.intent.kind !== 'create') return { status: 'forbidden', message: 'Unsupported intent.' }
  if (!hasCreatePermissionForRoles(...gateArgs(table, input))) {
    return {
      status: 'forbidden',
      message: `You do not have permission to create records in "${table.name}".`,
    }
  }
  const forbiddenField = findForbiddenWriteField(
    table.permissions,
    effectiveRolesOf(input),
    input.intent.data
  )
  if (forbiddenField !== undefined) {
    return {
      status: 'forbidden',
      message: `You do not have permission to modify the "${forbiddenField}" field in "${table.name}".`,
    }
  }
  const validationError = validateCreateData(table, input.intent.data)
  if (validationError !== undefined) {
    return { status: 'validation-error', message: validationError }
  }
  const recordId = await insertRow(input.services, table.name, input.intent.data)
  await logMutation(input.services, table.name, input.userEmail)
  const detail = Object.values(input.intent.data).filter((v) => typeof v === 'string')
  return {
    status: 'applied',
    actions: [
      {
        type: 'create',
        table: table.name,
        recordId,
        description: `Created a record in "${table.name}".`,
      },
    ],
    summary:
      detail.length > 0
        ? `Created a new ${table.name} record: ${detail.join(', ')}.`
        : `Created a new record in "${table.name}".`,
  }
}

/** Apply a single-record update by id. */
const applyUpdateById = async (
  input: ApplyMutationInput,
  tableName: string,
  recordId: number,
  data: Readonly<Record<string, unknown>>
): Promise<MutationOutcome> => {
  const updated = await updateRowById(input.services, tableName, recordId, data)
  if (!updated) {
    return {
      status: 'validation-error',
      message: `No record #${String(recordId)} found in "${tableName}".`,
    }
  }
  await logMutation(input.services, tableName, input.userEmail)
  return {
    status: 'applied',
    actions: [
      {
        type: 'update',
        table: tableName,
        recordId,
        description: `Updated record #${String(recordId)} in "${tableName}".`,
      },
    ],
    summary: `Updated record #${String(recordId)} in "${tableName}".`,
  }
}

/** Apply an update to every row of a table ([internal ref] confirmed path). */
const applyUpdateAll = async (
  services: DomainContext,
  userEmail: string,
  tableName: string,
  data: Readonly<Record<string, unknown>>
): Promise<MutationOutcome> => {
  const ids = await updateAllRows(services, tableName, data)
  await logMutation(services, tableName, userEmail)
  return {
    status: 'applied',
    actions: ids.map((id) => ({
      type: 'update' as const,
      table: tableName,
      recordId: id,
      description: `Updated record #${String(id)} in "${tableName}".`,
    })),
    summary: `Updated ${String(ids.length)} record(s) in "${tableName}".`,
  }
}

const applyUpdate = async (
  input: ApplyMutationInput,
  table: MutationTable & { readonly permissions?: unknown }
): Promise<MutationOutcome> => {
  if (input.intent.kind !== 'update') return { status: 'forbidden', message: 'Unsupported intent.' }
  if (!hasUpdatePermissionForRoles(...gateArgs(table, input))) {
    return {
      status: 'forbidden',
      message: `You do not have permission to update records in "${table.name}".`,
    }
  }
  const { data, bulk, recordId } = input.intent
  // An update with no extractable field values cannot be applied — surface a
  // benign validation message rather than emitting empty SQL or stashing a
  // useless confirmation.
  if (Object.keys(data).length === 0) {
    return {
      status: 'validation-error',
      message: `I could not determine which fields to change in "${table.name}". Please specify the new values.`,
    }
  }
  // Field-level write RBAC: deny before the bulk
  // confirmation gate so a forbidden field never reaches a stashed intent.
  const forbiddenField = findForbiddenWriteField(table.permissions, effectiveRolesOf(input), data)
  if (forbiddenField !== undefined) {
    return {
      status: 'forbidden',
      message: `You do not have permission to modify the "${forbiddenField}" field in "${table.name}".`,
    }
  }
  // Bulk update affecting 2+ rows requires explicit confirmation
  //. The row count is the table-wide total since the
  // intent targets "all" rows.
  if (bulk) {
    const affectedCount = await countRows(input.services, table.name)
    if (affectedCount >= 2) {
      return {
        status: 'pending',
        pendingConfirmation: stashConfirmation(input, 'bulk update', affectedCount),
      }
    }
  }
  return recordId !== undefined
    ? applyUpdateById(input, table.name, recordId, data)
    : applyUpdateAll(input.services, input.userEmail, table.name, data)
}

const applyDelete = async (
  input: ApplyMutationInput,
  table: MutationTable & { readonly permissions?: unknown }
): Promise<MutationOutcome> => {
  if (input.intent.kind !== 'delete') return { status: 'forbidden', message: 'Unsupported intent.' }
  if (!hasDeletePermissionForRoles(...gateArgs(table, input))) {
    return {
      status: 'forbidden',
      message: `You do not have permission to delete records in "${table.name}".`,
    }
  }
  // Every delete requires explicit confirmation.
  const affectedCount = await countRows(input.services, table.name, input.intent.filter)
  return {
    status: 'pending',
    pendingConfirmation: stashConfirmation(input, 'delete', Math.max(affectedCount, 1)),
  }
}

/**
 * Stash a confirmation entry under a fresh token and build the
 * {@link PendingConfirmation} envelope returned to the caller.
 */
const stashConfirmation = (
  input: ApplyMutationInput,
  action: string,
  affectedCount: number
): PendingConfirmation => {
  const confirmationToken = crypto.randomUUID()
  // eslint-disable-next-line functional/no-expression-statements, functional/immutable-data -- module-local mutable Map, mirrors conversation store
  pendingConfirmations.set(confirmationToken, {
    intent: input.intent,
    userRole: input.userRole,
    userGroups: input.userGroups,
    userEmail: input.userEmail,
    tables: input.tables,
    issuedAt: Date.now(),
  })
  return {
    action,
    table: input.intent.table,
    affectedCount,
    description: `This ${action} will affect ${String(affectedCount)} record(s) in "${input.intent.table}". Reply "yes" to confirm or "no" to cancel.`,
    confirmationToken,
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Apply a parsed mutation intent. Destructive intents (delete; bulk update of
 * 2+ rows) yield a `pending` outcome instead of executing — the caller must
 * re-submit with the issued `confirmationToken` to commit.
 */
export const applyMutation = async (input: ApplyMutationInput): Promise<MutationOutcome> => {
  const table = resolveTable(input)
  if (table === undefined) {
    return { status: 'forbidden', message: `Unknown table "${input.intent.table}".` }
  }
  switch (input.intent.kind) {
    case 'create':
      return applyCreate(input, table)
    case 'update':
      return applyUpdate(input, table)
    case 'delete':
      return applyDelete(input, table)
  }
}

/**
 * Commit a previously-stashed confirmation: re-run the stored intent, this
 * time forcing execution (delete / bulk update bypass the confirmation gate).
 */
export const commitConfirmedMutation = async (
  services: DomainContext,
  stored: StoredConfirmation
): Promise<MutationOutcome> => {
  const table = stored.tables.find((t) => t.name === stored.intent.table)
  if (table === undefined) {
    return { status: 'forbidden', message: `Unknown table "${stored.intent.table}".` }
  }
  const input: ApplyMutationInput = {
    services,
    intent: stored.intent,
    userRole: stored.userRole,
    userGroups: stored.userGroups,
    userEmail: stored.userEmail,
    tables: stored.tables,
  }
  if (stored.intent.kind === 'delete') {
    const ids = await deleteRows(services, table.name, stored.intent.filter)
    await logMutation(services, table.name, stored.userEmail)
    return {
      status: 'applied',
      actions: ids.map((id) => ({
        type: 'delete' as const,
        table: table.name,
        recordId: id,
        description: `Deleted record #${String(id)} from "${table.name}".`,
      })),
      summary: `Deleted ${String(ids.length)} record(s) from "${table.name}".`,
    }
  }
  // Bulk update — apply every row directly (the confirmation gate is bypassed
  // by routing through updateAllRows here rather than applyUpdate).
  const ids = await updateAllRows(
    services,
    table.name,
    input.intent.kind === 'update' ? input.intent.data : {}
  )
  await logMutation(services, table.name, stored.userEmail)
  return {
    status: 'applied',
    actions: ids.map((id) => ({
      type: 'update' as const,
      table: table.name,
      recordId: id,
      description: `Updated record #${String(id)} in "${table.name}".`,
    })),
    summary: `Updated ${String(ids.length)} record(s) in "${table.name}".`,
  }
}
