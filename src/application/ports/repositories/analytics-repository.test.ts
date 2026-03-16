/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { AnalyticsDatabaseError, AnalyticsRepository } from './analytics-repository'
import type {
  PageViewInput,
  AnalyticsQueryParams,
  TimeSeriesPoint,
  AnalyticsSummary,
  TopPage,
  TopReferrer,
  DeviceBreakdown,
  BreakdownEntry,
  CampaignEntry,
} from './analytics-repository'

describe('AnalyticsRepository port', () => {
  test('AnalyticsDatabaseError should be a tagged error', () => {
    const error = new AnalyticsDatabaseError({ cause: 'test error' })
    expect(error._tag).toBe('AnalyticsDatabaseError')
    expect(error.cause).toBe('test error')
  })

  test('AnalyticsRepository tag should have correct identifier', () => {
    expect(AnalyticsRepository.key).toBe('AnalyticsRepository')
  })

  test('should export all required types', () => {
    // Type-level verification — these compile successfully if types are correctly exported
    const _pageView: PageViewInput = {
      appName: 'test',
      pagePath: '/',
      visitorHash: 'abc',
      sessionHash: 'def',
      isEntrance: false,
    }
    const _params: AnalyticsQueryParams = {
      appName: 'test',
      from: new Date(),
      to: new Date(),
      granularity: 'day',
    }
    const _ts: TimeSeriesPoint = {
      period: '2025-01-01',
      pageViews: 0,
      uniqueVisitors: 0,
      sessions: 0,
    }
    const _summary: AnalyticsSummary = { pageViews: 0, uniqueVisitors: 0, sessions: 0 }
    const _page: TopPage = { path: '/', pageViews: 0, uniqueVisitors: 0 }
    const _referrer: TopReferrer = { domain: null, pageViews: 0, uniqueVisitors: 0 }
    const _entry: BreakdownEntry = { name: 'desktop', count: 0, percentage: 0 }
    const _breakdown: DeviceBreakdown = { deviceTypes: [], browsers: [], operatingSystems: [] }
    const _campaign: CampaignEntry = {
      source: null,
      medium: null,
      campaign: null,
      pageViews: 0,
      uniqueVisitors: 0,
    }

    expect(_pageView.appName).toBe('test')
    expect(_params.granularity).toBe('day')
    expect(_ts.period).toBe('2025-01-01')
    expect(_summary.pageViews).toBe(0)
    expect(_page.path).toBe('/')
    expect(_referrer.domain).toBeNull()
    expect(_entry.name).toBe('desktop')
    expect(_breakdown.deviceTypes).toHaveLength(0)
    expect(_campaign.source).toBeNull()
  })
})
