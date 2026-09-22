/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Which mount a console surface belongs to, as an input to its stylesheet
 * identity.
 *
 * ─── WHY THE BASE PATH IS PART OF THE HASH ─────────────────────────────────
 *
 * The console collapses onto ONE stylesheet identity per app, because the CSS
 * route sees a hash and nothing else and must be able to map it back
 * (`OPERATOR_CONSOLE_CSS_KEY`). The base a surface is served at is part of what
 * makes those compiled classes what they are — the mount walk rewrites every
 * link before the corpus is harvested — so the base belongs in the identity
 * that keys the `immutable`-cached bytes, not beside it.
 *
 * With the base fixed at `/_admin` this contributes nothing today, and that is
 * the point of the shape rather than an argument against it: the fact the hash
 * depends on is recorded where the hash is derived, so it cannot silently stop
 * being true.
 *
 * ─── WHY IT IS AN INTERSECTION, NOT AN AppSchema FIELD ──────────────────────
 *
 * Same reasoning as `designSystemScope` next door, and the same shape: this is
 * a RENDERING fact about one synthesized surface, not a configuration option an
 * operator may write. Nothing decodes it and no config file can set it. It
 * survives synthesis because `synthesiseMountSurface` spreads its host app
 * (`...scopedApp`), which is how the scope marker already reaches the renderer
 * — the same property the deleted `buildDashboardSurfaceApp` had, preserved by
 * the use-case that replaced it.
 *
 * The DEFAULT mount deliberately contributes NOTHING to the key. That keeps
 * `/_admin`'s hash — and therefore its rendered HTML — byte-identical to what
 * it was before mounts existed.
 */

import { DEFAULT_ADMIN_MOUNT_PATH } from '@/domain/models/app/admin/mount-hrefs'
import type { App } from '@/domain/models/app'

/** An app that additionally knows which mount is serving it. */
export type MountedApp = App & { readonly mountBasePath?: string }

/** The base path this app is being served at, if it is a mounted one. */
export const getMountBasePath = (app?: App): string | undefined =>
  (app as MountedApp | undefined)?.mountBasePath

/** Record the base path a mounted app is served at. */
export const withMountBasePath = (app: App, basePath: string): App =>
  ({ ...app, mountBasePath: basePath }) as MountedApp

/**
 * The compile identity contributed by the mount — empty for the default.
 *
 * Both halves of the CSS contract read this and must agree exactly: the
 * renderer mints the URL a console page links, and the CSS route recognises it
 * on the way back in.
 */
export const mountIdentityKey = (app?: App): string => {
  const basePath = getMountBasePath(app)
  if (basePath === undefined || basePath === DEFAULT_ADMIN_MOUNT_PATH) return ''
  return `::mount::${basePath}`
}
