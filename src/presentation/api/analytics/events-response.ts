/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  listEventsResponseSchema,
  type ListEventsResponse,
} from '@/domain/models/api/analytics/analytics-events'
import { decodeSafe } from '@/domain/models/api/combinators/decode'
import type { AnalyticsEventRow } from '@/application/ports/repositories/analytics/analytics-repository'

/**
 * Shape one page of events for `GET /api/analytics/events` through
 * `listEventsResponseSchema`, so the documented contract and the wire cannot
 * drift apart. The keys are snake_case, as the endpoint has always answered.
 * A page the schema refuses fails, and the route answers it as a failed read.
 */
export const toEventsResponse = (page: {
  readonly events: readonly AnalyticsEventRow[]
  readonly pagination: ListEventsResponse['pagination']
}): Effect.Effect<ListEventsResponse, unknown> => {
  const shaped = decodeSafe(listEventsResponseSchema)({
    pagination: page.pagination,
    events: page.events.map((event) => ({
      id: event.id,
      app_name: event.appName,
      event_type: event.eventType,
      event_name: event.eventName,
      org_id: event.orgId,
      visitor_hash: event.visitorHash,
      session_hash: event.sessionHash,
      timestamp: new Date(event.timestamp).toISOString(),
      properties: event.properties,
    })),
  })
  return shaped.success ? Effect.succeed(shaped.data) : Effect.fail(shaped.error)
}
