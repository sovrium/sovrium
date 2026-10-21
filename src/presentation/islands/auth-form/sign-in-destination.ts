/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { toSafeRedirectPath } from '@/domain/kernel/url/redirect-safety'
import { resolveMountBasePath } from '@/presentation/islands/runtime/mount-base-path'

/**
 * Where a sign-in sends the reader, first match wins:
 *
 * 1. the page's own `?callbackURL=` — the way back a page that sent the reader
 *    here to sign in (the OAuth consent screen) asked for;
 * 2. `?redirect=` — the deep link a page access rule was guarding when it sent
 *    a signed-out visitor here;
 * 3. `?next=` when it names a page of the operator CONSOLE (where a session
 *    that ended sends its reader, so signing in brings them back);
 * 4. the form's configured destination.
 *
 * Every query value is untrusted: only `toSafeRedirectPath` output is ever
 * used, so a value naming another site (`https://…`, `//…`, `/\…`) is dropped.
 * A `redirect` or `next` pointing back at the sign-in page itself is dropped
 * too, and `next` is further held to the console's own paths — an allow-list,
 * so a link carrying `next=` with any app path signs in to the configured
 * destination instead.
 */
export const signInDestination = (configured: string | undefined): string | undefined => {
  const here = globalThis.location
  const query = new URLSearchParams(here?.search)
  const safe = (key: string): string | undefined => toSafeRedirectPath(query.get(key))
  const pathnameOf = (path: string): string => new URL(path, here?.href).pathname
  // A `redirect` or `next` naming the page the reader is signing in on is dropped.
  const away = (path: string | undefined): string | undefined =>
    path !== undefined && pathnameOf(path) !== here?.pathname ? path : undefined
  const next = away(safe('next'))
  return (
    safe('callbackURL') ??
    away(safe('redirect')) ??
    (next !== undefined && isConsolePath(pathnameOf(next)) ? next : undefined) ??
    configured
  )
}

/** Whether a path is a page of the console mount (and not its sign-in page itself). */
const isConsolePath = (pathname: string): boolean => {
  const base = resolveMountBasePath()
  return pathname.startsWith(`${base}/`) && pathname !== `${base}/login`
}
