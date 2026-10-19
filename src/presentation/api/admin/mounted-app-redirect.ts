/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { toSafeRedirectPath } from '@/domain/kernel/url/redirect-safety'
import { requestSearch } from '@/domain/kernel/url/request-search'
import { toMountPath } from '@/domain/models/app/admin/mount-hrefs'
import { resolveRedirect } from '@/domain/models/app/redirects/redirect-matcher'
import type { EmbeddedAppMount } from '@/application/ports/contracts/embedded-app-mount'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

/**
 * A mounted app's retired path, answered under its mount: `/tables` authored
 * in the console's config is `${base}/tables` on the wire, and its target
 * lands at `${base}/records`. `from` is matched against the MOUNT-RELATIVE
 * path; `to` needs no prefix here, because it is a navigation value and the
 * boot-time href walk (`prefixMountHrefs`) already moved it onto the base. The
 * query string is carried as for any redirect. No language prefix is matched or
 * re-applied — the mount serves no locale-prefixed paths.
 *
 * The caller resolves this only AFTER its access decision, so a caller who may
 * not reach the console gets its 404 — never a 301 that would confirm the
 * retired path once existed.
 */
export const resolveMountedRedirect = (
  mount: EmbeddedAppMount,
  scopedApp: App,
  c: Context
): Response | undefined => {
  const rules = scopedApp.redirects
  if (rules === undefined || rules.length === 0) return undefined
  const mountPath = toMountPath(mount.basePath, c.req.path)
  const resolution = resolveRedirect(rules, [], mountPath, requestSearch(c))
  return resolution === undefined ? undefined : c.redirect(resolution.location, resolution.status)
}

/**
 * Where a reader who is ALREADY signed in goes when they reach a sign-in surface
 * of the mount: back to the page named by `?next=`, when it is a page of this
 * mount, else the mount's home.
 *
 * A console page whose read came back 401 sends the reader to `login?next=` —
 * and when the session turns out to be live after all (the refusal was a stale
 * cookie, a proxy, a read the server answered for another reason), sending
 * them to the home would lose the page they were on. `next` is held to a
 * same-origin path under the mount, so it can never lead off the console, and
 * never to a sign-in surface of the mount.
 */
export const signedInDestination = (mount: EmbeddedAppMount, next: string | undefined): string => {
  const safe = toSafeRedirectPath(next)
  const base = mount.basePath
  const inMount = safe !== undefined && (safe === base || safe.startsWith(`${base}/`))
  // A `next` naming a sign-in surface itself would answer this redirect with
  // itself, forever.
  const signInSurface =
    safe !== undefined && mount.signedInRedirectPaths.has(safe.split(/[?#]/, 1)[0] ?? safe)
  return inMount && !signInSurface ? safe : base
}
