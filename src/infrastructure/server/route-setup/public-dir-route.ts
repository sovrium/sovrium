/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { realpath } from 'node:fs/promises'
import { join, sep } from 'node:path'
import { type Hono } from 'hono'
import { inferMimeFromKey } from '@/domain/kernel/identity/mime-types'
import { logDebug } from '@/infrastructure/logging/logger'
import { getCacheControlHeader } from './asset-cache-control'
import { PUBLIC_DIR_SECRET_BLOCKLIST } from './public-dir-blocklist'

/**
 * Setup public directory file serving for development
 *
 * Serves files from a local directory at their relative path.
 * e.g., `publicDir/logos/escp.png` is served at `/logos/escp.png`
 *
 * Hardening (S1 / S4 of the Pre-Launch Security checklist):
 *   1. Realpath the publicDir ONCE at mount time so all comparisons are against
 *      the canonical absolute root. If the directory does not exist at mount,
 *      do NOT register the route — boot stays silent, the framework 404
 *      handler takes any matching request.
 *   2. Per-request: reject any path that matches PUBLIC_DIR_SECRET_BLOCKLIST
 *      with a fall-through to `next()` (→ 404). No log line, no 403, so an
 *      attacker cannot enumerate which secrets exist (anti-enumeration S1).
 *   3. Per-request: resolve the realpath of the joined file path. If the
 *      resolved path does not sit under the publicDir root (symlink escape,
 *      `..` traversal that Hono normalized, etc.), fall through to 404 —
 *      never follow a link out of the bound directory. A declared private
 *      asset (`privateRealpaths`) falls through the same way, even inside it.
 *
 * @param honoApp - Hono application instance
 * @param publicDir - Directory path to serve files from
 * @returns Hono app with public dir route configured (or the same app if the
 *          directory does not exist at mount time)
 */
export async function setupPublicDirRoute(
  honoApp: Readonly<Hono>,
  publicDir: string,
  privateRealpaths: ReadonlySet<string> = new Set()
): Promise<Readonly<Hono>> {
  // The canonical root, once; a missing directory registers nothing (framework 404).
  const rootRealpath = await realpath(publicDir).catch(() => {
    logDebug('[assets] publicDir not mounted', { publicDir })
    return undefined
  })
  if (rootRealpath === undefined) return honoApp

  // Boundary marker to enforce "under root" check (rules out e.g. `/var/foo`
  // matching `/var/foo-evil`). `path.sep` cross-platform.
  const rootPrefix = rootRealpath + sep

  return honoApp.get('/*', async (c, next) => {
    const { path } = c.req

    // 1) Blocklist match → 404 fall-through. Silent (anti-enumeration).
    if (PUBLIC_DIR_SECRET_BLOCKLIST.test(path)) {
      await next()
      return
    }

    // 2) Symlink-escape guard: resolve the target's realpath and verify it
    // sits under the publicDir root. Any failure (ENOENT, EACCES, broken
    // symlink) falls through to 404 — never propagate.
    const joinedPath = join(rootRealpath, path)
    const targetRealpath = await realpath(joinedPath).catch(() => undefined)
    if (
      targetRealpath === undefined ||
      (targetRealpath !== rootRealpath && !targetRealpath.startsWith(rootPrefix)) ||
      privateRealpaths.has(targetRealpath)
    ) {
      await next()
      return
    }

    // 3) Serve the file with an EXPLICIT Content-Type derived from the
    // extension. Deferring to Bun's implicit inference yields
    // `application/octet-stream` for extensionless/unknown files, and — because
    // the platform sets `X-Content-Type-Options: nosniff` — a browser then
    // hard-refuses any such response loaded as a `<script>`/`<link>`
    // ("not a valid JavaScript/CSS MIME type"). `inferMimeFromKey` maps the web
    // static-asset extensions explicitly and only falls back to octet-stream for
    // genuinely-unknown types. These are trusted, app-authored public files, so
    // (unlike untrusted bucket uploads) SVG is served inline with its real type;
    // the upload path's attachment/CSP gate is intentionally NOT applied here.
    const file = Bun.file(targetRealpath)
    if (await file.exists()) {
      return new Response(file, {
        headers: {
          'Content-Type': inferMimeFromKey(targetRealpath),
          'Cache-Control': getCacheControlHeader(),
        },
      })
    }

    await next()
  })
}
