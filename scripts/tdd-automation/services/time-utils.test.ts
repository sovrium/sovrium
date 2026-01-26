/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, it } from 'bun:test'
import { Effect } from 'effect'
import {
  TimeUtils,
  TimeUtilsLive,
  TimeParseError,
  parseISODate,
  calculateAgeMinutes,
  formatMinutesToDuration,
} from './time-utils'

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Helper to run effects with the TimeUtils service
 */
const runWithService = <A, E>(effect: Effect.Effect<A, E, TimeUtils>) =>
  Effect.runPromise(Effect.provide(effect, TimeUtilsLive))

// =============================================================================
// Pure Function Tests
// =============================================================================

describe('parseISODate', () => {
  it('should parse valid ISO date strings', () => {
    const result = parseISODate('2025-01-25T10:30:00Z')
    expect(result).not.toBeNull()
    expect(result?.toISOString()).toBe('2025-01-25T10:30:00.000Z')
  })

  it('should parse ISO dates with timezone offset', () => {
    const result = parseISODate('2025-01-25T10:30:00+00:00')
    expect(result).not.toBeNull()
  })

  it('should parse ISO dates without timezone', () => {
    const result = parseISODate('2025-01-25T10:30:00')
    expect(result).not.toBeNull()
  })

  it('should return null for invalid date strings', () => {
    expect(parseISODate('not-a-date')).toBeNull()
    expect(parseISODate('')).toBeNull()
    expect(parseISODate('invalid')).toBeNull()
  })

  it('should return null for incomplete or non-ISO date strings', () => {
    expect(parseISODate('2025-01')).toBeNull() // Incomplete (no day)
    expect(parseISODate('2025/01/25')).toBeNull() // Wrong separator
    expect(parseISODate('Jan 25, 2025')).toBeNull() // Not ISO format
    expect(parseISODate('25-01-2025')).toBeNull() // Wrong order
  })
})

describe('calculateAgeMinutes', () => {
  it('should calculate age correctly for past dates', () => {
    const now = new Date('2025-01-25T12:00:00Z')
    const past = new Date('2025-01-25T11:30:00Z')
    const age = calculateAgeMinutes(past, now)
    expect(age).toBe(30)
  })

  it('should return 0 for future dates', () => {
    const now = new Date('2025-01-25T12:00:00Z')
    const future = new Date('2025-01-25T12:30:00Z')
    const age = calculateAgeMinutes(future, now)
    expect(age).toBe(0) // Clamped to 0
  })

  it('should handle same date (0 age)', () => {
    const now = new Date('2025-01-25T12:00:00Z')
    const age = calculateAgeMinutes(now, now)
    expect(age).toBe(0)
  })

  it('should calculate hours correctly', () => {
    const now = new Date('2025-01-25T14:00:00Z')
    const past = new Date('2025-01-25T12:00:00Z')
    const age = calculateAgeMinutes(past, now)
    expect(age).toBe(120) // 2 hours = 120 minutes
  })

  it('should calculate days correctly', () => {
    const now = new Date('2025-01-26T12:00:00Z')
    const past = new Date('2025-01-25T12:00:00Z')
    const age = calculateAgeMinutes(past, now)
    expect(age).toBe(1440) // 1 day = 1440 minutes
  })
})

describe('formatMinutesToDuration', () => {
  it('should format minutes under an hour', () => {
    expect(formatMinutesToDuration(5)).toBe('5m')
    expect(formatMinutesToDuration(30)).toBe('30m')
    expect(formatMinutesToDuration(59)).toBe('59m')
  })

  it('should format exactly one hour', () => {
    expect(formatMinutesToDuration(60)).toBe('1h')
  })

  it('should format hours and minutes', () => {
    expect(formatMinutesToDuration(90)).toBe('1h 30m')
    expect(formatMinutesToDuration(150)).toBe('2h 30m')
  })

  it('should format hours without trailing minutes when even', () => {
    expect(formatMinutesToDuration(120)).toBe('2h')
    expect(formatMinutesToDuration(180)).toBe('3h')
  })

  it('should format days', () => {
    expect(formatMinutesToDuration(1440)).toBe('1d')
    expect(formatMinutesToDuration(1500)).toBe('1d 1h') // 1d + 60min = 1d 1h
  })

  it('should format days and hours', () => {
    expect(formatMinutesToDuration(1560)).toBe('1d 2h') // 1d + 120min
    expect(formatMinutesToDuration(2880)).toBe('2d') // 2 days
  })

  it('should handle zero', () => {
    expect(formatMinutesToDuration(0)).toBe('0m')
  })

  it('should handle negative values (absolute)', () => {
    expect(formatMinutesToDuration(-30)).toBe('30m')
  })

  it('should round fractional minutes', () => {
    expect(formatMinutesToDuration(5.7)).toBe('6m')
    expect(formatMinutesToDuration(5.3)).toBe('5m')
  })
})

// =============================================================================
// Effect Service Tests
// =============================================================================

describe('TimeUtils Service', () => {
  describe('getAgeMinutes', () => {
    it('should calculate age for valid ISO date', async () => {
      // Create a date 30 minutes ago
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()

      const age = await runWithService(
        Effect.gen(function* () {
          const utils = yield* TimeUtils
          return yield* utils.getAgeMinutes(thirtyMinutesAgo)
        })
      )

      // Allow 1 minute tolerance for test execution time
      expect(age).toBeGreaterThanOrEqual(29)
      expect(age).toBeLessThanOrEqual(31)
    })

    it('should fail for invalid date string', async () => {
      const program = Effect.gen(function* () {
        const utils = yield* TimeUtils
        return yield* utils.getAgeMinutes('not-a-date')
      })

      const result = await Effect.runPromise(
        Effect.provide(program, TimeUtilsLive).pipe(Effect.either)
      )

      expect(result._tag).toBe('Left')
      if (result._tag === 'Left') {
        expect(result.left).toBeInstanceOf(TimeParseError)
        expect((result.left as TimeParseError).dateString).toBe('not-a-date')
      }
    })
  })

  describe('isPastTimeout', () => {
    it('should return true when past timeout', async () => {
      // Create a date 60 minutes ago
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

      const isPast = await runWithService(
        Effect.gen(function* () {
          const utils = yield* TimeUtils
          return yield* utils.isPastTimeout(oneHourAgo, 30) // 30 min timeout
        })
      )

      expect(isPast).toBe(true)
    })

    it('should return false when not past timeout', async () => {
      // Create a date 5 minutes ago
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()

      const isPast = await runWithService(
        Effect.gen(function* () {
          const utils = yield* TimeUtils
          return yield* utils.isPastTimeout(fiveMinutesAgo, 30) // 30 min timeout
        })
      )

      expect(isPast).toBe(false)
    })

    it('should return false at exact timeout boundary', async () => {
      // Create a date exactly 30 minutes ago
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()

      const isPast = await runWithService(
        Effect.gen(function* () {
          const utils = yield* TimeUtils
          return yield* utils.isPastTimeout(thirtyMinutesAgo, 30)
        })
      )

      // At exact boundary (age === timeout), should be false (not past)
      expect(isPast).toBe(false)
    })
  })

  describe('formatDuration', () => {
    it('should format duration through service', async () => {
      const formatted = await runWithService(
        Effect.gen(function* () {
          const utils = yield* TimeUtils
          return yield* utils.formatDuration(90)
        })
      )

      expect(formatted).toBe('1h 30m')
    })
  })

  describe('getCurrentISOTimestamp', () => {
    it('should return current timestamp in ISO format', async () => {
      const before = Date.now()

      const timestamp = await runWithService(
        Effect.gen(function* () {
          const utils = yield* TimeUtils
          return yield* utils.getCurrentISOTimestamp()
        })
      )

      const after = Date.now()

      // Parse the timestamp
      const parsed = new Date(timestamp).getTime()

      expect(parsed).toBeGreaterThanOrEqual(before)
      expect(parsed).toBeLessThanOrEqual(after)
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/)
    })
  })
})

// =============================================================================
// Integration Tests (Real-world scenarios)
// =============================================================================

describe('TimeUtils Integration', () => {
  it('should detect stuck spec (60+ minutes old)', async () => {
    const STUCK_THRESHOLD_MINUTES = 60

    // Simulate a spec that's been in-progress for 90 minutes
    const specStartTime = new Date(Date.now() - 90 * 60 * 1000).toISOString()

    const isStuck = await runWithService(
      Effect.gen(function* () {
        const utils = yield* TimeUtils
        return yield* utils.isPastTimeout(specStartTime, STUCK_THRESHOLD_MINUTES)
      })
    )

    expect(isStuck).toBe(true)
  })

  it('should not flag recently started spec as stuck', async () => {
    const STUCK_THRESHOLD_MINUTES = 60

    // Simulate a spec that just started 5 minutes ago
    const specStartTime = new Date(Date.now() - 5 * 60 * 1000).toISOString()

    const isStuck = await runWithService(
      Effect.gen(function* () {
        const utils = yield* TimeUtils
        return yield* utils.isPastTimeout(specStartTime, STUCK_THRESHOLD_MINUTES)
      })
    )

    expect(isStuck).toBe(false)
  })

  it('should format age for human display', async () => {
    const twoHoursAgo = new Date(Date.now() - 125 * 60 * 1000).toISOString()

    const formatted = await runWithService(
      Effect.gen(function* () {
        const utils = yield* TimeUtils
        const age = yield* utils.getAgeMinutes(twoHoursAgo)
        return yield* utils.formatDuration(age)
      })
    )

    // Should be approximately "2h 5m"
    expect(formatted).toMatch(/2h \dm/)
  })
})
