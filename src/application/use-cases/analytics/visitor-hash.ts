/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The visitor identifier, rotated daily; used to count unique visitors without
 * a cookie. And the session identifier that groups one visitor's events into
 * time windows.
 *
 * Both are computed on the server with the Web Crypto API; the browser sends
 * neither.
 */

import { Effect } from 'effect'
import { zonedIsoDate, zonedMinutesSinceMidnight } from '@/domain/kernel/time/zoned-calendar'
import { truncateToNetwork } from '@/domain/models/app/analytics/visitor-network-service'
import { VisitorSecret } from '../../ports/services/visitor-secret'
import type { AnalyticsProfile } from '@/domain/models/app/analytics/analytics-profile-service'

/** Hex encoding of a digest. */
const toHex = (buffer: ArrayBuffer): string =>
  Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

/**
 * The visitor identifier of one visitor on one day.
 *
 * Stable for the same secret, day and request; different as soon as any of
 * them changes.
 *
 * @param secret - The day's secret, from {@link VisitorSecret}
 * @param day - The calendar day (`YYYY-MM-DD`) in the operator timezone
 * @param address - The client address the identifier is computed from
 * @param userAgent - The client User-Agent string
 * @returns 64 lowercase hexadecimal characters
 */
export const computeVisitorHash = async (
  secret: Uint8Array<ArrayBuffer>,
  day: string,
  address: string,
  userAgent: string
): Promise<string> => {
  const key = await crypto.subtle.importKey(
    'raw',
    secret,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const message = new TextEncoder().encode(`${day}|${address}|${userAgent}`)
  return toHex(await crypto.subtle.sign('HMAC', key, message))
}

/**
 * Compute a session hash from a visitor hash and session timeout.
 *
 * Sessions are grouped by time windows based on the configured timeout.
 * A new session starts after the timeout period of inactivity.
 *
 * The window and the date are both read on the wall clock of `timeZone`, so a
 * window never straddles two days on a host not running in UTC.
 *
 * @param visitorHash - The visitor's daily identifier
 * @param sessionTimeoutMinutes - Session timeout in minutes
 * @param timeZone - IANA zone the windows are counted in (operator timezone)
 * @param now - the reference instant (injected for tests)
 * @returns 64 lowercase hexadecimal characters
 */
export const computeSessionHash = async (
  visitorHash: string,
  sessionTimeoutMinutes: number,
  timeZone: string,
  now: Readonly<Date> = new Date()
): Promise<string> => {
  // e.g., with 30min timeout: 0-29min -> window 0, 30-59min -> window 1
  const timeWindow = Math.floor(zonedMinutesSinceMidnight(now, timeZone) / sessionTimeoutMinutes)
  const dateStr = zonedIsoDate(now, timeZone)
  const data = new TextEncoder().encode(`${visitorHash}|${dateStr}|${timeWindow}`)
  return toHex(await crypto.subtle.digest('SHA-256', data))
}

/** What a request contributes to its visitor's identifiers. */
export interface VisitorRequest {
  readonly address: string
  readonly userAgent: string
  /** IANA zone whose calendar day rotates the identifier (the operator timezone). */
  readonly timeZone: string
  readonly sessionTimeoutMinutes: number
  /** Under `audience-only` the identifier is computed from the client's network, not its address. */
  readonly profile: AnalyticsProfile
}

/**
 * The visitor and session identifiers of one request, keyed by the server's
 * secret of the current day.
 */
export const visitorIdentifiers = (
  request: VisitorRequest
): Effect.Effect<
  { readonly visitorHash: string; readonly sessionHash: string },
  never,
  VisitorSecret
> =>
  Effect.gen(function* () {
    const day = zonedIsoDate(new Date(), request.timeZone)
    const secret = yield* (yield* VisitorSecret).secretFor(day)
    const address =
      request.profile === 'audience-only' ? truncateToNetwork(request.address) : request.address
    // effect-promise: total -- Web Crypto always supports both algorithms used here, the key is always 32 bytes and every input is a valid BufferSource, so neither call has a rejection path.
    const visitorHash = yield* Effect.promise(() =>
      computeVisitorHash(secret, day, address, request.userAgent)
    )
    // effect-promise: total -- a digest over a `TextEncoder` result has no rejection path.
    const sessionHash = yield* Effect.promise(() =>
      computeSessionHash(visitorHash, request.sessionTimeoutMinutes, request.timeZone)
    )
    return { visitorHash, sessionHash }
  }).pipe(Effect.withSpan('analytics.visitor-identifiers'))
