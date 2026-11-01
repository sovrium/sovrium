/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { NotFoundError } from '@/domain/errors'
import { isGuestSession } from '@/domain/models/app/auth/guest-session'
import type { UserSession } from '@/application/ports/contracts/user-session'

/**
 * Refuse a visitor who is not signed in before a comment edit or delete reads
 * the comment store.
 *
 * Only a signed-in person authors a comment, and only an author or a moderator
 * edits or deletes one: a visitor is neither. A guest comment is stored with no
 * author at all, so it is no visitor's either. She is answered exactly as for a
 * comment that does not exist, and nothing is read on her behalf.
 */
export const refuseVisitorAsAuthor = (
  session: Readonly<Pick<UserSession, 'userId'>>
): Effect.Effect<void, NotFoundError> =>
  (isGuestSession(session.userId)
    ? Effect.fail(new NotFoundError('Comment not found'))
    : Effect.void
  ).pipe(Effect.withSpan('tables.refuse-visitor-as-author'))
