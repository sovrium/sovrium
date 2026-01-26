/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Context, Layer } from 'effect'

// =============================================================================
// Service Interface
// =============================================================================

/**
 * TimeUtils service for cross-platform date/time operations.
 *
 * Provides utilities for:
 * - Age calculation (detecting stuck specs)
 * - Timeout checking (workflow timeouts)
 * - Duration formatting (human-readable output)
 */
export interface TimeUtils {
  /**
   * Calculate age in minutes from an ISO date string.
   * Used to detect stuck in-progress specs.
   *
   * @param isoDate - ISO 8601 date string (e.g., "2025-01-25T10:30:00Z")
   * @returns Effect containing age in minutes (always >= 0)
   */
  readonly getAgeMinutes: (isoDate: string) => Effect.Effect<number, TimeParseError>

  /**
   * Check if a date is past a timeout threshold.
   * Returns true if the date is older than `minutes` minutes ago.
   *
   * @param isoDate - ISO 8601 date string
   * @param minutes - Timeout threshold in minutes
   * @returns Effect containing boolean (true if past timeout)
   */
  readonly isPastTimeout: (
    isoDate: string,
    minutes: number
  ) => Effect.Effect<boolean, TimeParseError>

  /**
   * Format a duration in minutes to human-readable string.
   * Examples: "5m", "1h 30m", "2h", "1d 3h"
   *
   * @param minutes - Duration in minutes (can be fractional)
   * @returns Formatted duration string
   */
  readonly formatDuration: (minutes: number) => Effect.Effect<string>

  /**
   * Get current timestamp in ISO 8601 format.
   * Useful for consistent timestamp generation across the codebase.
   *
   * @returns Current time as ISO string
   */
  readonly getCurrentISOTimestamp: () => Effect.Effect<string>
}

// =============================================================================
// Errors
// =============================================================================

/**
 * Error thrown when a date string cannot be parsed.
 */
export class TimeParseError extends Error {
  readonly _tag = 'TimeParseError' as const

  constructor(
    readonly dateString: string,
    readonly reason: string
  ) {
    super(`Failed to parse date "${dateString}": ${reason}`)
    this.name = 'TimeParseError'
  }
}

// =============================================================================
// Service Tag
// =============================================================================

export const TimeUtils = Context.GenericTag<TimeUtils>('TimeUtils')

// =============================================================================
// Pure Helper Functions (for testing and reuse)
// =============================================================================

/**
 * ISO 8601 date format regex.
 * Matches formats like:
 * - 2025-01-25T10:30:00Z
 * - 2025-01-25T10:30:00.000Z
 * - 2025-01-25T10:30:00+00:00
 * - 2025-01-25T10:30:00 (without timezone)
 */
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})?)?$/

/**
 * Parse an ISO date string to a Date object.
 * Returns null if parsing fails or if the string is not in valid ISO 8601 format.
 */
export const parseISODate = (isoDate: string): Date | null => {
  // Reject empty strings
  if (!isoDate || isoDate.trim() === '') {
    return null
  }

  // Validate ISO 8601 format first
  if (!ISO_DATE_REGEX.test(isoDate)) {
    return null
  }

  const date = new Date(isoDate)
  // Check for Invalid Date
  if (isNaN(date.getTime())) {
    return null
  }
  return date
}

/**
 * Calculate age in minutes between a date and now.
 * Pure function for testing.
 */
export const calculateAgeMinutes = (date: Date, now: Date = new Date()): number => {
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = diffMs / (1000 * 60)
  return Math.max(0, diffMinutes)
}

/**
 * Format minutes to human-readable duration.
 * Pure function for testing.
 */
export const formatMinutesToDuration = (minutes: number): string => {
  const absMinutes = Math.abs(Math.round(minutes))

  if (absMinutes < 60) {
    return `${absMinutes}m`
  }

  const days = Math.floor(absMinutes / (60 * 24))
  const hours = Math.floor((absMinutes % (60 * 24)) / 60)
  const mins = absMinutes % 60

  const parts: string[] = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (mins > 0 && days === 0) parts.push(`${mins}m`) // Only show minutes if less than a day

  return parts.length > 0 ? parts.join(' ') : '0m'
}

// =============================================================================
// Service Implementation
// =============================================================================

const timeUtilsImpl: TimeUtils = {
  getAgeMinutes: (isoDate: string) =>
    Effect.try({
      try: () => {
        const date = parseISODate(isoDate)
        if (!date) {
          throw new TimeParseError(isoDate, 'Invalid ISO 8601 date format')
        }
        return calculateAgeMinutes(date)
      },
      catch: (error) => {
        if (error instanceof TimeParseError) {
          return error
        }
        return new TimeParseError(isoDate, String(error))
      },
    }),

  isPastTimeout: (isoDate: string, minutes: number) =>
    Effect.gen(function* () {
      const age = yield* timeUtilsImpl.getAgeMinutes(isoDate)
      return age > minutes
    }),

  formatDuration: (minutes: number) => Effect.succeed(formatMinutesToDuration(minutes)),

  getCurrentISOTimestamp: () => Effect.sync(() => new Date().toISOString()),
}

// =============================================================================
// Layer
// =============================================================================

export const TimeUtilsLive = Layer.succeed(TimeUtils, TimeUtils.of(timeUtilsImpl))
