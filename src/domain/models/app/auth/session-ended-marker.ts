/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * How a sign-in page learns that the session its reader held has ended.
 *
 * A page that refuses a session (one presented from another browser, or one
 * that no longer exists) sends the reader to the sign-in page with the session
 * cookies expired, and adds `session=ended` to that address. The sign-in page
 * then says so in one sentence above its form.
 *
 * The marker carries no session, no account and no reason: anyone can type it
 * into an address, and all it does is show that sentence. It never tells a
 * third party anything about a session, so it cannot be used to probe one.
 */

/** The query key and value a refused session's redirect carries. */
const SESSION_ENDED_KEY = 'session'
const SESSION_ENDED_VALUE = 'ended'

/** `url` with the marker added, keeping its own query and fragment. */
export const withSessionEndedMarker = (url: string): string => {
  const hash = url.indexOf('#')
  const [base, fragment] = hash === -1 ? [url, ''] : [url.slice(0, hash), url.slice(hash)]
  const separator = base.includes('?') ? '&' : '?'
  return `${base}${separator}${SESSION_ENDED_KEY}=${SESSION_ENDED_VALUE}${fragment}`
}

/** Whether a request's query carries the marker. */
export const isSessionEndedQuery = (query: Readonly<Record<string, string>> | undefined): boolean =>
  query?.[SESSION_ENDED_KEY] === SESSION_ENDED_VALUE
