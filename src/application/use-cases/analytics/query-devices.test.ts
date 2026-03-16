/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Effect, Layer } from 'effect'
import { AnalyticsRepository } from '../../ports/repositories/analytics-repository'
import { queryDevices } from './query-devices'

const mockBreakdown = {
  deviceTypes: [{ name: 'desktop', count: 80, percentage: 80 }],
  browsers: [{ name: 'Chrome', count: 60, percentage: 60 }],
  operatingSystems: [{ name: 'Windows', count: 50, percentage: 50 }],
}

const MockRepo = Layer.succeed(AnalyticsRepository, {
  recordPageView: () => Effect.void,
  getTimeSeries: () => Effect.succeed([]),
  getSummary: () => Effect.succeed({ pageViews: 0, uniqueVisitors: 0, sessions: 0 }),
  getTopPages: () => Effect.succeed([]),
  getTopReferrers: () => Effect.succeed([]),
  getDevices: () => Effect.succeed(mockBreakdown),
  getCampaigns: () => Effect.succeed([]),
  deleteOlderThan: () => Effect.succeed(0),
})

describe('queryDevices', () => {
  test('should return device breakdown', async () => {
    const result = await Effect.runPromise(
      queryDevices({
        appName: 'test-app',
        from: new Date('2025-01-01'),
        to: new Date('2025-01-31'),
      }).pipe(Effect.provide(MockRepo))
    )

    expect(result.deviceTypes).toEqual(mockBreakdown.deviceTypes)
    expect(result.browsers).toEqual(mockBreakdown.browsers)
    expect(result.operatingSystems).toEqual(mockBreakdown.operatingSystems)
  })
})
