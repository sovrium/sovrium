/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { toSafeRedirectPath } from '@/domain/kernel/url/redirect-safety'
import { resolveMountBasePath } from '@/presentation/islands/runtime/mount-base-path'

/**
 * Where a sign-in sends the reader: the page's own `?callbackURL=` when it is a
 * same-origin path — the way back a page that sent the reader here to sign in
 * (the OAuth consent screen) asked for — then `?next=` when it names a page of
 * the operator CONSOLE (where a session that ended sends its reader, so signing
 * in brings them back), and the form's configured destination otherwise. Both
 * query values are untrusted: only `toSafeRedirectPath` output is ever used,
 * and `next` is further held to the console's own paths — an allow-list, so a
 * link carrying `next=https://elsewhere` or any app path signs in to the
 * configured destination instead.
 */
export const signInDestination = (configured: string | undefined): string | undefined => {
  const query = new URLSearchParams(globalThis.location?.search ?? '')
  const next = toSafeRedirectPath(query.get('next') ?? undefined)
  const consoleNext =
    next !== undefined && isConsolePath(new URL(next, globalThis.location?.href).pathname)
      ? next
      : undefined
  return toSafeRedirectPath(query.get('callbackURL') ?? undefined) ?? consoleNext ?? configured
}

/** Whether a path is a page of the console mount (and not its sign-in page itself). */
const isConsolePath = (pathname: string): boolean => {
  const base = resolveMountBasePath()
  return pathname.startsWith(`${base}/`) && pathname !== `${base}/login`
}
