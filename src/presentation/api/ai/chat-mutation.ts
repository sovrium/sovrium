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
 *  - enforces table-level RBAC (create/update/delete)
 *    / 013;
 *  - validates field values against schema constraints;
 *  - requires a confirmation token before any delete, and before a bulk
 *    update that affects 2+ rows — an AI chat mutate spec;
 *  - executes the mutation against the engine-created table and reports the
 *    affected record ids back in the chat response — an AI chat mutate spec /
 *    002 / 010 / 012;
 *  - writes one `system.ai_activity_logs` row per mutation with user
 *    attribution.
 *
 * Which rows an update or a delete reaches is decided in ONE place, the chat
 * write gate (`chat-write-gate.ts`): the rows a chat read shows the caller,
 * each judged by the records API's write gate for a named caller — row-level
 * `read` and `write` / `delete` rules, live rows only. The confirmation counts
 * the admitted rows and the confirmed commit writes exactly them. A delete is
 * the records API's soft delete; a create and an update run parameterised SQL
 * through the dynamic-record repository.
 */

import { tableEffectiveRoles } from '@/application/use-cases/tables/user-groups'
import {
  hasCreatePermissionForRoles,
  hasDeletePermissionForRoles,
  hasUpdatePermissionForRoles,
} from '@/domain/models/app/auth/permission-evaluator-service'
import { forbiddenWriteFields } from '@/domain/models/app/tables/field-write-permission-service'
import { parseAiConfirmationTtlMs } from '@/domain/models/process-env/ai/ai-confirmation-ttl'
import { recordActivityLogRow } from '@/presentation/api/ai/chat-activity-log'
import {
  admittedWriteIds,
  commitChatCreate,
  commitChatDelete,
  commitChatUpdate,
  type ChatCaller,
  type ChatWrite,
  type ChatWriteTarget,
} from './chat-write-gate'
import type { ChatAction } from '@/domain/models/api/ai/chat'
import type { App } from '@/domain/models/app'
import type {
  MutationIntent,
  MutationTable,
} from '@/domain/models/app/agents/ai-chat-mutation-parser'
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
  /** The acting user's id — the records read gate judges her rows by it. */
  readonly userId: string
  /** The acting user's role — used for table-level RBAC checks. */
  readonly userRole: string
  /**
   * Group names the acting user belongs to, un-prefixed. Permissions
   * name a group as `group:<name>`, an overlay that exists only in the
   * effective-role set; a bare `userRole` can never match one, so without this
   * every `group:` grant was inert here while working on the records API.
   */
  readonly userGroups: readonly string[]
  /**
   * Every role the acting user's assignments (`user_access`) give her. Counted
   * only on a table with row-level rules, exactly as on the records API.
   */
  readonly userAccessRoles: readonly string[]
  /** The acting user's email — written to the activity log. */
  readonly userEmail: string
  /** The full set of app tables (carries permissions + field metadata). */
  readonly tables: ReadonlyArray<MutationTable & { readonly permissions?: unknown }>
  /** The app the tables come from — the field write rule reads its declarations. */
  readonly app: App
}

/**
 * The acting user's identity as the permission gates consume it: the ONE set
 * of effective roles the records route builds (`tableEffectiveRoles`) — her
 * account role, a `group:<name>` entry per membership and, on a table with
 * row-level rules, every assignment role. Most-permissive-wins.
 */
const effectiveRolesOf = (input: ApplyMutationInput, tableName: string): readonly string[] =>
  // The app's own table, not the mutation projection: whether assignment
  // roles count depends on its row-level rules, which the projection drops.
  tableEffectiveRoles(
    input.app.tables?.find((t) => t.name === tableName),
    {
      role: input.userRole,
      groups: input.userGroups,
      accessRoles: input.userAccessRoles,
    }
  )

// ---------------------------------------------------------------------------
// Pending-confirmation store
// ---------------------------------------------------------------------------

/**
 * A confirmation entry stashed when a destructive action is proposed. It is
 * re-applied when the next request on the same session carries its token.
 *
 * Every authorization input the commit runs on is CAPTURED here (the captured-identity rule for AI confirmations,
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
  /** The ids the chat write gate admitted at issue time — the rows the commit writes. */
  readonly admittedIds: readonly string[]
  readonly userId: string
  readonly userRole: string
  /** Group memberships as they stood when the token was issued. */
  readonly userGroups: readonly string[]
  /** Assignment roles as they stood when the token was issued. */
  readonly userAccessRoles: readonly string[]
  readonly userEmail: string
  readonly tables: ReadonlyArray<MutationTable & { readonly permissions?: unknown }>
  /** The app as it stood when the token was issued, frozen beside `tables`. */
  readonly app: App
  /** `Date.now` at issue time — the TTL anchor (the captured-identity rule for AI confirmations, decision 4). */
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
 * Enforce field-level write RBAC through the one rule every write door asks
 * (`forbiddenWriteFields`): a field whose `write` rule names an audience is
 * writable only by a ROLE in it, and a field with no `write` rule is writable
 * exactly when the caller may READ it — field read grants (`group:` entries
 * included) and the built-in default rules alike. An admin-equivalent role
 * owns every field. A `group:` entry in a field's `write` rule is NOT honoured:
 * the write half is matched against the role alone, as on the records API.
 *
 * Returns the name of the first field the user may not write, or `undefined`
 * when the whole payload is permitted.
 */
const findForbiddenWriteField = (
  input: ApplyMutationInput,
  tableName: string,
  data: Readonly<Record<string, unknown>>
): string | undefined =>
  forbiddenWriteFields(
    input.app,
    tableName,
    { role: input.userRole, groups: input.userGroups },
    data
  )[0]

// ---------------------------------------------------------------------------
// Activity logging
// ---------------------------------------------------------------------------

/**
 * Record one mutation in `system.ai_activity_logs` with user attribution
 * Best-effort — a logging failure must never break
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
 * `has{Create,Update,Delete}PermissionForRoles` at the three call sites. Each
 * of the last two arguments closes a real hole on this surface:
 *
 *  - the EFFECTIVE ROLES, not a bare role, so a `group:<name>` grant can match
 *    at all — a bare role never can, because the `group:` overlay exists only
 *    in the effective-role set;
 *  - the INHERITANCE resolution set, so a table declaring
 *    `permissions: { inherit: '<parent>' }` resolves its parent's rule instead
 *    of reading as if it declared nothing.
 *
 * Fixing either alone is the trap: a gate corrected for inheritance alone still
 * lets every group grant fall through, while looking fixed.
 */
const gateArgs = (
  table: MutationTable & { readonly permissions?: unknown },
  input: ApplyMutationInput
) =>
  [
    table as { name: string },
    effectiveRolesOf(input, table.name),
    { auth: input.app.auth, tables: input.tables } as Parameters<
      typeof hasCreatePermissionForRoles
    >[2],
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
  const forbiddenField = findForbiddenWriteField(input, table.name, input.intent.data)
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
  const recordId = await commitChatCreate(writerOf(input), table.name, input.intent.data)
  await logMutation(input.services, table.name, input.userEmail)
  const detail = Object.values(input.intent.data).filter((v) => typeof v === 'string')
  return {
    status: 'applied',
    actions: [
      {
        type: 'create',
        table: table.name,
        recordId: String(recordId),
        description: `Created a record in "${table.name}".`,
      },
    ],
    summary:
      detail.length > 0
        ? `Created a new ${table.name} record: ${detail.join(', ')}.`
        : `Created a new record in "${table.name}".`,
  }
}

/** The acting user as the chat write gate judges her. */
const writerOf = (input: ApplyMutationInput) => ({
  services: input.services,
  app: input.app,
  userId: input.userId,
  userRole: input.userRole,
  userGroups: input.userGroups,
  userAccessRoles: input.userAccessRoles,
})

/** The rows `write` may reach for the acting user, through the chat write gate. */
const admitted = (
  input: ApplyMutationInput,
  tableName: string,
  write: ChatWrite,
  target: ChatWriteTarget
): Promise<readonly string[]> => admittedWriteIds(writerOf(input), tableName, write, target)

/** The `applied` outcome of an update that wrote `ids`. */
const updatedOutcome = (
  tableName: string,
  ids: readonly string[],
  summary: string
): MutationOutcome => ({
  status: 'applied',
  actions: ids.map((id) => ({
    type: 'update' as const,
    table: tableName,
    recordId: id,
    description: `Updated record #${id} in "${tableName}".`,
  })),
  summary,
})

/**
 * Apply a single-record update by id. A row the
 * write gate refuses her — hidden by a rule, in the trash, or missing — is
 * answered as missing, and nothing is written.
 */
const applyUpdateById = async (
  input: ApplyMutationInput,
  tableName: string,
  recordId: number,
  data: Readonly<Record<string, unknown>>
): Promise<MutationOutcome> => {
  const ids = await admitted(input, tableName, { op: 'update', change: data }, { recordId })
  const written = await commitChatUpdate(writerOf(input), tableName, ids, data)
  if (written.length === 0) {
    return {
      status: 'validation-error',
      message: `No record #${String(recordId)} found in "${tableName}".`,
    }
  }
  await logMutation(input.services, tableName, input.userEmail)
  return updatedOutcome(
    tableName,
    written,
    `Updated record #${String(recordId)} in "${tableName}".`
  )
}

/** Apply an update to the admitted rows (an AI chat mutate spec confirmed path). */
const applyUpdateToIds = async (
  caller: ChatCaller,
  userEmail: string,
  tableName: string,
  change: { readonly ids: readonly string[]; readonly data: Readonly<Record<string, unknown>> }
): Promise<MutationOutcome> => {
  const written = await commitChatUpdate(caller, tableName, change.ids, change.data)
  await logMutation(caller.services, tableName, userEmail)
  return updatedOutcome(
    tableName,
    written,
    `Updated ${String(written.length)} record(s) in "${tableName}".`
  )
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
  const forbiddenField = findForbiddenWriteField(input, table.name, data)
  if (forbiddenField !== undefined) {
    return {
      status: 'forbidden',
      message: `You do not have permission to modify the "${forbiddenField}" field in "${table.name}".`,
    }
  }
  if (recordId !== undefined) return applyUpdateById(input, table.name, recordId, data)
  // The rows the write gate admits for her; a bulk update reaching 2+ of them
  // requires explicit confirmation, and the count it
  // quotes is exactly the rows the confirmed commit writes.
  const ids = await admitted(input, table.name, { op: 'update', change: data }, {})
  if (bulk && ids.length >= 2) {
    return {
      status: 'pending',
      pendingConfirmation: stashConfirmation(input, 'bulk update', ids),
    }
  }
  return applyUpdateToIds(writerOf(input), input.userEmail, table.name, { ids, data })
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
  // Every delete requires explicit confirmation,
  // over the rows the write gate admits for her.
  const ids = await admitted(input, table.name, { op: 'delete' }, { filter: input.intent.filter })
  return {
    status: 'pending',
    pendingConfirmation: stashConfirmation(input, 'delete', ids),
  }
}

/**
 * Stash a confirmation entry under a fresh token and build the
 * {@link PendingConfirmation} envelope returned to the caller.
 */
const stashConfirmation = (
  input: ApplyMutationInput,
  action: string,
  admittedIds: readonly string[]
): PendingConfirmation => {
  const confirmationToken = crypto.randomUUID()
  // A delete always asks, and quotes at least one record.
  const affectedCount = action === 'delete' ? Math.max(admittedIds.length, 1) : admittedIds.length
  pendingConfirmations.set(confirmationToken, {
    intent: input.intent,
    admittedIds,
    userId: input.userId,
    userRole: input.userRole,
    userGroups: input.userGroups,
    userAccessRoles: input.userAccessRoles,
    userEmail: input.userEmail,
    tables: input.tables,
    app: input.app,
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

/** The user a stashed confirmation was issued to, as its commit writes. */
const storedCaller = (services: DomainContext, stored: StoredConfirmation): ChatCaller => ({
  services,
  app: stored.app,
  userId: stored.userId,
  userRole: stored.userRole,
  userGroups: stored.userGroups,
})

/**
 * Commit a previously-stashed confirmation: write exactly the rows the write
 * gate admitted when the confirmation was issued — the rows its count quoted,
 * judged on the identity captured then — live rows only.
 */
export const commitConfirmedMutation = async (
  services: DomainContext,
  stored: StoredConfirmation
): Promise<MutationOutcome> => {
  const table = stored.tables.find((t) => t.name === stored.intent.table)
  if (table === undefined) {
    return { status: 'forbidden', message: `Unknown table "${stored.intent.table}".` }
  }
  if (stored.intent.kind === 'delete') {
    const ids = await commitChatDelete({
      caller: storedCaller(services, stored),
      tableName: table.name,
      ids: stored.admittedIds,
    })
    await logMutation(services, table.name, stored.userEmail)
    return {
      status: 'applied',
      actions: ids.map((id) => ({
        type: 'delete' as const,
        table: table.name,
        recordId: id,
        description: `Deleted record #${id} from "${table.name}".`,
      })),
      summary: `Deleted ${String(ids.length)} record(s) from "${table.name}".`,
    }
  }
  return applyUpdateToIds(storedCaller(services, stored), stored.userEmail, table.name, {
    ids: stored.admittedIds,
    data: stored.intent.kind === 'update' ? stored.intent.data : {},
  })
}
