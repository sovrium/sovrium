/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Effect, Layer } from 'effect'
import { AnalyticsRepository } from '../../ports/repositories/analytics-repository'
import { queryPages } from './query-pages'

const mockPages = [
  { path: '/about', pageViews: 50, uniqueVisitors: 30 },
  { path: '/blog', pageViews: 30, uniqueVisitors: 20 },
]

const MockRepo = Layer.succeed(AnalyticsRepository, {
  recordPageView: () => Effect.void,
  getTimeSeries: () => Effect.succeed([]),
  getSummary: () => Effect.succeed({ pageViews: 0, uniqueVisitors: 0, sessions: 0 }),
  getTopPages: () => Effect.succeed(mockPages),
  getTopReferrers: () => Effect.succeed([]),
  getDevices: () => Effect.succeed({ deviceTypes: [], browsers: [], operatingSystems: [] }),
  getCampaigns: () => Effect.succeed([]),
  deleteOlderThan: () => Effect.succeed(0),
})

describe('queryPages', () => {
  test('should return pages with total count', async () => {
    const result = await Effect.runPromise(
      queryPages({
        appName: 'test-app',
        from: new Date('2025-01-01'),
        to: new Date('2025-01-31'),
      }).pipe(Effect.provide(MockRepo))
    )

    expect(result.pages).toEqual(mockPages)
    expect(result.total).toBe(2)
  })
})
