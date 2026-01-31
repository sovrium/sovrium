/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * TDD Automation Duration Utilities
 *
 * Time parsing and duration utilities for staleness checks,
 * timeout calculations, and age comparisons.
 */

import { Duration, Effect, Option } from 'effect'

/**
 * Time unit multipliers in milliseconds
 */
const TIME_UNITS: Record<string, number> = {
  ms: 1,
  millisecond: 1,
  milliseconds: 1,
  s: 1000,
  sec: 1000,
  second: 1000,
  seconds: 1000,
  m: 60 * 1000,
  min: 60 * 1000,
  minute: 60 * 1000,
  minutes: 60 * 1000,
  h: 60 * 60 * 1000,
  hr: 60 * 60 * 1000,
  hour: 60 * 60 * 1000,
  hours: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
  days: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  weeks: 7 * 24 * 60 * 60 * 1000,
}

/**
 * Parse a duration string to milliseconds
 *
 * @param input - Duration string (e.g., "5m", "2 hours", "30s")
 * @returns Option containing milliseconds, or None if parsing fails
 *
 * @example
 * ```typescript
 * parseDurationString("5m")        // Some(300000)
 * parseDurationString("2 hours")   // Some(7200000)
 * parseDurationString("30s")       // Some(30000)
 * parseDurationString("invalid")   // None
 * ```
 */
export function parseDurationString(input: string): Option.Option<number> {
  const trimmed = input.trim().toLowerCase()

  // Match number followed by optional space and unit
  const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*([a-z]+)$/)
  if (!match) {
    // Try just a number (assume seconds)
    const numOnly = Number(trimmed)
    if (!Number.isNaN(numOnly)) {
      return Option.some(numOnly * 1000)
    }
    return Option.none()
  }

  const value = Number(match[1])
  const unit = match[2]

  if (!unit) {
    return Option.none()
  }

  const multiplier = TIME_UNITS[unit]
  if (multiplier === undefined) {
    return Option.none()
  }

  return Option.some(value * multiplier)
}

/**
 * Parse a duration string to Effect Duration
 *
 * @param input - Duration string
 * @returns Effect Duration or fails with error message
 *
 * @example
 * ```typescript
 * const duration = parseToDuration("5m") // Duration of 5 minutes
 * ```
 */
export function parseToDuration(input: string): Effect.Effect<Duration.Duration, string> {
  const result = parseDurationString(input)
  return Option.match(result, {
    onNone: () => Effect.fail(`Invalid duration format: "${input}"`),
    onSome: (ms) => Effect.succeed(Duration.millis(ms)),
  })
}

/**
 * Calculate age of a date from now
 *
 * @param date - Date to calculate age from
 * @returns Duration representing age
 *
 * @example
 * ```typescript
 * const createdAt = new Date('2024-01-01T00:00:00Z')
 * const age = getAge(createdAt) // Duration since creation
 * ```
 */
export function getAge(date: Date): Duration.Duration {
  const now = Date.now()
  const then = date.getTime()
  return Duration.millis(Math.max(0, now - then))
}

/**
 * Check if a date is older than a threshold duration
 *
 * @param date - Date to check
 * @param threshold - Maximum allowed age
 * @returns true if date is older than threshold
 *
 * @example
 * ```typescript
 * const isStale = isOlderThan(lastRunDate, Duration.hours(4))
 * ```
 */
export function isOlderThan(date: Date, threshold: Duration.Duration): boolean {
  const age = getAge(date)
  return Duration.greaterThan(age, threshold)
}

/**
 * Check if a date is within a threshold duration
 *
 * @param date - Date to check
 * @param threshold - Time window
 * @returns true if date is within threshold
 *
 * @example
 * ```typescript
 * const isRecent = isWithin(lastRunDate, Duration.minutes(30))
 * ```
 */
export function isWithin(date: Date, threshold: Duration.Duration): boolean {
  return !isOlderThan(date, threshold)
}

/**
 * Format duration as human-readable string
 *
 * @param duration - Duration to format
 * @returns Human-readable string (e.g., "5m 30s", "2h 15m")
 *
 * @example
 * ```typescript
 * formatDuration(Duration.minutes(125)) // "2h 5m"
 * formatDuration(Duration.seconds(45))  // "45s"
 * ```
 */
export function formatDuration(duration: Duration.Duration): string {
  const ms = Duration.toMillis(duration)

  if (ms < 1000) {
    return `${ms}ms`
  }

  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) {
    return `${seconds}s`
  }

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) {
    const remainingSeconds = seconds % 60
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`
  }

  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    const remainingMinutes = minutes % 60
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`
  }

  const days = Math.floor(hours / 24)
  const remainingHours = hours % 24
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`
}

/**
 * Format age relative to now
 *
 * @param date - Date to format relative to now
 * @returns Human-readable age string (e.g., "5m ago", "2h 15m ago")
 *
 * @example
 * ```typescript
 * formatAge(new Date(Date.now() - 300000)) // "5m ago"
 * ```
 */
export function formatAge(date: Date): string {
  const age = getAge(date)
  return `${formatDuration(age)} ago`
}

/**
 * Parse ISO 8601 duration string (P-format)
 * Commonly used in GitHub API responses
 *
 * @param iso8601 - ISO 8601 duration (e.g., "PT5M30S", "P1D")
 * @returns Option containing Duration, or None if parsing fails
 *
 * @example
 * ```typescript
 * parseISO8601Duration("PT5M30S") // Some(Duration of 5 min 30 sec)
 * parseISO8601Duration("P1D")     // Some(Duration of 1 day)
 * ```
 */
export function parseISO8601Duration(iso8601: string): Option.Option<Duration.Duration> {
  const match = iso8601.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/)

  if (!match) {
    return Option.none()
  }

  const days = Number(match[1] ?? 0)
  const hours = Number(match[2] ?? 0)
  const minutes = Number(match[3] ?? 0)
  const seconds = Number(match[4] ?? 0)

  const totalMs =
    days * 24 * 60 * 60 * 1000 + hours * 60 * 60 * 1000 + minutes * 60 * 1000 + seconds * 1000

  return Option.some(Duration.millis(totalMs))
}

/**
 * Create a staleness checker for workflow runs
 *
 * @param threshold - Maximum allowed age before considered stale
 * @returns Function that checks if a date is stale
 *
 * @example
 * ```typescript
 * const isStale = createStalenessChecker(Duration.hours(4))
 * const runs = workflowRuns.filter(run => !isStale(run.createdAt))
 * ```
 */
export function createStalenessChecker(threshold: Duration.Duration): (date: Date) => boolean {
  return (date: Date) => isOlderThan(date, threshold)
}

/**
 * Calculate time remaining until a date becomes stale
 *
 * @param date - Date to check
 * @param threshold - Staleness threshold
 * @returns Option containing remaining time, or None if already stale
 *
 * @example
 * ```typescript
 * const remaining = getTimeUntilStale(lastRun, Duration.hours(4))
 * if (Option.isSome(remaining)) {
 *   console.log(`Will be stale in: ${formatDuration(remaining.value)}`)
 * }
 * ```
 */
export function getTimeUntilStale(
  date: Date,
  threshold: Duration.Duration
): Option.Option<Duration.Duration> {
  const age = getAge(date)
  const thresholdMs = Duration.toMillis(threshold)
  const ageMs = Duration.toMillis(age)

  if (ageMs >= thresholdMs) {
    return Option.none() // Already stale
  }

  return Option.some(Duration.millis(thresholdMs - ageMs))
}
