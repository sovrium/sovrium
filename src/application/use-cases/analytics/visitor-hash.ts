/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Privacy-safe visitor identification using SHA-256 hashing.
 *
 * Hashing strategy:
 * - Visitor hash: SHA-256(date + IP + UA + salt) — rotates daily, no PII stored
 * - Session hash: SHA-256(visitorHash + timeWindow) — groups views into sessions
 *
 * Uses Web Crypto API (crypto.subtle) — zero external dependencies.
 */

import { zonedIsoDate, zonedMinutesSinceMidnight } from '@/domain/kernel/time/zoned-calendar'

/**
 * Convert ArrayBuffer to hex string
 */
const toHex = (buffer: ArrayBuffer): string =>
  Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

/**
 * Compute SHA-256 hash of a string using Web Crypto API
 */
const sha256 = async (input: string): Promise<string> => {
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return toHex(hash)
}

/**
 * Compute a privacy-safe visitor hash.
 *
 * Hash rotates daily (date component), making it impossible to track
 * a visitor across days. No cookies or PII are stored. The day is the calendar
 * day of the operator timezone, so the rotation happens at the operator's
 * midnight rather than at UTC's.
 *
 * @param ip - Client IP address (from X-Forwarded-For or connection)
 * @param userAgent - Client User-Agent string
 * @param salt - Application-specific salt for additional privacy
 * @param timeZone - IANA zone whose calendar day rotates the hash (operator timezone)
 * @returns SHA-256 hex string (64 characters)
 */
export const computeVisitorHash = async (
  ip: string,
  userAgent: string,
  salt: string,
  timeZone: string
): Promise<string> => {
  const today = zonedIsoDate(new Date(), timeZone) // YYYY-MM-DD
  return sha256(`${today}|${ip}|${userAgent}|${salt}`)
}

/**
 * Compute a session hash from a visitor hash and session timeout.
 *
 * Sessions are grouped by time windows based on the configured timeout.
 * A new session starts after the timeout period of inactivity.
 *
 * The window and the date are both read on the wall clock of `timeZone`. They
 * used to mix the process zone's hours with the UTC date, so on any host not
 * running in UTC a window could straddle two different days.
 *
 * @param visitorHash - The visitor's daily hash
 * @param sessionTimeoutMinutes - Session timeout in minutes
 * @param timeZone - IANA zone the windows are counted in (operator timezone)
 * @param now - the reference instant (injected for tests)
 * @returns SHA-256 hex string (64 characters)
 */
export const computeSessionHash = async (
  visitorHash: string,
  sessionTimeoutMinutes: number,
  timeZone: string,
  now: Readonly<Date> = new Date()
): Promise<string> => {
  // Create time windows based on session timeout
  // e.g., with 30min timeout: 0-29min -> window 0, 30-59min -> window 1
  const timeWindow = Math.floor(zonedMinutesSinceMidnight(now, timeZone) / sessionTimeoutMinutes)
  const dateStr = zonedIsoDate(now, timeZone)
  return sha256(`${visitorHash}|${dateStr}|${timeWindow}`)
}
