/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

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
