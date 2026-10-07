/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { CommentRepository } from '@/application/ports/repositories/comment-repository'
import { listMentionableUsersProgram } from '@/application/use-cases/tables/comment-mention-programs'
import { NotFoundError } from '@/domain/errors'
import { mentionableUsersResponseSchema } from '@/domain/models/api/tables/comments'
import { isAuthenticatedSession } from '@/domain/models/app/auth/guest-session'
import { provideDomain } from '@/infrastructure/logging/request-effect'
import { requireSession } from '@/presentation/api/runtime/auth-helpers'
import { getTableContext } from '@/presentation/api/runtime/context-helpers'
import { runEffect } from '@/presentation/api/runtime/run-effect'
import { notFoundResponse, resolveTableForListing } from './comment-handler-shared'
import { checkRecordReadGate } from './record-read-gate'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

/** Longest search term the picker forwards; a name longer than this matches nobody. */
const MAX_TERM_LENGTH = 100

/**
 * `GET /api/tables/:tableId/records/:recordId/comments/mentionable?q=`
 *
 * The candidate source for the comment composer's `@` picker: the people who
 * can read the record, other than the caller, whose name matches `q` —
 * `{ users: [{ id, name, image }] }`, never an email.
 *
 * The caller must be signed in (a guest writes no mention) and must be able to
 * read the record, under the same two gates the comment list applies: table
 * read over their role and groups, then the record itself. Every refusal after
 * the session is a uniform 404, so the endpoint cannot tell a caller whether a
 * record they may not read exists (S1).
 */
export async function handleListMentionable(c: Context, app: App): Promise<Response> {
  const auth = requireSession(c)
  if (!auth.ok) return auth.response
  const { session } = getTableContext(c)
  if (!isAuthenticatedSession(session.userId)) return notFoundResponse(c)

  const tableId = c.req.param('tableId')!
  const recordId = c.req.param('recordId')!
  const table = await resolveTableForListing(c, app, tableId)
  if (table instanceof Response) return table
  // The CALLER must be able to read the record — row-level rule included —
  // before the picker names anyone who can.
  const gateError = await checkRecordReadGate(c, app, table, recordId)
  if (gateError) return gateError

  const term = c.req.query('q')?.trim().slice(0, MAX_TERM_LENGTH)
  const program = Effect.gen(function* () {
    const comments = yield* CommentRepository
    const readable = yield* comments.checkRecordExists({
      session,
      tableName: table.name,
      recordId,
    })
    if (!readable) return yield* Effect.fail(new NotFoundError('Record not found'))
    const users = yield* listMentionableUsersProgram({
      app,
      table,
      recordId,
      session,
      term: term === '' ? undefined : term,
    })
    return { users }
  })

  return runEffect(c, provideDomain(c, program), mentionableUsersResponseSchema)
}
