/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * How this binary was installed, and the package-manager command that updates
 * an install a package manager owns. `update.ts` decides what to do with it.
 */

import { refuseCommand } from '@/cli/runtime/run-command'
import { packageManagerOfExecPath } from '@/domain/kernel/url/package-manager-install'
import { printLine, printProgress } from '@/infrastructure/logging/cli-output'

/**
 * How Sovrium was installed. Determines what `sovrium update` actually does.
 */
export type InstallMethod = 'binary' | 'homebrew' | 'docker' | 'scoop' | 'desktop'

/**
 * `desktop` is a RECOGNISED value, not a fall-through.
 *
 * The Sovrium app supervises this binary as a sidecar and carries its own
 * signed updater, so it sets the marker and the binary declines. Leaving the
 * value unrecognised would send it to `detectInstallMethod`'s heuristics, which
 * would answer `binary` and have the sidecar replace itself underneath the
 * shell that launched it — a mismatched pair being the failure the marker
 * exists to prevent.
 */
const INSTALL_METHODS = ['binary', 'homebrew', 'docker', 'scoop', 'desktop'] as const

const isInstallMethod = (value: string | undefined): value is InstallMethod =>
  value !== undefined && (INSTALL_METHODS as readonly string[]).includes(value)

/**
 * What install-method detection reads from the running process.
 *
 * Passed in rather than read inside so every branch is testable with plain
 * values — no module mocking, no real Cellar or Scoop directory on the runner.
 */
export interface InstallMethodProbe {
  /** Absolute path of THIS binary (`process.execPath`). */
  readonly execPath: string
  /** The `SOVRIUM_INSTALL_METHOD` marker or override, if any. */
  readonly override: string | undefined
}

/**
 * Classify an install from what the process can see about itself.
 *
 * Package managers are recognised from THIS binary's path, never from the
 * environment. A manager's variables are exported into every shell of every
 * user who has it installed — `brew shellenv` sets `HOMEBREW_PREFIX` on any Mac
 * with Homebrew, and a Scoop-aware shell carries `SCOOP` — so reading them
 * misfiles a binary the install script put in `~/.sovrium/bin` and sends
 * `sovrium update` to a package manager that never installed it.
 *
 * The path layouts themselves (Homebrew's Cellar, Scoop's `apps` tree) are
 * recognised in one place, {@link packageManagerOfExecPath}, which the bug
 * report's install channel reads too.
 *
 * A container is NOT inferred. `/.dockerenv` is wrong in both directions: an
 * install-script binary inside a devcontainer or CI job has it, and would be
 * told to `docker pull` an image it never came from; the official image under
 * Podman or Kubernetes lacks it, and would try to overwrite
 * `/usr/local/bin/sovrium` as its non-root user. The official image declares
 * itself instead — its `Dockerfile` sets `SOVRIUM_INSTALL_METHOD=docker`, the
 * same explicit marker the desktop app sets for its sidecar.
 */
export const classifyInstallMethod = (probe: Readonly<InstallMethodProbe>): InstallMethod => {
  if (isInstallMethod(probe.override)) return probe.override

  return packageManagerOfExecPath(probe.execPath) ?? 'binary'
}

/**
 * Detect how Sovrium was installed to choose the right update strategy.
 *
 * `SOVRIUM_INSTALL_METHOD` short-circuits detection. It is how the official
 * Docker image and the desktop app declare themselves, the test seam that lets
 * every branch be exercised on a CI runner without the matching package manager
 * present, and an escape hatch for operators whose layout fools the path-based
 * detection in {@link classifyInstallMethod}.
 */
export const detectInstallMethod = (): InstallMethod =>
  classifyInstallMethod({
    execPath: process.execPath,
    override: process.env.SOVRIUM_INSTALL_METHOD,
  })

/**
 * The package-manager command that updates a managed install, or null when the
 * install manages its own binary (raw binary / docker).
 */
export const packageManagerUpdateCommand = (
  method: InstallMethod
): readonly string[] | undefined => {
  // Qualify with the tap (`sovrium/tap/sovrium`): Sovrium ships from a Homebrew
  // tap, not core. Only `brew install` auto-taps a qualified name: `brew upgrade`
  // does not, and fails with "requires the tap sovrium/tap" when it is absent.
  // That holds here because this branch is reached only for a binary living in
  // the Cellar, which `brew install sovrium/tap/sovrium` put there after tapping.
  if (method === 'homebrew') return ['brew', 'upgrade', 'sovrium/tap/sovrium']
  // `scoop` is a PowerShell function, so it cannot be spawned as a bare exe.
  if (method === 'scoop') return ['powershell', '-NoProfile', '-Command', 'scoop update sovrium']
  return undefined
}

/**
 * Run the package-manager update command, inheriting stdio so its progress is
 * visible. Honors SOVRIUM_UPDATE_DRY_RUN (prints the command instead of running).
 * Propagates a non-zero exit code so `sovrium update` reflects the manager's result.
 */
export const runPackageManagerUpdate = async (command: readonly string[]): Promise<void> => {
  const display = command.join(' ')

  if (process.env.SOVRIUM_UPDATE_DRY_RUN === '1') {
    printLine(`Dry run: ${display}`)
    return
  }

  printProgress('Updating via your package manager')
  printLine(`  ${display}\n`)
  const proc = Bun.spawn([...command], { stdout: 'inherit', stderr: 'inherit', stdin: 'inherit' })
  const exitCode = await proc.exited
  if (exitCode !== 0) {
    // The package manager's own exit code is propagated verbatim (T33).
    return refuseCommand({
      headline: `${command[0]} exited with code ${exitCode}. Sovrium changed nothing.`,
      guidance: `Re-run '${display}' directly to see what your package manager reported.`,
      exitCode,
    })
  }
}
