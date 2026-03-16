/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Effect, Layer } from 'effect'
import { AnalyticsRepository } from '../../ports/repositories/analytics-repository'
import { queryReferrers } from './query-referrers'

const mockReferrers = [
  { domain: 'google.com', pageViews: 50, uniqueVisitors: 30 },
  { domain: null, pageViews: 20, uniqueVisitors: 15 },
]

const MockRepo = Layer.succeed(AnalyticsRepository, {
  recordPageView: () => Effect.void,
  getTimeSeries: () => Effect.succeed([]),
  getSummary: () => Effect.succeed({ pageViews: 0, uniqueVisitors: 0, sessions: 0 }),
  getTopPages: () => Effect.succeed([]),
  getTopReferrers: () => Effect.succeed(mockReferrers),
  getDevices: () => Effect.succeed({ deviceTypes: [], browsers: [], operatingSystems: [] }),
  getCampaigns: () => Effect.succeed([]),
  deleteOlderThan: () => Effect.succeed(0),
})

describe('queryReferrers', () => {
  test('should return referrers with total count', async () => {
    const result = await Effect.runPromise(
      queryReferrers({
        appName: 'test-app',
        from: new Date('2025-01-01'),
        to: new Date('2025-01-31'),
      }).pipe(Effect.provide(MockRepo))
    )

    expect(result.referrers).toEqual(mockReferrers)
    expect(result.total).toBe(2)
  })
})
