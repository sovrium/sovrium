/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect, describe } from 'bun:test'
import { Effect } from 'effect'
import {
  generateCreditComment,
  parseCreditMetrics,
  type CreditMetrics,
} from './credit-comment-generator'

describe('Credit Comment Generator', () => {
  describe('generateCreditComment', () => {
    test('generates comment for exceeded daily limit', async () => {
      const metrics: CreditMetrics = {
        creditsOk: false,
        limitType: 'daily',
        dailyRuns: 54,
        weeklyRuns: 158,
        actualDaily: 105.5,
        actualWeekly: 234.75,
        dailyLimit: 100.0,
        weeklyLimit: 500.0,
        dailyRemaining: -5.5,
        weeklyRemaining: 265.25,
        dailyPercent: 105,
        weeklyPercent: 47,
        hoursUntilDailyReset: 8,
        daysUntilWeeklyReset: 3,
      }

      const result = await Effect.runPromise(generateCreditComment(metrics))

      expect(result).toContain('## ⏸️ Daily Credit Limit Reached')
      expect(result).toContain('TDD automation paused until daily limit resets in **8 hours**')
      expect(result).toContain('| **Daily** | $105.50 | $100.00 | $-5.50 | 105% | 54 | 8h |')
      expect(result).toContain('### 📊 Current Usage (Actual Costs)')
    })

    test('generates comment for exceeded weekly limit', async () => {
      const metrics: CreditMetrics = {
        creditsOk: false,
        limitType: 'weekly',
        dailyRuns: 20,
        weeklyRuns: 200,
        actualDaily: 42.0,
        actualWeekly: 510.0,
        dailyLimit: 100.0,
        weeklyLimit: 500.0,
        dailyRemaining: 58.0,
        weeklyRemaining: -10.0,
        dailyPercent: 42,
        weeklyPercent: 102,
        hoursUntilDailyReset: 12,
        daysUntilWeeklyReset: 2,
      }

      const result = await Effect.runPromise(generateCreditComment(metrics))

      expect(result).toContain('## ⏸️ Weekly Credit Limit Reached')
      expect(result).toContain('TDD automation paused until weekly limit resets in **2 days**')
      expect(result).toContain('| **Weekly** | $510.00 | $500.00 | $-10.00 | 102% | 200 | 2d |')
    })

    test('generates warning comment when approaching daily limit (80%+)', async () => {
      const metrics: CreditMetrics = {
        creditsOk: true,
        limitType: 'none',
        dailyRuns: 40,
        weeklyRuns: 120,
        actualDaily: 85.0,
        actualWeekly: 250.0,
        dailyLimit: 100.0,
        weeklyLimit: 500.0,
        dailyRemaining: 15.0,
        weeklyRemaining: 250.0,
        dailyPercent: 85,
        weeklyPercent: 50,
        hoursUntilDailyReset: 6,
        daysUntilWeeklyReset: 4,
      }

      const result = await Effect.runPromise(generateCreditComment(metrics))

      expect(result).toContain('## ⚠️ Warning: Approaching Credit Limit')
      expect(result).toContain(
        'Daily usage is at **85%** of limit. Execution will continue but monitor usage closely.'
      )
      expect(result).toContain('| **Daily** | $85.00 | $100.00 | $15.00 | 85% | 40 | 6h |')
    })

    test('generates warning comment when approaching weekly limit (80%+)', async () => {
      const metrics: CreditMetrics = {
        creditsOk: true,
        limitType: 'none',
        dailyRuns: 25,
        weeklyRuns: 160,
        actualDaily: 45.0,
        actualWeekly: 420.0,
        dailyLimit: 100.0,
        weeklyLimit: 500.0,
        dailyRemaining: 55.0,
        weeklyRemaining: 80.0,
        dailyPercent: 45,
        weeklyPercent: 84,
        hoursUntilDailyReset: 18,
        daysUntilWeeklyReset: 1,
      }

      const result = await Effect.runPromise(generateCreditComment(metrics))

      expect(result).toContain('## ⚠️ Warning: Approaching Credit Limit')
      expect(result).toContain(
        'Weekly usage is at **84%** of limit. Execution will continue but monitor usage closely.'
      )
      expect(result).toContain('| **Weekly** | $420.00 | $500.00 | $80.00 | 84% | 160 | 1d |')
    })

    test('generates success comment when under limits', async () => {
      const metrics: CreditMetrics = {
        creditsOk: true,
        limitType: 'none',
        dailyRuns: 10,
        weeklyRuns: 50,
        actualDaily: 20.5,
        actualWeekly: 75.25,
        dailyLimit: 100.0,
        weeklyLimit: 500.0,
        dailyRemaining: 79.5,
        weeklyRemaining: 424.75,
        dailyPercent: 20,
        weeklyPercent: 15,
        hoursUntilDailyReset: 14,
        daysUntilWeeklyReset: 5,
      }

      const result = await Effect.runPromise(generateCreditComment(metrics))

      expect(result).toContain('## ✅ Credits Available')
      expect(result).toContain(
        'Claude Code execution proceeding. Current usage is below warning thresholds.'
      )
      expect(result).toContain('| **Daily** | $20.50 | $100.00 | $79.50 | 20% | 10 | 14h |')
      expect(result).toContain('| **Weekly** | $75.25 | $500.00 | $424.75 | 15% | 50 | 5d |')
    })
  })

  describe('parseCreditMetrics', () => {
    test('parses metrics from environment variables with kebab-case keys', async () => {
      const env = {
        'credits-ok': 'true',
        'limit-type': 'none',
        'daily-runs': '15',
        'weekly-runs': '60',
        'actual-daily': '30.50',
        'actual-weekly': '120.75',
        'daily-limit': '100.00',
        'weekly-limit': '500.00',
        'daily-remaining': '69.50',
        'weekly-remaining': '379.25',
        'daily-percent': '30',
        'weekly-percent': '24',
        'hours-until-daily-reset': '10',
        'days-until-weekly-reset': '6',
      }

      const result = await Effect.runPromise(parseCreditMetrics(env))

      expect(result.creditsOk).toBe(true)
      expect(result.limitType).toBe('none')
      expect(result.dailyRuns).toBe(15)
      expect(result.actualDaily).toBe(30.5)
      expect(result.dailyPercent).toBe(30)
    })

    test('parses metrics from environment variables with camelCase keys', async () => {
      const env = {
        creditsOk: 'true',
        limitType: 'daily',
        dailyRuns: '20',
        weeklyRuns: '80',
        actualDaily: '50.00',
        actualWeekly: '200.00',
        dailyLimit: '100.00',
        weeklyLimit: '500.00',
        dailyRemaining: '50.00',
        weeklyRemaining: '300.00',
        dailyPercent: '50',
        weeklyPercent: '40',
        hoursUntilDailyReset: '12',
        daysUntilWeeklyReset: '4',
      }

      const result = await Effect.runPromise(parseCreditMetrics(env))

      expect(result.creditsOk).toBe(true)
      expect(result.limitType).toBe('daily')
      expect(result.weeklyRuns).toBe(80)
      expect(result.actualWeekly).toBe(200.0)
    })

    test('uses default values for missing keys', async () => {
      const env = {}

      const result = await Effect.runPromise(parseCreditMetrics(env))

      expect(result.creditsOk).toBe(false)
      expect(result.limitType).toBe('none')
      expect(result.dailyRuns).toBe(0)
      expect(result.dailyLimit).toBe(100)
      expect(result.weeklyLimit).toBe(500)
      expect(result.hoursUntilDailyReset).toBe(24)
      expect(result.daysUntilWeeklyReset).toBe(7)
    })
  })
})
