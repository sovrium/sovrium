/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import path from 'node:path'

/**
 * Format an absolute filesystem path for human-readable display in CLI banners.
 *
 * Returns `./relative/path` when the target sits under `cwd`; otherwise returns
 * `absPath` unchanged. The fallback covers three cases the operator still wants
 * to see verbatim:
 *
 *  - target outside cwd (`SOVRIUM_DATA_DIR=/var/lib/sovrium`, global install
 *    under `$HOME/.sovrium`) — `path.relative` returns a `..`-prefixed string
 *  - non-absolute input (the SQLite `:memory:` sentinel) — pass-through
 *  - target equals cwd — empty relative path; show the absolute path instead
 *
 * `cwd` is injectable so unit tests can exercise both branches without poking
 * `process.cwd()` (which would couple the test to harness layout and trip the
 * cross-platform mock-module contamination rule).
 */
export const formatPathForDisplay = (absPath: string, cwd: string = process.cwd()): string => {
  if (!path.isAbsolute(absPath)) return absPath
  const rel = path.relative(cwd, absPath)
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) return absPath
  return `./${rel}`
}
