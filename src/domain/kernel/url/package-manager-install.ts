/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The package manager that installed this binary, read off the binary's own
 * path — the one place that recognises a Homebrew or a Scoop install, for
 * `sovrium update` (which hands the swap to that manager) and for a bug report
 * (which names the install channel).
 *
 * Read from the PATH, never the environment: a manager's variables are
 * exported into every shell of every user who has it installed, so reading
 * them would misfile a binary the install script put elsewhere.
 *
 * - Homebrew keeps a formula under `<prefix>/Cellar/sovrium/<version>/` and
 *   links `<prefix>/bin/sovrium` to it; Bun resolves the link when it computes
 *   `process.execPath`, so the linked command still reports its Cellar path.
 * - Scoop installs under `…\scoop\apps\sovrium\current\…`.
 *
 * Separators and case are normalised first, for Windows paths and for
 * case-insensitive macOS volumes. Pure.
 */

/** A package manager recognised from an install path. */
export type PackageManagerInstall = 'homebrew' | 'scoop'

/** The package manager whose layout `execPath` sits in, or `undefined` when none. */
export const packageManagerOfExecPath = (execPath: string): PackageManagerInstall | undefined => {
  const path = execPath.replace(/\\/g, '/').toLowerCase()
  if (path.includes('/cellar/sovrium/')) return 'homebrew'
  if (path.includes('/scoop/apps/sovrium/')) return 'scoop'
  return undefined
}
