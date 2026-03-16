/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Effect, Layer } from 'effect'
import { AnalyticsRepository } from '../../ports/repositories/analytics-repository'
import { purgeOldAnalyticsData } from './purge-old-data'

function createMockRepo(onDelete: (appName: string, cutoff: Date) => number) {
  return Layer.succeed(AnalyticsRepository, {
    recordPageView: () => Effect.void,
    getTimeSeries: () => Effect.succeed([]),
    getSummary: () => Effect.succeed({ pageViews: 0, uniqueVisitors: 0, sessions: 0 }),
    getTopPages: () => Effect.succeed([]),
    getTopReferrers: () => Effect.succeed([]),
    getDevices: () => Effect.succeed({ deviceTypes: [], browsers: [], operatingSystems: [] }),
    getCampaigns: () => Effect.succeed([]),
    deleteOlderThan: (appName, cutoff) => Effect.succeed(onDelete(appName, cutoff)),
  })
}

describe('purgeOldAnalyticsData', () => {
  test('should delete records older than configured retention', async () => {
    let capturedCutoff: Date | undefined
    const mock = createMockRepo((_appName, cutoff) => {
      capturedCutoff = cutoff
      return 42
    })

    const result = await Effect.runPromise(
      purgeOldAnalyticsData('test-app', 30).pipe(Effect.provide(mock))
    )

    expect(result).toBe(42)
    expect(capturedCutoff).toBeDefined()
    // Cutoff should be approximately 30 days ago
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const diff = Math.abs(capturedCutoff!.getTime() - thirtyDaysAgo.getTime())
    expect(diff).toBeLessThan(1000) // Within 1 second
  })

  test('should default to 365 days retention when not specified', async () => {
    let capturedCutoff: Date | undefined
    const mock = createMockRepo((_appName, cutoff) => {
      capturedCutoff = cutoff
      return 0
    })

    await Effect.runPromise(purgeOldAnalyticsData('test-app').pipe(Effect.provide(mock)))

    const yearAgo = new Date()
    yearAgo.setDate(yearAgo.getDate() - 365)
    const diff = Math.abs(capturedCutoff!.getTime() - yearAgo.getTime())
    expect(diff).toBeLessThan(1000)
  })

  test('should pass appName to repository', async () => {
    let capturedAppName: string | undefined
    const mock = createMockRepo((appName) => {
      capturedAppName = appName
      return 0
    })

    await Effect.runPromise(purgeOldAnalyticsData('my-app', 90).pipe(Effect.provide(mock)))

    expect(capturedAppName).toBe('my-app')
  })
})
