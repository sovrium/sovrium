/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { hasSessionCookie } from '@/domain/models/app/auth/session-cookie'
import type { Context } from 'hono'

/**
 * Whether a request carries anything a session could be resolved from.
 *
 * Three things make Better Auth look a session up: the session cookie (by
 * name — a language or consent cookie resolves nothing), an `Authorization`
 * header, or an `x-api-key` (the API-key plugin's hook matches any
 * `getSession` carrying it, and resolving it is a database lookup). A request
 * with none of the three resolves no session.
 *
 * The cookie name comes from the same constant the auth instance pins its
 * `advanced.cookiePrefix` to (`session-cookie.ts`), so the name the server
 * sets and the name recognised here cannot drift apart.
 *
 * ONE predicate for two decisions that must agree: `authMiddleware` skips the
 * lookup when it is false, and the per-address ceiling counts a page, `.md`
 * twin or console request only when it is true — the requests that can cause
 * a lookup are exactly the ones counted.
 */

const present = (value: string | undefined): boolean => (value ?? '') !== ''

export const carriesCredential = (c: Context): boolean =>
  hasSessionCookie(c.req.header('cookie')) ||
  present(c.req.header('authorization')) ||
  present(c.req.header('x-api-key'))
