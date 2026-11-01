/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `GET /api/analytics/events` — the query it takes and the read behind it.
 *
 * Kept beside `routes.ts` rather than in it so that file stays inside its line
 * budget; the handler itself stays there, behind the same admin gate as every
 * sibling report.
 *
 * Under the `audience-only` profile the endpoint lists custom events (`track`)
 * alone, without their visitor or session identifiers: an event read one by one
 * is not an aggregate, and only custom events are recorded on purpose by the
 * operator's own automations.
 */

import { Effect } from 'effect'
import { AnalyticsRepository } from '@/application/ports/repositories/analytics/analytics-repository'
import { toEventsResponse } from '@/presentation/api/analytics/events-response'
import type { AnalyticsProfile } from '@/domain/models/app/analytics/analytics-profile-service'
import type { Context } from 'hono'

/** The one event type `audience-only` lists. */
const CUSTOM_EVENT_TYPE = 'track'

/**
 * Validate the limit/offset pair from /api/analytics/events.
 *
 * Returns either parsed numeric values or a tagged error indicating
 * which parameter failed validation. Defaults are applied when
 * query params are absent.
 */
function validatePagination(
  limitStr: string | undefined,
  offsetStr: string | undefined
):
  | { readonly _tag: 'ok'; readonly limit: number; readonly offset: number }
  | { readonly _tag: 'invalid'; readonly param: 'limit' | 'offset' } {
  const limit = limitStr ? Number.parseInt(limitStr, 10) : 50
  const offset = offsetStr ? Number.parseInt(offsetStr, 10) : 0

  if (Number.isNaN(limit) || limit < 1 || limit > 1000) {
    return { _tag: 'invalid', param: 'limit' }
  }
  if (Number.isNaN(offset) || offset < 0) {
    return { _tag: 'invalid', param: 'offset' }
  }
  return { _tag: 'ok', limit, offset }
}

/** The parsed query of a valid events read. */
interface EventsQuery {
  readonly _tag: 'ok'
  readonly limit: number
  readonly offset: number
  readonly eventType: string | undefined
  readonly eventName: string | undefined
  readonly from: Date | undefined
  readonly to: Date | undefined
}

/**
 * Parse and validate /api/analytics/events query parameters.
 *
 * Returns either the parsed parameters or a tagged error indicating
 * which parameter failed validation.
 */
export function parseEventsQuery(
  c: Context
): EventsQuery | { readonly _tag: 'invalid'; readonly param: 'limit' | 'offset' } {
  const pagination = validatePagination(c.req.query('limit'), c.req.query('offset'))
  if (pagination._tag === 'invalid') return pagination

  const fromStr = c.req.query('from')
  const toStr = c.req.query('to')

  return {
    _tag: 'ok',
    limit: pagination.limit,
    offset: pagination.offset,
    eventType: c.req.query('event_type') || undefined,
    eventName: c.req.query('event_name') || undefined,
    from: fromStr ? new Date(fromStr) : undefined,
    to: toStr ? new Date(toStr) : undefined,
  }
}

/**
 * Whether `profile` refuses the event type the request names: under
 * `audience-only`, any type other than custom events is answered as a resource
 * that is not there, whatever else the query says.
 */
export const refusesEventType = (c: Context, profile: AnalyticsProfile): boolean => {
  const eventType = c.req.query('event_type') || undefined
  return profile === 'audience-only' && eventType !== undefined && eventType !== CUSTOM_EVENT_TYPE
}

/**
 * The events read, as an Effect declaring `AnalyticsRepository` in its `R`.
 *
 * The requirement is DECLARED here and discharged at the call site, which is
 * the shape E1 asks for. A page the response schema refuses fails like a failed
 * read. Under `audience-only` the read is pinned to custom events, so the
 * page's `total` counts them alone, and their identifiers are withheld.
 */
export const readEvents = (appName: string, params: EventsQuery, profile: AnalyticsProfile) =>
  Effect.gen(function* () {
    const repo = yield* AnalyticsRepository
    const audienceOnly = profile === 'audience-only'
    const page = yield* repo.listEvents({
      appName,
      eventType: audienceOnly ? CUSTOM_EVENT_TYPE : params.eventType,
      eventName: params.eventName,
      limit: params.limit,
      offset: params.offset,
      from: params.from,
      to: params.to,
    })
    return yield* toEventsResponse(page, { withholdIdentifiers: audienceOnly })
  })
