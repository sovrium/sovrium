/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What a code page may know about the sign-in waiting for its code: whether one
 * is waiting at all, and where it was headed. Read from the request's signed
 * `two_factor` cookie — the signature checked with the auth secret, exactly as
 * Better Auth checks it — then from the attempt's `verification` row and the
 * destination row kept beside it (`two-factor-destination.ts`). Never from the
 * page's address.
 */

import { eq, or } from 'drizzle-orm'
import { AUTH_COOKIE_PREFIX } from '@/domain/models/app/auth/session-cookie'
import { resolveAuthSecret } from '@/infrastructure/auth/auth-secret'
import { db } from '@/infrastructure/database'
import { authVerificationsTable } from '@/infrastructure/database/drizzle/dialect-schema'
import { logError } from '@/infrastructure/logging/logger'
import { isTransportRelaxed } from '@/infrastructure/process/security-posture'
import { destinationIdentifier, TWO_FACTOR_COOKIE } from './two-factor-attempt-keys'

/** The two-step attempt a request carries, as a code page reads it. */
export interface TwoFactorAttemptFacts {
  /** A sign-in is waiting for its code, and has not lapsed. */
  readonly live: boolean
  /** Where that sign-in was headed, when its form said. */
  readonly destination?: string
}

const NO_ATTEMPT: TwoFactorAttemptFacts = { live: false }

/**
 * The one name Better Auth gives the cookie, and the only one read: behind
 * `__Secure-` when secure cookies are on, bare on a relaxed transport — the
 * `useSecureCookies: !isTransportRelaxed()` of `buildAdvancedConfig` (`auth.ts`,
 * not imported: it would load Better Auth with every page). Never a second name:
 * a bare cookie can be planted over plain HTTP or from a sibling host, and read
 * before the real one it would choose the destination the code page sends to.
 */
const twoFactorCookieName = (): string =>
  `${isTransportRelaxed() ? '' : '__Secure-'}${AUTH_COOKIE_PREFIX}.${TWO_FACTOR_COOKIE}`

const HMAC = { name: 'HMAC', hash: 'SHA-256' } as const

/** Whether `signature` (base64) signs `value` with `secret`, as better-call signs a cookie. */
const signs = async (value: string, signature: string, secret: string): Promise<boolean> => {
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      HMAC,
      false,
      ['verify']
    )
    const bytes = Uint8Array.from(atob(signature), (char) => char.charCodeAt(0))
    return await crypto.subtle.verify(HMAC.name, key, bytes, new TextEncoder().encode(value))
  } catch {
    return false
  }
}

/** `value` URL-decoded, or `undefined` when its escapes are malformed. */
const decodedOrUndefined = (value: string): string | undefined => {
  try {
    return decodeURIComponent(value)
  } catch {
    return undefined
  }
}

/**
 * The attempt identifier a signed cookie value names, when its signature holds.
 * The value is `<identifier>.<base64 signature>`; it may still be URL-encoded
 * when the cookie parser left it so.
 */
export const verifiedAttemptId = async (
  cookieValue: string,
  secret: string
): Promise<string | undefined> => {
  const value = cookieValue.includes('%') ? decodedOrUndefined(cookieValue) : cookieValue
  if (value === undefined) return undefined
  const dot = value.lastIndexOf('.')
  if (dot < 1) return undefined
  const id = value.slice(0, dot)
  const signature = value.slice(dot + 1)
  if (signature.length !== 44 || !signature.endsWith('=')) return undefined
  return (await signs(id, signature, secret)) ? id : undefined
}

/** The rows of attempt `id` and of its kept destination, unexpired ones only. */
const liveRows = async (
  id: string
): Promise<readonly { readonly identifier: string; readonly value: string }[]> => {
  const verifications = authVerificationsTable()
  const rows = await db
    .select({
      identifier: verifications.identifier,
      value: verifications.value,
      expiresAt: verifications.expiresAt,
    })
    .from(verifications)
    .where(
      or(eq(verifications.identifier, id), eq(verifications.identifier, destinationIdentifier(id)))
    )
  const now = Date.now()
  return rows.filter((row) => new Date(row.expiresAt).getTime() > now)
}

/**
 * The attempt the request's cookies carry. No cookie, a forged or tampered one,
 * or an attempt whose row is gone or lapsed all read as no attempt.
 */
export async function readTwoFactorAttempt(
  cookies: Readonly<Record<string, string>> | undefined
): Promise<TwoFactorAttemptFacts> {
  const cookieValue = cookies?.[twoFactorCookieName()]
  if (cookieValue === undefined || cookieValue === '') return NO_ATTEMPT
  try {
    const id = await verifiedAttemptId(cookieValue, resolveAuthSecret())
    if (id === undefined || !id.startsWith('2fa-')) return NO_ATTEMPT
    const rows = await liveRows(id)
    if (!rows.some((row) => row.identifier === id)) return NO_ATTEMPT
    const destination = rows.find((row) => row.identifier === destinationIdentifier(id))?.value
    return destination === undefined ? { live: true } : { live: true, destination }
  } catch (err) {
    // The code form then draws the expired notice and its way back to sign in:
    // a page that cannot tell is safer saying so than drawing a dead field.
    logError('[auth:two-factor] could not read the sign-in waiting for its code', err)
    return NO_ATTEMPT
  }
}
