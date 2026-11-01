/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { decodeSafe } from '@/domain/kernel/config-parsing/decode'
import {
  listEventsResponseSchema,
  type ListEventsResponse,
} from '@/domain/models/api/analytics/analytics-events'
import type { AnalyticsEventRow } from '@/application/ports/repositories/analytics/analytics-repository'

/**
 * Shape one page of events for `GET /api/analytics/events` through
 * `listEventsResponseSchema`, so the documented contract and the wire cannot
 * drift apart. The keys are snake_case, as the endpoint has always answered.
 * A page the schema refuses fails, and the route answers it as a failed read.
 *
 * With `withholdIdentifiers`, every event answers its visitor and session
 * identifiers as `null`, the keys still present, so no two listed events can be
 * tied to the same visitor.
 */
export const toEventsResponse = (
  page: {
    readonly events: readonly AnalyticsEventRow[]
    readonly pagination: ListEventsResponse['pagination']
  },
  options: { readonly withholdIdentifiers: boolean }
): Effect.Effect<ListEventsResponse, unknown> => {
  const shaped = decodeSafe(listEventsResponseSchema)({
    pagination: page.pagination,
    events: page.events.map((event) => ({
      id: event.id,
      app_name: event.appName,
      event_type: event.eventType,
      event_name: event.eventName,
      org_id: event.orgId,
      visitor_hash: options.withholdIdentifiers ? null : event.visitorHash,
      session_hash: options.withholdIdentifiers ? null : event.sessionHash,
      timestamp: new Date(event.timestamp).toISOString(),
      properties: event.properties,
    })),
  })
  return shaped.success ? Effect.succeed(shaped.data) : Effect.fail(shaped.error)
}
