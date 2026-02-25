/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import {
  analyticsCollectSchema,
  analyticsQuerySchema,
  analyticsOverviewResponseSchema,
  analyticsTopPagesResponseSchema,
  analyticsTopReferrersResponseSchema,
  analyticsDevicesResponseSchema,
  analyticsCampaignsResponseSchema,
} from './analytics'

describe('analyticsCollectSchema', () => {
  test('accepts minimal payload (path only)', () => {
    const result = analyticsCollectSchema.parse({ p: '/about' })
    expect(result.p).toBe('/about')
  })

  test('accepts full payload with all fields', () => {
    const result = analyticsCollectSchema.parse({
      p: '/blog/post-1',
      t: 'My Blog Post',
      r: 'https://google.com/search?q=test',
      sw: 1920,
      sh: 1080,
      us: 'google',
      um: 'cpc',
      uc: 'summer-sale',
      ux: 'banner-ad',
      ut: 'analytics',
    })
    expect(result.p).toBe('/blog/post-1')
    expect(result.t).toBe('My Blog Post')
    expect(result.sw).toBe(1920)
    expect(result.us).toBe('google')
  })

  test('rejects missing page path', () => {
    expect(() => analyticsCollectSchema.parse({})).toThrow()
  })

  test('rejects empty page path', () => {
    expect(() => analyticsCollectSchema.parse({ p: '' })).toThrow()
  })

  test('rejects non-integer screen dimensions', () => {
    expect(() => analyticsCollectSchema.parse({ p: '/', sw: 19.5 })).toThrow()
  })

  test('rejects negative screen dimensions', () => {
    expect(() => analyticsCollectSchema.parse({ p: '/', sw: -100 })).toThrow()
  })
})

describe('analyticsQuerySchema', () => {
  test('accepts valid query with defaults', () => {
    const result = analyticsQuerySchema.parse({
      from: '2025-01-01T00:00:00Z',
      to: '2025-01-31T23:59:59Z',
    })
    expect(result.granularity).toBe('day')
  })

  test('accepts custom granularity', () => {
    const result = analyticsQuerySchema.parse({
      from: '2025-01-01T00:00:00Z',
      to: '2025-01-31T23:59:59Z',
      granularity: 'hour',
    })
    expect(result.granularity).toBe('hour')
  })

  test('accepts all granularity values', () => {
    for (const g of ['hour', 'day', 'week', 'month'] as const) {
      const result = analyticsQuerySchema.parse({
        from: '2025-01-01T00:00:00Z',
        to: '2025-01-31T23:59:59Z',
        granularity: g,
      })
      expect(result.granularity).toBe(g)
    }
  })

  test('rejects invalid granularity', () => {
    expect(() =>
      analyticsQuerySchema.parse({
        from: '2025-01-01T00:00:00Z',
        to: '2025-01-31T23:59:59Z',
        granularity: 'year',
      })
    ).toThrow()
  })

  test('rejects missing from/to fields', () => {
    expect(() => analyticsQuerySchema.parse({})).toThrow()
    expect(() => analyticsQuerySchema.parse({ from: '2025-01-01T00:00:00Z' })).toThrow()
  })
})

describe('analyticsOverviewResponseSchema', () => {
  test('validates complete overview response', () => {
    const result = analyticsOverviewResponseSchema.parse({
      summary: { pageViews: 100, uniqueVisitors: 50, sessions: 60 },
      timeSeries: [
        { period: '2025-01-01T00:00:00Z', pageViews: 25, uniqueVisitors: 15, sessions: 18 },
      ],
    })
    expect(result.summary.pageViews).toBe(100)
    expect(result.timeSeries).toHaveLength(1)
  })

  test('accepts empty time series', () => {
    const result = analyticsOverviewResponseSchema.parse({
      summary: { pageViews: 0, uniqueVisitors: 0, sessions: 0 },
      timeSeries: [],
    })
    expect(result.timeSeries).toHaveLength(0)
  })

  test('rejects missing summary fields', () => {
    expect(() =>
      analyticsOverviewResponseSchema.parse({
        summary: { pageViews: 100 },
        timeSeries: [],
      })
    ).toThrow()
  })
})

describe('analyticsTopPagesResponseSchema', () => {
  test('validates top pages response', () => {
    const result = analyticsTopPagesResponseSchema.parse({
      pages: [{ path: '/about', pageViews: 50, uniqueVisitors: 30 }],
      total: 1,
    })
    expect(result.pages[0]!.path).toBe('/about')
    expect(result.total).toBe(1)
  })

  test('accepts empty pages array', () => {
    const result = analyticsTopPagesResponseSchema.parse({ pages: [], total: 0 })
    expect(result.pages).toHaveLength(0)
  })
})

describe('analyticsTopReferrersResponseSchema', () => {
  test('validates referrer with domain', () => {
    const result = analyticsTopReferrersResponseSchema.parse({
      referrers: [{ domain: 'google.com', pageViews: 50, uniqueVisitors: 30 }],
      total: 1,
    })
    expect(result.referrers[0]!.domain).toBe('google.com')
  })

  test('accepts null domain for direct traffic', () => {
    const result = analyticsTopReferrersResponseSchema.parse({
      referrers: [{ domain: null, pageViews: 100, uniqueVisitors: 80 }],
      total: 1,
    })
    expect(result.referrers[0]!.domain).toBeNull()
  })
})

describe('analyticsDevicesResponseSchema', () => {
  test('validates device breakdown response', () => {
    const result = analyticsDevicesResponseSchema.parse({
      deviceTypes: [{ name: 'desktop', count: 80, percentage: 80 }],
      browsers: [{ name: 'Chrome', count: 60, percentage: 60 }],
      operatingSystems: [{ name: 'Windows', count: 50, percentage: 50 }],
    })
    expect(result.deviceTypes[0]!.name).toBe('desktop')
    expect(result.browsers[0]!.percentage).toBe(60)
  })

  test('accepts empty breakdown arrays', () => {
    const result = analyticsDevicesResponseSchema.parse({
      deviceTypes: [],
      browsers: [],
      operatingSystems: [],
    })
    expect(result.deviceTypes).toHaveLength(0)
  })
})

describe('analyticsCampaignsResponseSchema', () => {
  test('validates campaign response', () => {
    const result = analyticsCampaignsResponseSchema.parse({
      campaigns: [
        { source: 'google', medium: 'cpc', campaign: 'summer', pageViews: 50, uniqueVisitors: 30 },
      ],
      total: 1,
    })
    expect(result.campaigns[0]!.source).toBe('google')
  })

  test('accepts nullable campaign fields', () => {
    const result = analyticsCampaignsResponseSchema.parse({
      campaigns: [{ source: null, medium: null, campaign: null, pageViews: 10, uniqueVisitors: 5 }],
      total: 1,
    })
    expect(result.campaigns[0]!.source).toBeNull()
  })
})
