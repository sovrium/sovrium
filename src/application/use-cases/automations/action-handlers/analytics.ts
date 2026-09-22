/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `analytics/track` action handler — records a custom event into the
 * built-in analytics system (`system.analytics_events`).
 *
 * The analytics events table is the same one that backs page-view
 * tracking; custom automation events are stored with
 * `event_type = 'track'` and a user-supplied `event_name`, alongside an
 * optional JSONB `properties` blob.
 *
 * Templates in `props.event` and the values of `props.properties` were
 * resolved by the run loop's `resolveTriggerInValue` pass (which walks
 * nested objects deeply via `mapStringsDeep`), so by the time this handler
 * runs the props are concrete.
 *
 * Automation-triggered events have no visitor: `visitorHash` /
 * `sessionHash` are notNull columns, so we supply a synthetic constant
 * (`'automation'`) rather than a privacy-derived hash. Aggregation queries
 * that count unique visitors over page-view data are unaffected because
 * they filter on `event_type = 'page_view'`.
 *
 * Wave: [internal ref].
 */

import { Effect } from 'effect'
import { AnalyticsRepository } from '@/application/ports/repositories/analytics/analytics-repository'
import { actionAttributes, recordProp, stringProp } from './shared'
import type { ActionHandler, ActionOutcome } from './shared'

/** Synthetic identifier used for system-generated (non-visitor) events. */
const AUTOMATION_VISITOR_HASH = 'automation'

/**
 * `analytics/track` — persist a custom event. The `event` prop is required
 * and must resolve to a non-empty string (the schema enforces a non-empty
 * template at decode time; this runtime guard covers the case where a
 * template variable resolves to an empty string).
 */
export const handleAnalyticsTrack: ActionHandler = (action, app, _automation) =>
  Effect.gen(function* () {
    const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
    const event = stringProp(props, 'event')
    if (!event) {
      return {
        status: 'failure',
        error: 'analytics.track requires a non-empty `event` name',
      } as const satisfies ActionOutcome
    }

    const properties = recordProp(props, 'properties')

    const repo = yield* AnalyticsRepository
    const result = yield* Effect.result(
      repo.recordEvent({
        appName: app.name,
        eventType: 'track',
        eventName: event,
        visitorHash: AUTOMATION_VISITOR_HASH,
        sessionHash: AUTOMATION_VISITOR_HASH,
        ...(properties !== undefined ? { properties } : {}),
      })
    )
    if (result._tag === 'Failure') {
      return {
        status: 'failure',
        error: `analytics.track failed: ${String(result.failure.cause)}`,
      } as const satisfies ActionOutcome
    }
    return {
      status: 'success',
      output: { event },
    } as const satisfies ActionOutcome
  }).pipe(
    Effect.withSpan('automations.handle-analytics-track', { attributes: actionAttributes(action) })
  )
