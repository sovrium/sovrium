/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The admin run-history request: decoding its parameters and its opaque cursor.
 *
 * Pure, and shared by every surface that reads the run history — the admin
 * route and the MCP admin read tool — so the two cannot disagree on which
 * filters a request carries or what a cursor means. The read itself is
 * `BuildAdminRunsList` (`automations-overview.ts`).
 */

import { zonedEndOfIsoDate, zonedStartOfIsoDate } from '@/domain/kernel/time/zoned-calendar'
import { automationsRunsListQuerySchema } from '@/domain/models/api/admin/automations'
import { decodeSafe } from '@/domain/models/api/combinators/decode'
import { triggerNameFilterOf } from '@/domain/models/app/automations/trigger-entries-service'
import type { AdminRunsListInput } from './automations-overview'
import type { AdminRunsListFilters } from '@/application/ports/repositories/automations/admin-automations-repository'
import type { App } from '@/domain/models/app'

// ─── Runs cursor (opaque base64 of `{ startedAt, id }`) ─────────────────────────

/** Encode a runs-list cursor — opaque base64 of `{ startedAt, id }`. */
export function encodeRunsCursor(startedAt: string, id: string): string {
  return Buffer.from(JSON.stringify({ startedAt, id }), 'utf8').toString('base64')
}

/**
 * Decode a runs-list cursor. Returns `null` (the use case maps that to "ignore
 * the cursor") when the payload is malformed.
 */
export function decodeRunsCursor(
  cursor: string
): { readonly startedAt: string; readonly id: string } | null {
  try {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8')) as {
      readonly startedAt?: unknown
      readonly id?: unknown
    }
    if (typeof decoded.startedAt !== 'string' || typeof decoded.id !== 'string') return null
    return { startedAt: decoded.startedAt, id: decoded.id }
  } catch {
    return null
  }
}

// ─── Request decoding ─────────────────────────────────────────────────────────

/** A bound written as a calendar day (`YYYY-MM-DD`) rather than a date-time. */
const CALENDAR_DAY = /^\d{4}-\d{2}-\d{2}$/

/**
 * One bound of the window as the instant the read compares against. A
 * date-time is kept as written; a calendar day is read on the operator's clock:
 * a `from` day starts at its midnight, and a `to` day runs through to the next
 * midnight, so the same day as `from` and `to` is the whole of that day.
 */
const windowBound = (
  bound: string | undefined,
  edge: 'from' | 'to',
  timeZone: string
): string | undefined => {
  if (bound === undefined || !CALENDAR_DAY.test(bound)) return bound
  const instant =
    edge === 'from' ? zonedStartOfIsoDate(bound, timeZone) : zonedEndOfIsoDate(bound, timeZone)
  return instant.toISOString()
}

/**
 * Decoding a runs-list request into {@link AdminRunsListInput}.
 *
 * `InvalidQuery` is a parameter the query schema refuses; `InvertedWindow` is a
 * `from` later than `to`, refused before any read rather than answered with an
 * empty page.
 */
export type AdminRunsListQueryDecode =
  | { readonly _tag: 'Ok'; readonly input: AdminRunsListInput }
  | { readonly _tag: 'InvalidQuery' }
  | { readonly _tag: 'InvertedWindow' }

/**
 * Whether the resolved window ends before it starts. A day `to` is resolved to
 * the next midnight, so a window ending exactly where it starts names a day
 * before the `from` (a `to` day earlier than the `from` day); a date-time `to`, whose
 * own instant is excluded, is inverted only when it is earlier than `from`.
 */
const endsBeforeItStarts = (
  from: string | undefined,
  to: string | undefined,
  writtenTo: string | undefined
): boolean => {
  if (from === undefined || to === undefined) return false
  const gap = new Date(to).getTime() - new Date(from).getTime()
  return CALENDAR_DAY.test(writtenTo ?? '') ? gap <= 0 : gap < 0
}

/**
 * Decode raw runs-list parameters — the HTTP query string or an MCP tool's
 * arguments — into the use case's input.
 *
 * ONE mapping for every surface that reads the run history: the admin route and
 * the MCP admin read tool both call it, so a filter the one honours cannot be
 * silently dropped by the other. Every knob is forwarded explicitly — including
 * `q`, whose omission at this seam once made the endpoint answer a search it was
 * never asked to run.
 *
 * A `from` or `to` written as a calendar day is resolved here, in `timeZone`
 * (the operator's), before the window is checked: a day `to` equal to a day
 * `from` is one whole day, never an inverted window.
 */
export function decodeAdminRunsListQuery(raw: unknown, timeZone: string): AdminRunsListQueryDecode {
  const parsed = decodeSafe(automationsRunsListQuerySchema)(raw)
  if (!parsed.success) return { _tag: 'InvalidQuery' }
  const query = parsed.data
  const from = windowBound(query.from, 'from', timeZone)
  const to = windowBound(query.to, 'to', timeZone)
  if (endsBeforeItStarts(from, to, query.to)) return { _tag: 'InvertedWindow' }
  return {
    _tag: 'Ok',
    input: {
      status: query.status,
      automationName: query.automationName,
      triggerName: query.triggerName,
      automationId: query.automationId,
      from,
      to,
      onDemand: query.onDemand === undefined ? undefined : query.onDemand === 'true',
      q: query.q,
      cursor: query.cursor,
      page: query.page,
      limit: query.limit,
    },
  }
}

// ─── Read filters ─────────────────────────────────────────────────────────────

/**
 * The repository read a runs-list request asks for. The cursor anchors on
 * `createdAt` (non-null by schema): the encoded cursor carries the previous
 * page's last `createdAt` under the historical `startedAt` key, decoded here
 * into the `cursorBefore` predicate; a malformed cursor is ignored. A numbered
 * `page` is read by offset, and only when no cursor names a position.
 */
export function runsListFilters(app: App, input: AdminRunsListInput): AdminRunsListFilters {
  const decoded = input.cursor ? decodeRunsCursor(input.cursor) : null
  const cursorBefore = decoded === null ? undefined : new Date(decoded.startedAt)
  const paged = cursorBefore === undefined && input.page !== undefined
  return {
    status: input.status,
    automationName: input.automationName,
    triggerName:
      input.triggerName === undefined
        ? undefined
        : triggerNameFilterOf(app.automations, input.automationName, input.triggerName),
    automationId: input.automationId,
    from: input.from === undefined ? undefined : new Date(input.from),
    to: input.to === undefined ? undefined : new Date(input.to),
    onDemand: input.onDemand,
    q: input.q,
    cursorBefore,
    limit: input.limit,
    offset: paged ? ((input.page ?? 1) - 1) * input.limit : undefined,
  }
}
