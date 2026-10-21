/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { AUTH_COOKIE_PREFIX, SESSION_COOKIE_NAME } from './session-cookie'

/**
 * READING THE SESSION COOKIES A REQUEST CARRIES AND A RESPONSE SETS.
 *
 * Some auth changes replace the session (confirming or turning off two-step
 * verification): the response sets a new session cookie in place of the one
 * the request carried, and the old session no longer exists. A request the
 * page sent just before, with the old cookie, is then answered with a
 * `Set-Cookie` clearing the session cookie — and the browser, which by then
 * holds the NEW cookie, drops it and is signed out. These pure readers let the
 * auth routes tell a replacement apart and leave such a late answer's clearing
 * out.
 */

/** The browser-enforced name prefixes a cookie can carry in front of its name. */
const SECURITY_PREFIX = /^__(Secure|Host)-/

/** The cookies that together hold a session: the token, its cache, the remember flag. */
const SESSION_FAMILY: ReadonlySet<string> = new Set(
  ['session_token', 'session_data', 'dont_remember'].map((name) => `${AUTH_COOKIE_PREFIX}.${name}`)
)

/** One `Set-Cookie` header, read: its name, its value, and whether it clears the cookie. */
export interface SetCookieEntry {
  readonly name: string
  readonly value: string
  readonly clears: boolean
}

const baseName = (name: string): string => name.replace(SECURITY_PREFIX, '')

/** A cookie value as the browser compares it: percent-decoded when it decodes. */
const decoded = (value: string): string => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/** A `Max-Age` of zero or less removes the cookie. */
const MAX_AGE_REMOVES = /^\s*max-age\s*=\s*(0|-\d+)\s*$/i

/** One `Set-Cookie` header read, or `undefined` when it names no cookie. */
export const parseSetCookie = (header: string): SetCookieEntry | undefined => {
  const [pair = '', ...attributes] = header.split(';')
  const separator = pair.indexOf('=')
  if (separator <= 0) return undefined
  const value = pair.slice(separator + 1).trim()
  return {
    name: pair.slice(0, separator).trim(),
    value,
    clears: value === '' || attributes.some((attribute) => MAX_AGE_REMOVES.test(attribute)),
  }
}

/** The session token a `Cookie` header carries, decoded, or `undefined` when it carries none. */
export const sessionTokenIn = (cookieHeader: string | undefined): string | undefined => {
  const value = (cookieHeader ?? '')
    .split(';')
    .flatMap((pair) => {
      const separator = pair.indexOf('=')
      if (separator === -1) return []
      const name = pair.slice(0, separator).trim()
      return baseName(name) === SESSION_COOKIE_NAME ? [pair.slice(separator + 1).trim()] : []
    })
    .find((candidate) => candidate !== '')
  return value === undefined ? undefined : decoded(value)
}

/** Whether a `Set-Cookie` clears one of the cookies that hold a session. */
export const clearsSessionCookie = (entry: SetCookieEntry): boolean =>
  entry.clears && SESSION_FAMILY.has(baseName(entry.name))

/**
 * Whether a response replaces the session the request carried `requestToken`
 * for: it sets a session cookie holding another token.
 */
export const replacesSession = (
  requestToken: string,
  entries: ReadonlyArray<SetCookieEntry>
): boolean =>
  entries.some(
    (entry) =>
      baseName(entry.name) === SESSION_COOKIE_NAME &&
      !entry.clears &&
      decoded(entry.value) !== requestToken
  )

/** The session tokens a response sets (not clears), decoded. */
export const sessionTokensSet = (entries: ReadonlyArray<SetCookieEntry>): readonly string[] =>
  entries
    .filter((entry) => baseName(entry.name) === SESSION_COOKIE_NAME && !entry.clears)
    .map((entry) => decoded(entry.value))

/**
 * REMEMBERING REPLACED TOKENS.
 *
 * The auth routes keep the tokens a response replaced, each with the instant it
 * is forgotten, in insertion order. A value longer than any session token the
 * engine issues is never one, and is not kept: what is kept is bounded by
 * {@link MAX_REMEMBERED_TOKEN_LENGTH} per entry as well as by the entry count.
 */

/** Longer than any signed session token the engine issues; a longer value is not kept. */
export const MAX_REMEMBERED_TOKEN_LENGTH = 512

/** Replaced tokens, each with the instant it is forgotten. */
export type RememberedTokens = ReadonlyMap<string, number>

/** The limits of what is remembered: how long, and how many at most. */
export interface RememberLimits {
  readonly forMs: number
  readonly max: number
}

/**
 * `remembered` with `token` added (or renewed) until `now + forMs`, every
 * expired entry dropped, and the oldest dropped past `max`. A token that cannot
 * be a session token is not added.
 */
export const rememberToken = (
  remembered: RememberedTokens,
  token: string,
  now: number,
  limits: RememberLimits
): RememberedTokens => {
  const live = [...remembered].filter(([key, until]) => until > now && key !== token)
  if (token === '' || token.length > MAX_REMEMBERED_TOKEN_LENGTH) return new Map(live)
  const next = [...live, [token, now + limits.forMs] as const]
  return new Map(next.slice(Math.max(0, next.length - limits.max)))
}

/** Whether `token` is remembered and not yet forgotten at `now`. */
export const isRemembered = (remembered: RememberedTokens, token: string, now: number): boolean =>
  (remembered.get(token) ?? 0) > now

/** `remembered` without `tokens` (a token set again is current again). */
export const forgetTokens = (
  remembered: RememberedTokens,
  tokens: readonly string[]
): RememberedTokens =>
  tokens.some((token) => remembered.has(token))
    ? new Map([...remembered].filter(([key]) => !tokens.includes(key)))
    : remembered
