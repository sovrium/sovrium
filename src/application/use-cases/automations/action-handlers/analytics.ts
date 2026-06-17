/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect } from 'effect'
import { AnalyticsRepository } from '@/application/ports/repositories/analytics/analytics-repository'
import { recordProp, stringProp } from './shared'
import type { ActionHandler, ActionOutcome } from './shared'

const AUTOMATION_VISITOR_HASH = 'automation'

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
    const result = yield* Effect.either(
      repo.recordEvent({
        appName: app.name,
        eventType: 'track',
        eventName: event,
        visitorHash: AUTOMATION_VISITOR_HASH,
        sessionHash: AUTOMATION_VISITOR_HASH,
        ...(properties !== undefined ? { properties } : {}),
      })
    )
    if (result._tag === 'Left') {
      return {
        status: 'failure',
        error: `analytics.track failed: ${String(result.left.cause)}`,
      } as const satisfies ActionOutcome
    }
    return {
      status: 'success',
      output: { event },
    } as const satisfies ActionOutcome
  })
