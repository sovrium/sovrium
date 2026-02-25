/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Effect, Layer } from 'effect'
import { AnalyticsRepository } from '../../ports/repositories/analytics-repository'
import { collectPageView } from './collect-page-view'
import type { CollectPageViewInput } from './collect-page-view'
import type { PageViewInput } from '../../ports/repositories/analytics-repository'

const baseInput: CollectPageViewInput = {
  appName: 'test-app',
  pagePath: '/about',
  ip: '192.168.1.1',
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
}

function createMockRepo(onRecord: (input: PageViewInput) => void) {
  return Layer.succeed(AnalyticsRepository, {
    recordPageView: (input) => {
      onRecord(input)
      return Effect.void
    },
    getTimeSeries: () => Effect.succeed([]),
    getSummary: () => Effect.succeed({ pageViews: 0, uniqueVisitors: 0, sessions: 0 }),
    getTopPages: () => Effect.succeed([]),
    getTopReferrers: () => Effect.succeed([]),
    getDevices: () => Effect.succeed({ deviceTypes: [], browsers: [], operatingSystems: [] }),
    getCampaigns: () => Effect.succeed([]),
    deleteOlderThan: () => Effect.succeed(0),
  })
}

describe('collectPageView', () => {
  test('should record a page view with visitor and session hashes', async () => {
    let recorded: PageViewInput | undefined
    const mock = createMockRepo((input) => {
      recorded = input
    })

    await Effect.runPromise(collectPageView(baseInput).pipe(Effect.provide(mock)))

    expect(recorded).toBeDefined()
    expect(recorded!.appName).toBe('test-app')
    expect(recorded!.pagePath).toBe('/about')
    expect(recorded!.visitorHash).toHaveLength(64)
    expect(recorded!.sessionHash).toHaveLength(64)
  })

  test('should parse device type from user agent', async () => {
    let recorded: PageViewInput | undefined
    const mock = createMockRepo((input) => {
      recorded = input
    })

    await Effect.runPromise(collectPageView(baseInput).pipe(Effect.provide(mock)))

    expect(recorded!.deviceType).toBe('desktop')
  })

  test('should parse browser name from user agent', async () => {
    let recorded: PageViewInput | undefined
    const mock = createMockRepo((input) => {
      recorded = input
    })

    await Effect.runPromise(collectPageView(baseInput).pipe(Effect.provide(mock)))

    expect(recorded!.browserName).toBe('Chrome')
  })

  test('should parse OS name from user agent', async () => {
    let recorded: PageViewInput | undefined
    const mock = createMockRepo((input) => {
      recorded = input
    })

    await Effect.runPromise(collectPageView(baseInput).pipe(Effect.provide(mock)))

    expect(recorded!.osName).toBe('Windows')
  })

  test('should extract language from Accept-Language header', async () => {
    let recorded: PageViewInput | undefined
    const mock = createMockRepo((input) => {
      recorded = input
    })

    await Effect.runPromise(
      collectPageView({ ...baseInput, acceptLanguage: 'en-US,en;q=0.9,fr;q=0.8' }).pipe(
        Effect.provide(mock)
      )
    )

    expect(recorded!.language).toBe('en-US')
  })

  test('should extract referrer domain from full URL', async () => {
    let recorded: PageViewInput | undefined
    const mock = createMockRepo((input) => {
      recorded = input
    })

    await Effect.runPromise(
      collectPageView({
        ...baseInput,
        referrerUrl: 'https://www.google.com/search?q=test',
      }).pipe(Effect.provide(mock))
    )

    expect(recorded!.referrerDomain).toBe('google.com')
    expect(recorded!.referrerUrl).toBe('https://www.google.com/search?q=test')
  })

  test('should pass UTM parameters through to repository', async () => {
    let recorded: PageViewInput | undefined
    const mock = createMockRepo((input) => {
      recorded = input
    })

    await Effect.runPromise(
      collectPageView({
        ...baseInput,
        utmSource: 'google',
        utmMedium: 'cpc',
        utmCampaign: 'summer-sale',
      }).pipe(Effect.provide(mock))
    )

    expect(recorded!.utmSource).toBe('google')
    expect(recorded!.utmMedium).toBe('cpc')
    expect(recorded!.utmCampaign).toBe('summer-sale')
  })

  test('should pass screen dimensions through to repository', async () => {
    let recorded: PageViewInput | undefined
    const mock = createMockRepo((input) => {
      recorded = input
    })

    await Effect.runPromise(
      collectPageView({
        ...baseInput,
        screenWidth: 1920,
        screenHeight: 1080,
      }).pipe(Effect.provide(mock))
    )

    expect(recorded!.screenWidth).toBe(1920)
    expect(recorded!.screenHeight).toBe(1080)
  })

  test('should handle undefined optional fields gracefully', async () => {
    let recorded: PageViewInput | undefined
    const mock = createMockRepo((input) => {
      recorded = input
    })

    await Effect.runPromise(collectPageView(baseInput).pipe(Effect.provide(mock)))

    expect(recorded!.language).toBeUndefined()
    expect(recorded!.referrerDomain).toBeUndefined()
    expect(recorded!.utmSource).toBeUndefined()
    expect(recorded!.screenWidth).toBeUndefined()
  })
})
