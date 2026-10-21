/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The recipients a comment-posted run is handed: the thread's earlier authors
 * (or the record owner on a first comment) and the people the comment
 * mentions, as email addresses. Every lookup is fail-soft — a recipient whose
 * address cannot be read is left out and the run still starts — and every
 * such failure is logged with its cause.
 */

import { Effect } from 'effect'
import { CommentRepository } from '@/application/ports/repositories/comment-repository'
import { commentTableKeysOf } from '@/domain/models/app/tables/comment-address-service'
import { logError } from '@/infrastructure/logging/logger'
import { addressesOfRecordReaders, type ThreadPerson } from './thread-participant-readers'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { AudienceRequirements } from '@/application/use-cases/tables/comment-mention-programs'
import type { App } from '@/domain/models/app'

/** The comment a recipient list is resolved for. */
export interface CommentRecipientsScope {
  readonly app: App
  readonly tableName: string
  readonly tableId: string
  readonly recordId: string
  readonly session: Readonly<UserSession>
  /** The new comment's author; `undefined` for a comment the app wrote. */
  readonly authorId: string | undefined
}

/**
 * Read the first non-empty owner user id from `record`, searching the table's
 * declared `created-by` field name(s) FIRST ([internal ref]: the owner column may be
 * custom-named, e.g. `author`), then the literal `created_by` / `createdBy`
 * fallthrough (back-compat — keeps an automation trigger comment spec green
 * for tables whose created-by field IS literally named `created_by`).
 */
const readOwnerId = (
  record: Readonly<Record<string, unknown>>,
  createdByNames: readonly string[]
): string | undefined => {
  const candidates = [...createdByNames, 'created_by', 'createdBy']
  const owner = candidates
    .map((name) => record[name])
    .find((value): value is string => typeof value === 'string' && value.length > 0)
  return owner
}

/**
 * Log a failed recipient lookup with its cause, before the caller falls back
 * to naming nobody: the run still starts, and the missing recipient is traced.
 */
const logRecipientLookupFailure =
  (lookup: string, context: Readonly<Record<string, string>>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
    effect.pipe(
      Effect.tapCause((cause) =>
        Effect.sync(() =>
          logError(
            `[automations] comment trigger ${lookup} lookup failed; continuing without it`,
            cause,
            context
          )
        )
      )
    )

/**
 * The record OWNER, as a person of the thread, for the first-comment fallback:
 * read from the table's declared `created-by` field — which may be
 * custom-named, e.g. `author` — or the literal `created_by` / `createdBy`.
 * None when the owner cannot be resolved, is the new author, or has no
 * account row.
 */
const resolveOwner = (
  session: Readonly<UserSession>,
  record: Readonly<Record<string, unknown>>,
  newAuthorId: string,
  createdByNames: readonly string[]
): Effect.Effect<readonly ThreadPerson[], never, CommentRepository> =>
  Effect.gen(function* () {
    const comments = yield* CommentRepository
    const ownerId = readOwnerId(record, createdByNames)
    if (ownerId === undefined || ownerId === newAuthorId) return []
    // effect-swallow: fail-soft — an owner whose address cannot be read is left out of the recipients; the comment and its run still go ahead, and the failure is logged above.
    const emailResult = yield* Effect.result(
      comments
        .getUserEmailById({ session, userId: ownerId })
        .pipe(logRecipientLookupFailure('record owner', { userId: ownerId }))
    )
    if (emailResult._tag === 'Failure' || !emailResult.success) return []
    return [{ userId: ownerId, email: emailResult.success }]
  })

/** Every key the thread's comments may be stored under: the posted one, the table's id and name. */
const threadTableKeysOf = (input: CommentRecipientsScope): readonly string[] => {
  const table = input.app.tables?.find((candidate) => candidate.name === input.tableName)
  return table === undefined ? [input.tableId] : commentTableKeysOf(table, input.tableId)
}

/**
 * Resolve `threadParticipants` for the just-posted comment: the
 * distinct EMAIL ADDRESSES of the (non-soft-deleted) authors of the thread on
 * the same record OF THE SAME TABLE — keyed on `(table, recordId)` under every
 * key of the table, since record ids are per-table sequences — minus the new
 * author, usable directly as an `email.send` `to`. Only the people the record
 * still admits are named ({@link addressesOfRecordReaders}): an author whose
 * grant was withdrawn or whose role no longer reads it is left out. With no
 * earlier author left (a first comment), the record OWNER is named instead,
 * while the record still admits her, so a notify-thread automation still has
 * a recipient.
 */
export const resolveThreadParticipants = (params: {
  readonly input: CommentRecipientsScope
  readonly record: Readonly<Record<string, unknown>>
  readonly createdByNames: readonly string[]
}): Effect.Effect<readonly string[], never, CommentRepository | AudienceRequirements> =>
  Effect.gen(function* () {
    const { input, record, createdByNames } = params
    const { session, recordId } = input
    const newAuthorId = input.authorId ?? ''
    const comments = yield* CommentRepository
    // effect-swallow: fail-soft — a thread whose authors cannot be read names no earlier author and falls back to the record owner; the run still starts, and the failure is logged above.
    const authorsResult = yield* Effect.result(
      comments
        .listAuthorEmailsForRecord({ session, tableKeys: threadTableKeysOf(input), recordId })
        .pipe(
          logRecipientLookupFailure('thread participants', {
            tableSlug: input.tableName,
            recordId,
          })
        )
    )
    const prior =
      authorsResult._tag === 'Failure'
        ? []
        : authorsResult.success.filter((author) => author.userId !== newAuthorId)
    const scope = { app: input.app, tableName: input.tableName, recordId, session }
    const priorEmails = yield* addressesOfRecordReaders(scope, prior)
    if (priorEmails.length > 0) return priorEmails
    const owner = yield* resolveOwner(session, record, newAuthorId, createdByNames)
    return yield* addressesOfRecordReaders(scope, owner)
  }).pipe(Effect.withSpan('automations.comment-trigger.thread-participants'))

/**
 * Resolve `mentionedEmails` for the just-posted comment.
 *
 * The EMAIL ADDRESSES of the users named in `mentions`, in mention order,
 * usable directly as an `email.send` `to`. This is the exact twin of [internal ref]:
 * `mentions` is — and stays — `UUID[]` (an automation trigger comment spec
 * pins that, and it is the documented payload contract), so
 * `to: '{{trigger.mentions}}'` renders a comma-joined list of ids and the
 * action fails with "email.send requires a `to` address". Rather than change
 * the type of `mentions` and break both, we surface a SIBLING field that is
 * already addresses.
 *
 * The comment's own author is dropped even when they appear in `mentions`:
 * a self-mention must not send someone a notification about their own
 * comment. Ids that do not resolve to a user row (deleted user, bad id from
 * the caller) are skipped rather than failing the dispatch — a mention
 * automation that half-delivers is better than a comment endpoint that
 * silently drops its automation. Duplicate ids collapse to one address.
 */
export const resolveMentionedEmails = (params: {
  readonly session: Readonly<UserSession>
  readonly mentions: readonly string[]
  readonly newAuthorId: string
}): Effect.Effect<readonly string[], never, CommentRepository> =>
  Effect.gen(function* () {
    const { session, mentions, newAuthorId } = params
    const targets = [...new Set(mentions)].filter((userId) => userId !== newAuthorId)
    if (targets.length === 0) return [] as readonly string[]
    const comments = yield* CommentRepository
    const resolved = yield* Effect.forEach(
      targets,
      (userId) =>
        // effect-swallow: fail-soft — a mention whose address cannot be read is skipped, as an unknown id is; the others are still notified, and the failure is logged above.
        Effect.map(
          Effect.result(
            comments
              .getUserEmailById({ session, userId })
              .pipe(logRecipientLookupFailure('mentioned user', { userId }))
          ),
          (result) => (result._tag === 'Failure' ? undefined : result.success)
        ),
      { concurrency: 1 }
    )
    return resolved.filter(
      (email): email is string => typeof email === 'string' && email.length > 0
    )
  }).pipe(Effect.withSpan('automations.comment-trigger.mentioned-emails'))
