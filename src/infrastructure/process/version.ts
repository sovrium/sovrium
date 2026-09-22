/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolvePackagePath } from './package-paths'

/**
 * Build-time define injected by `[internal ref]`
 * (`--define=__SOVRIUM_VERSION__=...`). Present in compiled binaries; undefined
 * when running from source (`bun run`) or the bundled npm package.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention -- build-time define constant
declare const __SOVRIUM_VERSION__: string | undefined

/**
 * Resolve Sovrium's own version (NOT the consumer app's).
 *
 * Order of precedence:
 * 1. The compile-time `__SOVRIUM_VERSION__` define — the only path that runs in
 *    a `bun build --compile` binary, where no `package.json` exists on disk
 *    beside the executable.
 * 2. `package.json` read via {@link resolvePackagePath} — dev and bundled modes.
 * 3. `'0.0.0'` — a valid SemVer fallback if the file cannot be read.
 *
 * Never throws: a missing/unreadable `package.json` degrades to `'0.0.0'`
 * rather than crashing boot.
 */
export const getSovriumVersion = async (): Promise<string> => {
  if (typeof __SOVRIUM_VERSION__ !== 'undefined') {
    return __SOVRIUM_VERSION__
  }
  try {
    const { version } = (await Bun.file(resolvePackagePath('package.json')).json()) as {
      version?: string
    }
    return typeof version === 'string' && version.length > 0 ? version : '0.0.0'
  } catch {
    return '0.0.0'
  }
}
