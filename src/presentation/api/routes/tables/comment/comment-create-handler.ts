/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { CommentRepository } from '@/application/ports/repositories/comment-repository'
import { createCommentProgram } from '@/application/use-cases/tables/comment-programs'
import {
  isModerationEnabled,
  resolveCommentModerationStatus,
  requiresAuthenticationForComment,
  type CommentModerationConfig,
} from '@/domain/services/comments/comment-moderation-policy'
import { isAuthenticatedSession } from '@/domain/services/guest-session'
import { hasCommentPermission, hasReadPermission } from '@/domain/validators/permission-evaluators'
import { runTableProgram } from '@/infrastructure/layers/table-layer'
import { getTableContext } from '@/presentation/api/utils/context-helpers'
import { handleRouteError } from '../error-handlers'
import { isAuthorizationError } from '../utils'
import { notFoundResponse } from './comment-handler-shared'
import { applyRateLimit, classifySpam } from './comment-spam-guards'
import { buildTriggerDispatchArgs, dispatchCommentPostedTrigger } from './comment-trigger-dispatch'
import type { App } from '@/domain/models/app'
import type { CommentSpamStatus } from '@/domain/services/comments/comment-spam-classification'
import type { Context } from 'hono'

/**
 * Create comment request validation
 *
 * Accepts either `content` (legacy) or `body` (Y-6 comment-posted trigger
 * spec) as the comment text — both validate as a non-empty string up to
 * 10,000 characters. Optional `parentCommentId` distinguishes replies
 * from top-level comments; optional `mentions[]` carries the
 * already-resolved user IDs for the trigger envelope (the engine does
 * NOT re-parse `@<name>` markup from the body).
 */
interface CreateCommentBody {
  readonly content: string
  readonly parentCommentId?: string
  readonly mentions: readonly string[]
  /**
   * Guest identity. Present only for
   * unauthenticated guest submissions to a `guestComments: true` table.
   * The create write-path stores these alongside `userId: null` so the
   * comment can be attributed to the guest without a Better Auth user row.
   */
  readonly guestName?: string
  readonly guestEmail?: string
}

/**
 * Validate the comment text portion of the request body. Returns
 * `undefined` when neither `content` nor `body` is present, when both
 * are non-string, or when the resolved string is empty / over 10,000
 * characters.
 */
function validateCommentText(payload: Record<string, unknown>): string | undefined {
  const { content, body } = payload
  const candidate = typeof body === 'string' ? body : typeof content === 'string' ? content : ''
  if (candidate.length === 0 || candidate.length > 10_000) return undefined
  return candidate
}

/**
 * Validate create comment request body
 */
function validateCreateCommentBody(body: unknown): CreateCommentBody | undefined {
  if (typeof body !== 'object' || body === null) return undefined
  const payload = body as Record<string, unknown>

  const text = validateCommentText(payload)
  if (text === undefined) return undefined

  const { parentCommentId, mentions, guestName, guestEmail } = payload
  const validatedParent = typeof parentCommentId === 'string' ? parentCommentId : undefined
  const validatedMentions = Array.isArray(mentions)
    ? mentions.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : []
  const validatedGuestName =
    typeof guestName === 'string' && guestName.length > 0 ? guestName : undefined
  const validatedGuestEmail =
    typeof guestEmail === 'string' && guestEmail.length > 0 ? guestEmail : undefined

  return {
    content: text,
    parentCommentId: validatedParent,
    mentions: validatedMentions,
    guestName: validatedGuestName,
    guestEmail: validatedGuestEmail,
  }
}

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
  if (isAuthorizationError(error)) {
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  }
  return handleRouteError(c, error)
}

/**
 * PG-02 honeypot guard. When the table has `comments.guestComments: true` and
 * the request body contains a non-empty `honeypot` value, silently discard
 * the submission by returning HTTP 200 with `{ discarded: true }`. The 200
 * status (not 201) signals "accepted-but-not-created" to bots without leaking
 * which guard caught them. Always-on safety: enabled by default whenever
 * `guestComments: true`, even without an explicit `spamProtection.honeypot`
 * setting (zero-config safety floor per the PG-02 locked decision).
 */
function isHoneypotEnabled(table: NonNullable<App['tables']>[number]): boolean {
  const cfg = (table.comments ?? {}) as {
    guestComments?: boolean
    spamProtection?: { honeypot?: boolean }
  }
  if (!cfg.guestComments) return false
  // Default: honeypot is on when guest comments are enabled. Disable only when
  // explicitly set to `false`.
  return cfg.spamProtection?.honeypot !== false
}

function readHoneypotValue(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null) return undefined
  const value = (body as Record<string, unknown>).honeypot
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

/**
 * Combined moderation verdict for a freshly-submitted comment.
 *
 * Resolved at the gate boundary by combining the spam classification
 * (PG-02 spam-protection.spec.ts) and the moderation policy (PG-02
 * comment-moderation-queue.spec.ts). The combined precedence is:
 *
 *   1. spam `'rejected'` → `'rejected'` (always wins; obvious-spam
 *      never reaches the moderation queue)
 *   2. spam `'pending'` → `'pending'` (link-threshold flags content for
 *      review regardless of the table's moderation setting)
 *   3. spam `'approved'` AND moderation `'pending'` → `'pending'`
 *      (queue manual-mode comments without spam triggers)
 *   4. spam `'approved'` AND moderation `'approved'` → `'approved'`
 *
 * Note: a moderation policy of `'auth-required'` is enforced separately
 * at the gate (it returns a 401 BEFORE the verdict resolves) so it
 * doesn't appear in this type — only the published statuses do.
 */
type CombinedModerationStatus = 'approved' | 'pending' | 'rejected'

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
 * Combine the spam-classifier verdict with the moderation policy verdict.
 * Spam-verdicts of `'pending'`/`'rejected'` win over moderation policy so
 * obviously-spammy submissions never sit in the manual-review queue.
 */
function combineModerationVerdicts(
  spamStatus: CommentSpamStatus,
  moderationStatus: 'approved' | 'pending'
): CombinedModerationStatus {
  if (spamStatus === 'rejected') return 'rejected'
  if (spamStatus === 'pending') return 'pending'
  // spamStatus === 'approved'
  return moderationStatus
}

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
 * Resolve the bound table for a comment CREATE and enforce the read + comment
 * permission gates. Returns the table on success, or a 404 response.
 *
 * [internal ref]: comment-ability follows `permissions.comment`, not read. A table
 * with an explicit `permissions` block but neither a `comment` grant nor a
 * `comments` block is non-commentable (a "post-it" such as Partner's pains);
 * a role that can read but is not in the `comment` grant is denied. Both denials
 * (and a missing table) collapse to 404 (S1 anti-enumeration — a non-commentable
 * surface must not be discoverable via the comment endpoint).
 */
function resolveCommentableTable(
  c: Context,
  app: App,
  tableName: string,
  userRole: string
): NonNullable<App['tables']>[number] | Response {
  const table = app.tables?.find((t) => t.name === tableName)
  if (
    !table ||
    !hasReadPermission(table, userRole, app.tables) ||
    !hasCommentPermission(table, userRole, app.tables)
  ) {
    return notFoundResponse(c)
  }
  return table
}

/**
 * Resolve the `autoApprove.previouslyApproved` input for the moderation policy
 *: has this guest email already earned an
 * approved comment on this table?
 *
 * The lookup lives here rather than in `resolveCommentModerationStatus` because
 * that helper is pure and synchronous by contract — it declares
 * `priorApprovedCommentExists` as a caller-resolved input precisely so the repo
 * call sits at the route layer. Mirrors [[checkSingleLevelThreading]]'s
 * `runTableProgram` + `CommentRepository` pattern.
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
async function resolvePriorGuestApproval(input: {
  readonly session: ReturnType<typeof getTableContext>['session']
  readonly tableId: string
  readonly moderationConfig: CommentModerationConfig
  readonly isAuthenticated: boolean
  readonly guestEmail: string | undefined
}): Promise<boolean> {
  const { session, tableId, moderationConfig, isAuthenticated, guestEmail } = input
  if (!isModerationEnabled(moderationConfig)) return false
  if (moderationConfig.autoApprove?.previouslyApproved !== true) return false
  if (isAuthenticated || guestEmail === undefined) return false

  const lookup = await runTableProgram(
    Effect.gen(function* () {
      const repo = yield* CommentRepository
      return yield* repo.hasApprovedGuestComment({ session, tableId, guestEmail })
    })
  )
  return lookup._tag === 'Right' && lookup.right
}

/**
 * PG-02 moderation: `'auth-required'` mode rejects guest submissions outright.
 * Returns 401 (not 404) so legitimate clients know to authenticate and retry;
 * `undefined` when the caller may proceed.
 *
 * Mirrors [[applyRateLimit]]'s `Response | undefined` guard shape so the gate
 * reads as a flat sequence of guards.
 */
function requireCommentAuthentication(input: {
  readonly c: Context
  readonly moderationConfig: CommentModerationConfig
  readonly isAuthenticated: boolean
}): Response | undefined {
  const { c, moderationConfig, isAuthenticated } = input
  if (!requiresAuthenticationForComment(moderationConfig) || isAuthenticated) return undefined
  return c.json(
    { success: false, message: 'Authentication required to post comments', code: 'AUTH_REQUIRED' },
    401
  )
}

async function checkCreateCommentGate(c: Context, app: App): Promise<CreateCommentGate> {
  const { tableName, tableId, userRole, session } = getTableContext(c)
  const tableOrResponse = resolveCommentableTable(c, app, tableName, userRole)
  if (tableOrResponse instanceof Response) return { ok: false, response: tableOrResponse }
  const table = tableOrResponse

  // Runs BEFORE body parse so unauthenticated bots can't probe the moderation
  // pipeline by sending malformed bodies.
  const moderationConfig = readModerationConfig(table)
  const isAuthenticated = isAuthenticatedSession(session.userId)
  const authResponse = requireCommentAuthentication({ c, moderationConfig, isAuthenticated })
  if (authResponse !== undefined) return { ok: false, response: authResponse }

  const body = await c.req.json().catch(() => undefined)

  // PG-02 honeypot: bots that auto-fill every input give themselves away via
  // the hidden field. Silently 200 the submission BEFORE attempting validation
  // — the create-comment program is never invoked so no record/comment row is
  // touched. Runs before body validation so a deliberately-malformed bot
  // request still gets the silent-discard treatment.
  if (isHoneypotEnabled(table) && readHoneypotValue(body) !== undefined) {
    return { ok: false, response: c.json({ success: true, discarded: true }, 200) }
  }

  // PG-02 rate-limit: reuse F-03's in-process sliding-window limiter so
  // comment + form rate-limits share the same machinery and per-IP-hash
  // privacy contract. Runs AFTER honeypot (a tripped honeypot must not
  // consume a rate-limit slot) and BEFORE body validation so spammers
  // sending deliberately-malformed bodies still get gated.
  const rateLimitResponse = applyRateLimit({ c, table })
  if (rateLimitResponse !== undefined) return { ok: false, response: rateLimitResponse }

  const validated = validateCreateCommentBody(body)
  if (!validated) {
    return {
      ok: false,
      response: c.json(
        { success: false, message: 'Invalid request body', code: 'VALIDATION_ERROR' },
        400
      ),
    }
  }

  const priorApprovedCommentExists = await resolvePriorGuestApproval({
    session,
    tableId,
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

  return { ok: true, table, validated, spamStatus, combinedStatus }
}

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

/**
 * Single-level threading depth check.
 *
 * When a `parentCommentId` is provided, look up the referenced comment and
 * reject with HTTP 422 if it itself has a non-null `parentId` (i.e. it's
 * already a reply). Returns `undefined` when the parent is top-level OR
 * when the referenced parent could not be found — the latter falls through
 * to the existing 404 path in the create-program. Spec-fixture parents
 * (literal strings like `'reply-comment-id'`) are also treated as not-found
 * and fall through, so non-existent parents still produce the documented
 * not-found behavior (rather than a 422 false positive).
 */
async function checkSingleLevelThreading(
  c: Context,
  parentCommentId: string | undefined
): Promise<Response | undefined> {
  if (parentCommentId === undefined) return undefined
  const { session } = getTableContext(c)
  const lookup = await runTableProgram(
    Effect.gen(function* () {
      const repo = yield* CommentRepository
      return yield* repo.getWithUser({ session, commentId: parentCommentId })
    })
  )
  if (lookup._tag === 'Left' || lookup.right === undefined) return undefined
  if (lookup.right.parentId !== null) {
    return c.json(
      {
        success: false,
        message:
          'Cannot reply to a reply — parentCommentId must reference a top-level comment (single-level threading)',
        code: 'NESTED_REPLY_REJECTED',
      },
      422
    )
  }
  return undefined
}

export async function handleCreateComment(c: Context, app: App) {
  const gate = await checkCreateCommentGate(c, app)
  if (!gate.ok) return gate.response
  const { session, tableId, userRole } = getTableContext(c)
  const recordId = c.req.param('recordId')!
  const { table, validated, combinedStatus } = gate

  // Single-level threading depth check — must run BEFORE the moderation
  // short-circuit so a nested-reply attempt that would otherwise spam-classify
  // still gets the canonical 422 verdict.
  const depthResponse = await checkSingleLevelThreading(c, validated.parentCommentId)
  if (depthResponse !== undefined) return depthResponse

  // PG-02 moderation persistence: persist the comment with the resolved
  // verdict (`'approved'` | `'pending'` | `'rejected'`) so a moderated
  // comment is a durable row the admin moderation queue
  // can list, approve, and reject. Every
  // verdict takes this one path — the response `status` is read back off the
  // committed row, so a caller never receives an id for a comment that does
  // not exist. Failures are failures ([[handleCommentError]]).
  return persistResolvedComment({
    c,
    app,
    table,
    validated,
    session,
    tableId,
    recordId,
    userRole,
    status: combinedStatus,
  })
}

/**
 * Fire the Y-6 comment-posted trigger, but ONLY for approved comments.
 * A comment awaiting moderation (pending) or rejected is not yet a visible
 * thread event, so it must not notify thread participants (preserves the
 * prior non-approved short-circuit's no-trigger behavior). Swallows errors —
 * the comment is already committed and the API response must reflect success.
 * The trigger gets the FULL author (with email); the HTTP response only ever
 * carries the no-email display projection (B1 — commenter email off the wire).
 */
async function maybeFireCommentPostedTrigger(input: {
  readonly app: App
  readonly table: NonNullable<App['tables']>[number]
  readonly validated: CreateCommentBody
  readonly session: ReturnType<typeof getTableContext>['session']
  readonly tableId: string
  readonly recordId: string
  readonly userRole: string
  readonly status: CombinedModerationStatus
  readonly result: Effect.Effect.Success<ReturnType<typeof createCommentProgram>>
}): Promise<void> {
  const { app, table, validated, session, tableId, recordId, userRole, status, result } = input
  if (status !== 'approved') return
  // eslint-disable-next-line functional/no-expression-statements -- IO boundary: trigger dispatch returns void
  await dispatchCommentPostedTrigger(
    buildTriggerDispatchArgs({
      app,
      tableName: table.name,
      tableId,
      recordId,
      userRole,
      session,
      comment: result.comment,
      author: result.author,
      mentions: validated.mentions,
    })
  )
}

async function persistResolvedComment(input: {
  readonly c: Context
  readonly app: App
  readonly table: NonNullable<App['tables']>[number]
  readonly validated: CreateCommentBody
  readonly session: ReturnType<typeof getTableContext>['session']
  readonly tableId: string
  readonly recordId: string
  readonly userRole: string
  /**
   * Resolved moderation verdict (PG-02). Persisted to the row by the create
   * program; the create response's `status` is then read back from the
   * persisted comment, not a synthesized literal.
   */
  readonly status: CombinedModerationStatus
}): Promise<Response> {
  const { c, app, table, validated, session, tableId, recordId, userRole, status } = input

  const result = await runTableProgram(
    createCommentProgram({
      session,
      tableId,
      recordId,
      tableName: table.name,
      content: validated.content,
      parentCommentId: validated.parentCommentId,
      guestName: validated.guestName,
      guestEmail: validated.guestEmail,
      status,
    })
  )

  // A failed create is reported as a failure. There is no verdict-dependent
  // branch here: see [[handleCommentError]] for why fabricating a success for
  // a non-approved verdict is the exact inversion this path must not have.
  if (result._tag === 'Left') return handleCommentError(c, result.left)

  // eslint-disable-next-line functional/no-expression-statements -- IO boundary: trigger dispatch returns void
  await maybeFireCommentPostedTrigger({
    app,
    table,
    validated,
    session,
    tableId,
    recordId,
    userRole,
    status,
    result: result.right,
  })

  // Emit ONLY the display comment (no-email `user`). `result.right.author`
  // carries the commenter email for the trigger above and must never be
  // serialized to the wire (B1). The top-level `status` is read back from
  // the PERSISTED row (`result.right.comment.status`), not a synthesized
  // literal — so the response reflects the verdict actually committed.
  return c.json({ comment: result.right.comment, status: result.right.comment.status }, 201)
}
