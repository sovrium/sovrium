/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Effect, Layer } from 'effect'
import { AnalyticsRepository } from '../../ports/repositories/analytics-repository'
import { queryOverview } from './query-overview'

const mockSummary = { pageViews: 100, uniqueVisitors: 50, sessions: 60 }
const mockTimeSeries = [
  { period: '2025-01-01T00:00:00Z', pageViews: 25, uniqueVisitors: 15, sessions: 18 },
  { period: '2025-01-02T00:00:00Z', pageViews: 75, uniqueVisitors: 35, sessions: 42 },
]

const MockRepo = Layer.succeed(AnalyticsRepository, {
  recordPageView: () => Effect.void,
  getTimeSeries: () => Effect.succeed(mockTimeSeries),
  getSummary: () => Effect.succeed(mockSummary),
  getTopPages: () => Effect.succeed([]),
  getTopReferrers: () => Effect.succeed([]),
  getDevices: () => Effect.succeed({ deviceTypes: [], browsers: [], operatingSystems: [] }),
  getCampaigns: () => Effect.succeed([]),
  deleteOlderThan: () => Effect.succeed(0),
})

describe('queryOverview', () => {
  test('should return summary and time series', async () => {
    const result = await Effect.runPromise(
      queryOverview({
        appName: 'test-app',
        from: new Date('2025-01-01'),
        to: new Date('2025-01-31'),
        granularity: 'day',
      }).pipe(Effect.provide(MockRepo))
    )

    expect(result.summary).toEqual(mockSummary)
    expect(result.timeSeries).toEqual(mockTimeSeries)
  })

  test('should return empty time series when no data', async () => {
    const EmptyRepo = Layer.succeed(AnalyticsRepository, {
      recordPageView: () => Effect.void,
      getTimeSeries: () => Effect.succeed([]),
      getSummary: () => Effect.succeed({ pageViews: 0, uniqueVisitors: 0, sessions: 0 }),
      getTopPages: () => Effect.succeed([]),
      getTopReferrers: () => Effect.succeed([]),
      getDevices: () => Effect.succeed({ deviceTypes: [], browsers: [], operatingSystems: [] }),
      getCampaigns: () => Effect.succeed([]),
      deleteOlderThan: () => Effect.succeed(0),
    })

    const result = await Effect.runPromise(
      queryOverview({
        appName: 'test-app',
        from: new Date('2025-01-01'),
        to: new Date('2025-01-31'),
        granularity: 'day',
      }).pipe(Effect.provide(EmptyRepo))
    )

    expect(result.summary.pageViews).toBe(0)
    expect(result.timeSeries).toHaveLength(0)
  })
})
