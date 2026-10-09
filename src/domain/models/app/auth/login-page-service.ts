/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { LOGIN_PAGE_PATTERN, type Auth } from './auth'

/** The sign-in page an app gets when it names none. */
export const DEFAULT_LOGIN_PAGE = '/login'

/**
 * Whether a value may be used as the app's sign-in page: a path on this app,
 * never a host. The same test `auth.loginPage` passes at validate, re-applied
 * wherever a value reaches a redirect without having been decoded (a config
 * read raw by `library add`).
 */
export const isAppRelativeLoginPage = (value: unknown): value is string =>
  typeof value === 'string' && LOGIN_PAGE_PATTERN.test(value)

/** Every character outside ASCII, one code point at a time. */
const NON_ASCII = /[\u0080-\u{10FFFF}]/gu

/**
 * `path` with every non-ASCII character percent-encoded as UTF-8, and nothing
 * else touched (an author's own `%XX` stays as written). A `Location` header
 * only carries bytes, so a raw `/connexión` or `/登录` either breaks the
 * response or reaches the browser as mojibake; encoded, it is the same page.
 */
const encodeNonAscii = (path: string): string =>
  path.toWellFormed().replace(NON_ASCII, (character) => encodeURIComponent(character))

/**
 * The app's sign-in page: `auth.loginPage` when it is a path on this app,
 * else {@link DEFAULT_LOGIN_PAGE}. A value that is not a path never leaks into
 * a redirect, even if it reached here undecoded. Non-ASCII characters come
 * back percent-encoded, ready for a `Location` header.
 */
export const loginPageOf = (auth: Pick<Auth, 'loginPage'> | undefined): string => {
  const configured = auth?.loginPage
  return isAppRelativeLoginPage(configured) ? encodeNonAscii(configured) : DEFAULT_LOGIN_PAGE
}

/**
 * The relative sign-in redirect carrying the way back: `loginPage` with
 * `callbackURL` set to `returnTo` (a path and query on this app). The login
 * page carries no query of its own, so `?` is always the right separator.
 */
export const signInRedirectPath = (loginPage: string, returnTo: string): string =>
  `${loginPage}?callbackURL=${encodeURIComponent(returnTo)}`
