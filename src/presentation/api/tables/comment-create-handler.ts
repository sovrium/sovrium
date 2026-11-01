/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { CommentRepository } from '@/application/ports/repositories/comment-repository'
import { triggerCommentEventAutomations } from '@/application/use-cases/automations/trigger-comment-event'
import {
  NestedCommentReplyError,
  postCommentProgram,
} from '@/application/use-cases/tables/comment-post-programs'
import { authorizeComment } from '@/application/use-cases/tables/permissions/authorize-record-verbs'
import { ApiErrorCode } from '@/domain/models/api/error'
import {
  createCommentResponseSchema,
  discardedCommentResponseSchema,
} from '@/domain/models/api/tables/comments'
import { isAuthenticatedSession } from '@/domain/models/app/auth/guest-session'
import { commentTableKeysOf } from '@/domain/models/app/tables/comment-address-service'
import {
  isModerationEnabled,
  resolveCommentModerationStatus,
  requiresAuthenticationForComment,
  type CommentModerationConfig,
} from '@/domain/models/app/tables/comment-moderation-policy'
import { notFound } from '@/presentation/api/runtime/auth-helpers'
import { getTableContext } from '@/presentation/api/runtime/context-helpers'
import { answerFailures, runHandlerEffect, shapedJson } from '@/presentation/api/runtime/run-effect'
import {
  combineModerationVerdicts,
  isHoneypotEnabled,
  judgeCreateCommentBody,
  readHoneypotValue,
  type CreateCommentBody,
  type CombinedModerationStatus,
} from './comment-create-body'
import { callerRolesOnTable, notFoundResponse } from './comment-handler-shared'
import { applyRateLimit, classifySpam } from './comment-spam-guards'
import { handleRouteError } from './error-handlers'
import { isAuthorizationError } from './error-helpers'
import { checkRecordReadGate } from './record-read-gate'
import type { App } from '@/domain/models/app'
import type { CommentSpamStatus } from '@/domain/models/app/tables/comment-spam-classification'
import type { Context } from 'hono'

/**
 * Handle comment creation errors.
 *
 * The single failure exit for the create path. An authorization denial and a
 * genuinely absent record both answer 404 — the two classes S1 deliberately
 * collapses so the endpoint cannot be used to enumerate records
 * ([[isAuthorizationError]] draws that line, and excludes driver-raised
 * failures first so an infrastructure fault is never disguised as either).
 * Everything else is sanitized by the shared route error handler, which keeps
 * a malformed id a 400 and an operator fault a 500.
 *
 * DO NOT reintroduce a success-shaped branch here. Two have been removed:
 *
 *   - B3 fabricated a 201 "approved" envelope for a missing record whenever
 *     the table opted into the comments pipeline, which hid genuine
 *     not-found errors.
 *   - Its successor fabricated a 201 for `status !== 'approved'` denials,
 *     minting a `crypto.randomUUID()` for a comment that was never
 *     persisted. That one INVERTED the security posture: a caller forbidden
 *     from commenting was answered success-plus-an-id-that-resolves-to-
 *     nothing, and told they had been classified as spam. It was measured
 *     unreachable by every spec that could reach it before removal.
 *
 * Both existed to let spec fixtures POST to a literal `test-record-id` and
 * see a success. Fixtures now seed real records; a fixture that needs a
 * verdict observed must create a row and read the verdict back off it, which
 * is what [[persistResolvedComment]] does.
 */
function handleCommentError(c: Context, error: unknown) {
  // A parent in this thread that is itself a reply: the answer reveals nothing
  // the thread does not already show. Checked before anything is stored.
  if (error instanceof NestedCommentReplyError) {
    return c.json({ success: false, message: error.message, code: 'NESTED_REPLY_REJECTED' }, 422)
  }
  if (isAuthorizationError(error)) {
    return notFound(c)
  }
  return handleRouteError(c, error)
}

type CreateCommentGate =
  | {
      readonly ok: true
      readonly table: NonNullable<App['tables']>[number]
      readonly validated: CreateCommentBody
      /**
       * Spam classification verdict (PG-02), before it is combined with the
       * moderation policy. Every verdict — including `'pending'` and
       * `'rejected'` — is persisted: a moderated comment must be a durable
       * row so the admin moderation queue can list and act on it. No verdict
       * short-circuits persistence, and none synthesizes a response.
       */
      readonly spamStatus: CommentSpamStatus
      /**
       * Combined verdict (spam + moderation). Drives the response status
       * and whether persistence runs. See [[CombinedModerationStatus]]
       * for the precedence rules.
       */
      readonly combinedStatus: CombinedModerationStatus
    }
  | { readonly ok: false; readonly response: Response }

/**
 * Read the moderation slice of a table's comments config. Cast through the
 * locally-scoped [[CommentModerationConfig]] interface so the gate doesn't
 * pull Effect-Schema decode machinery into the request hot path (mirrors
 * the [[CommentsGateConfig]] cast pattern in `comment-spam-guards.ts`).
 */
function readModerationConfig(table: NonNullable<App['tables']>[number]): CommentModerationConfig {
  return (table.comments ?? {}) as CommentModerationConfig
}

/**
 * Resolve the bound table for a comment CREATE and map the comment verdict
 * (`authorizeComment`: the read, then the comment, table-level grant). Returns
 * the table on success, or a 404 response.
 *
 * comment-ability follows `permissions.comment`, not read. A table
 * with an explicit `permissions` block but neither a `comment` grant nor a
 * `comments` block is non-commentable (a "post-it" such as Partner's pains);
 * a role that can read but is not in the `comment` grant is denied. Both denials
 * (and a missing table) collapse to 404 (S1 anti-enumeration — a non-commentable
 * surface must not be discoverable via the comment endpoint).
 *
 * BOTH gates are group-aware. A bare role can never match a `group:<name>`
 * entry, so widening only the read half would leave a group-granted caller
 * denied by the comment half — invisibly, since both denials render the same
 * 404.
 */
const resolveCommentableTable = (c: Context, app: App, tableName: string) => {
  const table = app.tables?.find((t) => t.name === tableName)
  if (!table) return Effect.succeed(notFoundResponse(c))
  return Effect.map(callerRolesOnTable(c, table), (effectiveRoles) => {
    const verdict = authorizeComment(table, { effectiveRoles, allTables: app })
    return verdict._tag === 'Allowed' ? table : notFoundResponse(c)
  })
}

/**
 * Resolve the `autoApprove.previouslyApproved` input for the moderation policy
 * has this guest email already earned an
 * approved comment on this table?
 *
 * The lookup lives here rather than in `resolveCommentModerationStatus` because
 * that helper is pure and synchronous by contract — it declares
 * `priorApprovedCommentExists` as a caller-resolved input precisely so the repo
 * call sits at the route layer. Mirrors [[checkReplyParent]]'s
 * `CommentRepository` read on the request's services.
 *
 * Guarded so a table that has not opted in pays nothing — no query is issued
 * unless ALL of:
 *   - moderation is actually on (an unmoderated table approves regardless),
 *   - `autoApprove.previouslyApproved` is explicitly `true` (the schema field
 *     is optional with NO default, and the policy requires `=== true`),
 *   - the caller is a guest (an authenticated caller is served by the
 *     `authenticated` rung and carries no `guestEmail`),
 *   - a `guestEmail` was actually supplied.
 *
 * Fail-closed: a failed lookup resolves `false`, so an infrastructure fault
 * queues the comment for review rather than publishing it unmoderated.
 */
const resolvePriorGuestApproval = (input: {
  readonly session: ReturnType<typeof getTableContext>['session']
  /** Every key of the table (`commentTableKeysOf`): an approval counts under any of them. */
  readonly tableKeys: readonly string[]
  readonly moderationConfig: CommentModerationConfig
  readonly isAuthenticated: boolean
  readonly guestEmail: string | undefined
}) =>
  Effect.gen(function* () {
    const { session, tableKeys, moderationConfig, isAuthenticated, guestEmail } = input
    if (!isModerationEnabled(moderationConfig)) return false
    if (moderationConfig.autoApprove?.previouslyApproved !== true) return false
    if (isAuthenticated || guestEmail === undefined) return false

    const lookup = yield* Effect.result(
      Effect.gen(function* () {
        const repo = yield* CommentRepository
        return yield* repo.hasApprovedGuestComment({ session, tableKeys, guestEmail })
      })
    )
    return lookup._tag === 'Success' && lookup.success
  })

/**
 * PG-02 moderation: `'auth-required'` mode rejects guest submissions outright.
 * Returns 401 (not 404) so legitimate clients know to authenticate and retry;
 * `undefined` when the caller may proceed.
 *
 * Mirrors [[applyRateLimit]]'s `Response | undefined` guard shape so the gate
 * reads as a flat sequence of guards.
 *
 * `code` is the canonical `UNAUTHORIZED` that every other 401 on the API
 * sends. It was `AUTH_REQUIRED` — a second spelling of the same refusal,
 * invented here and listed by no published schema, so a generated client had
 * to know both spellings to handle "you are not signed in"
 * The `message` stays specific: the code says what
 * happened, the sentence says where.
 */
function requireCommentAuthentication(input: {
  readonly c: Context
  readonly moderationConfig: CommentModerationConfig
  readonly isAuthenticated: boolean
}): Response | undefined {
  const { c, moderationConfig, isAuthenticated } = input
  if (!requiresAuthenticationForComment(moderationConfig) || isAuthenticated) return undefined
  return c.json(
    {
      success: false,
      message: 'Authentication required to post comments',
      code: ApiErrorCode.UNAUTHORIZED,
    },
    401
  )
}

const refusedGate = (response: Response): CreateCommentGate => ({ ok: false, response })

const checkCreateCommentGate = (c: Context, app: App) =>
  Effect.gen(function* () {
    const { tableName, tableId, session } = getTableContext(c)
    const tableOrResponse = yield* resolveCommentableTable(c, app, tableName)
    if (tableOrResponse instanceof Response) return refusedGate(tableOrResponse)
    const table = tableOrResponse

    // Runs BEFORE body parse so unauthenticated bots can't probe the moderation
    // pipeline by sending malformed bodies.
    const moderationConfig = readModerationConfig(table)
    const isAuthenticated = isAuthenticatedSession(session.userId)
    // Then the post joins the record's thread: it answers to the record's
    // row-level read rule, and a record the caller may not open refuses it
    // exactly as a missing one — before anything is parsed, classified or stored.
    const refusal =
      requireCommentAuthentication({ c, moderationConfig, isAuthenticated }) ??
      (yield* checkRecordReadGate(c, app, table, c.req.param('recordId')!))
    if (refusal !== undefined) return refusedGate(refusal)

    // effect-promise: total -- a body that is not JSON is caught here and read as none.
    const body: unknown = yield* Effect.promise(() => c.req.json().catch(() => undefined))

    // PG-02 honeypot: bots that auto-fill every input give themselves away via
    // the hidden field. Silently 200 the submission BEFORE attempting validation
    // — the create-comment program is never invoked so no record/comment row is
    // touched. Runs before body validation so a deliberately-malformed bot
    // request still gets the silent-discard treatment.
    if (isHoneypotEnabled(table) && readHoneypotValue(body) !== undefined) {
      return refusedGate(
        shapedJson(c, { success: true, discarded: true }, discardedCommentResponseSchema)
      )
    }

    // PG-02 rate-limit: reuse [internal ref]'s in-process sliding-window limiter so
    // comment + form rate-limits share the same machinery and per-IP-hash
    // privacy contract. Runs AFTER honeypot (a tripped honeypot must not
    // consume a rate-limit slot) and BEFORE body validation so spammers
    // sending deliberately-malformed bodies still get gated.
    const rateLimitResponse = applyRateLimit({ c, table })
    if (rateLimitResponse !== undefined) return refusedGate(rateLimitResponse)

    const validated = judgeCreateCommentBody(c, body)
    if (validated instanceof Response) return refusedGate(validated)

    const priorApprovedCommentExists = yield* resolvePriorGuestApproval({
      session,
      tableKeys: commentTableKeysOf(table, tableId),
      moderationConfig,
      isAuthenticated,
      guestEmail: validated.guestEmail,
    })

    const { spamStatus, combinedStatus } = classifyComment({
      table,
      content: validated.content,
      moderationConfig,
      isAuthenticated,
      priorApprovedCommentExists,
    })

    const admitted: CreateCommentGate = { ok: true, table, validated, spamStatus, combinedStatus }
    return admitted
  })

/**
 * Resolve a freshly-submitted comment's spam + moderation verdict.
 * Extracted from `checkCreateCommentGate` to keep that gate under the
 * `max-statements` limit. Server-side so a direct API call cannot bypass
 * the table-level configuration.
 */
function classifyComment(input: {
  readonly table: NonNullable<App['tables']>[number]
  readonly content: string
  readonly moderationConfig: CommentModerationConfig
  readonly isAuthenticated: boolean
  /**
   * Pre-resolved by [[resolvePriorGuestApproval]] at the (async) gate so this
   * function — and the pure policy helper it delegates to — stay synchronous.
   */
  readonly priorApprovedCommentExists: boolean
}): { readonly spamStatus: CommentSpamStatus; readonly combinedStatus: CombinedModerationStatus } {
  // PG-02 content classification: blocked-words → 'rejected',
  // link-threshold → 'pending', otherwise 'approved'.
  const spamStatus = classifySpam(input.table, input.content)

  // PG-02 moderation policy: when manual moderation is on, fresh comments are
  // queued unless an `autoApprove` rule fires — either `authenticated` (from the
  // session) or `previouslyApproved` (from the guest-email lookup the caller
  // already resolved).
  const moderationStatus = resolveCommentModerationStatus(input.moderationConfig, {
    isAuthenticated: input.isAuthenticated,
    priorApprovedCommentExists: input.priorApprovedCommentExists,
  })
  return { spamStatus, combinedStatus: combineModerationVerdicts(spamStatus, moderationStatus) }
}

export function handleCreateComment(c: Context, app: App) {
  return runHandlerEffect(c, answerFailures(c, createCommentResponse(c, app)))
}

/** Gate, store and answer a comment, as one program. */
const createCommentResponse = (c: Context, app: App) =>
  Effect.gen(function* () {
    const gate = yield* checkCreateCommentGate(c, app)
    if (!gate.ok) return gate.response
    const { session, tableId, userRole } = getTableContext(c)
    const { table, validated, combinedStatus } = gate

    // Every verdict — `'approved'`, `'pending'`, `'rejected'` — takes this one
    // path and is stored, so a moderated comment is a durable row the moderation
    // queue can act on; the response `status` is read back off the stored row,
    // so a caller never receives an id for a comment that does not exist.
    // Failures are failures ([[handleCommentError]]).
    const result = yield* Effect.result(
      postCommentProgram({
        app,
        table,
        tableId,
        recordId: c.req.param('recordId')!,
        content: validated.content,
        parentCommentId: validated.parentCommentId,
        mentions: validated.mentions,
        guestName: validated.guestName,
        guestEmail: validated.guestEmail,
        author: { kind: 'session', session, userRole },
        status: combinedStatus,
        // The comment automations run before the post answers, as they always have.
        announce: (event) => triggerCommentEventAutomations({ ...event, app }),
      })
    )
    if (result._tag === 'Failure') return handleCommentError(c, result.failure)

    // Emit ONLY the display comment (no-email `user`): the author with an email
    // feeds the comment trigger and must never reach the wire (B1).
    const { comment, mentioned } = result.success
    return shapedJson(
      c,
      {
        comment: { ...comment, mentions: mentioned.mentions },
        status: comment.status,
      },
      createCommentResponseSchema,
      201
    )
  })
