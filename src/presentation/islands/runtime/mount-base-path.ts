/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Which base path is serving THIS console document, read from the DOM.
 *
 * The console's base is FIXED at `/_admin` (`admin` is a boolean), so reading
 * the attribute is not what makes a second base work — there is none. It is
 * what keeps this module from hard-coding a path a THIRD time: every console
 * document already carries the base it was served at on `data-admin-base-path`,
 * written by the server as a console-root reference and moved by the same link
 * rewrite that moves every `href` on the page. Reading the value the server
 * computed is cheaper than agreeing with it, and cannot drift from it.
 *
 * ─── WHY THE DOM AND NOT A PROP ────────────────────────────────────────────
 *
 * Because the islands that need it are not all prop-driven. The sidebar builds
 * its rows from a bundled catalogue, the SPA interceptor listens at the
 * document, and the operator menu is a frozen config literal — none of them
 * receive a per-request prop today, and giving each one would mean threading
 * the base through twenty-one shell builders. One attribute on the shell root
 * serves them all, and it is the same value the server already had to compute.
 *
 * ─── WHY THE FALLBACK IS THE DEFAULT MOUNT ─────────────────────────────────
 *
 * A document that carries no attribute is either the default mount rendered by
 * an older path or a surface outside the shell. `/_admin` is the correct answer
 * for the overwhelming majority of both, and it is what these modules
 * hard-coded before the attribute existed — so the fallback is exactly the
 * previous behaviour rather than a new guess.
 */

import {
  DEFAULT_ADMIN_MOUNT_PATH,
  MOUNT_BASE_PATH_ATTRIBUTE,
  rewriteConsoleRootPath,
} from '@/domain/models/app/admin/mount-hrefs'

/**
 * The base path this document is served at.
 *
 * Read on every call rather than memoized: the SPA nav swaps a surface's markup
 * in place, and although the shell root survives that swap, a memo would make
 * this module silently wrong the first time it does not.
 */
export const resolveMountBasePath = (): string => {
  if (typeof document === 'undefined') return DEFAULT_ADMIN_MOUNT_PATH
  const host = document.querySelector(`[${MOUNT_BASE_PATH_ATTRIBUTE}]`)
  const declared = host?.getAttribute(MOUNT_BASE_PATH_ATTRIBUTE)
  return declared !== null && declared !== undefined && declared !== ''
    ? declared
    : DEFAULT_ADMIN_MOUNT_PATH
}

/**
 * Move a console link authored against the default mount onto this document's
 * mount.
 *
 * An exact identity on the default mount, so a bundled catalogue of
 * `/_admin/...` links needs no per-entry change.
 */
export const consoleHref = (href: string): string =>
  rewriteConsoleRootPath(href, resolveMountBasePath())

/** Whether a pathname addresses this document's mount. */
export const isWithinMount = (pathname: string): boolean => {
  const basePath = resolveMountBasePath()
  return pathname === basePath || pathname.startsWith(`${basePath}/`)
}
