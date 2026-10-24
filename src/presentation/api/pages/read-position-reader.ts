/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { readPositionsProgram } from '@/application/use-cases/tables/read-state-programs'
import { isGuestSession } from '@/domain/models/app/auth/guest-session'
import { serverNow } from '@/domain/models/process-env/dev-clock'
import { logError } from '@/infrastructure/logging/logger'
import { runOnRequest } from '@/presentation/api/runtime/run-effect'
import type { ReadReadPosition } from '@/application/ports/repositories/tables/read-state-repository'
import type { Context } from 'hono'

/**
 * The header a conversation's redraw carries: the read position its page was
 * drawn from, on one parent, as URI-encoded JSON `{ table, recordId, since }`.
 * The island sends it under the same name.
 */
const OPENED_READ_POSITION_HEADER = 'X-Sovrium-Read-Since'

/** The longest header read: a table name, a record id and an instant fit well within it. */
const OPENED_READ_POSITION_MAX_LENGTH = 1024

/** An instant exactly as `Date.prototype.toISOString` writes it, which is what the page drew. */
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

/** How far past "now" a drawn position may sit: the clock skew between the page and this read. */
const CLOCK_SKEW_MS = 5 * 60 * 1000

/**
 * The latest instant a position the page drew can name: the later of the wall
 * clock and the server's clock (a development clock may be pinned either way
 * of it, and a position may have been stamped by either), plus the skew.
 */
const latestPositionNow = (): number => Math.max(Date.now(), serverNow().getTime()) + CLOCK_SKEW_MS

/**
 * The position a redraw of the conversation on `tableName`/`recordId` says its
 * page opened with, or `undefined` when the request carries none for it.
 *
 * The claim is the client's, so it is trusted for one thing only: where the
 * reader's own New marker goes among the rows she is already served. It never
 * moves her stored position, never reads another reader's, and never widens
 * which rows are drawn. It is still read strictly — for this very parent, an
 * instant as the page wrote it, never later than now — and anything else names
 * no position, so the stored one is used.
 */
const openedPositionOf = (c: Context, tableName: string, recordId: string): Date | undefined => {
  const claim = openedClaimOf(c.req.header(OPENED_READ_POSITION_HEADER))
  if (claim === undefined || claim['table'] !== tableName || claim['recordId'] !== recordId) {
    return undefined
  }
  const { since } = claim
  if (typeof since !== 'string' || !ISO_INSTANT.test(since)) return undefined
  const at = new Date(since)
  return Number.isNaN(at.getTime()) || at.getTime() > latestPositionNow() ? undefined : at
}

/** The header's claim as an object, or `undefined` when it is absent, oversized or does not read. */
const openedClaimOf = (raw: string | undefined): Readonly<Record<string, unknown>> | undefined => {
  if (raw === undefined || raw.length > OPENED_READ_POSITION_MAX_LENGTH) return undefined
  try {
    const claim: unknown = JSON.parse(decodeURIComponent(raw))
    return typeof claim === 'object' && claim !== null
      ? (claim as Readonly<Record<string, unknown>>)
      : undefined
  } catch {
    // A header that does not read names no position: the stored one is used.
    return undefined
  }
}

/**
 * The page reader's position on one parent record of a `readState`
 * relationship, read from the same store the mark-read route moves, on this
 * request's services — so a conversation places its New marker where her
 * unread count starts — or, on a redraw, where her page opened. A visitor
 * without an account, or a record she never read, has no position.
 */
export const readPositionReader =
  (c: Context): ReadReadPosition =>
  async (tableName, recordId, session) => {
    if (session === undefined || isGuestSession(session.userId)) return undefined
    const opened = openedPositionOf(c, tableName, recordId)
    if (opened !== undefined) return opened
    const answer = await runOnRequest(
      c,
      readPositionsProgram({ userId: session.userId, tableName, recordIds: [recordId] }).pipe(
        Effect.tapCause((cause) =>
          Effect.sync(() => logError('[pages] a read position could not be read', cause))
        )
      )
    )
    // effect-swallow: see the tap above. Without her position the conversation
    // draws no New marker; it never draws one in a place her rows do not justify.
    return answer._tag === 'Success' ? answer.success.get(recordId) : undefined
  }
