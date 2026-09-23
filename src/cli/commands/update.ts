#!/usr/bin/env bun
/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Sovrium CLI - Self-update and version checking module
 *
 * Extracted from cli.ts to keep the main CLI file within line limits.
 * Handles:
 * - Fetching latest version from GitHub Releases API
 * - Source-aware update: self-replace for raw binary installs, delegate to the
 *   package manager (Homebrew/Scoop) so its version ledger stays in sync,
 *   instruct for Docker
 * - Non-blocking background version check on startup
 *
 * Test/advanced seams (env vars):
 * - `SOVRIUM_INSTALL_METHOD`   force the detected install method
 * - `SOVRIUM_DISABLE_NETWORK`  skip all network calls (offline)
 * - `SOVRIUM_UPDATE_API_HOST`  override the GitHub API host (default api.github.com)
 * - `SOVRIUM_UPDATE_DRY_RUN`   print the package-manager command instead of running it
 */

import { existsSync, readFileSync } from 'node:fs'
import { chmod, copyFile, mkdir, rename, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { Effect, Console } from 'effect'
import { UPDATE_HELP_TEXT } from '@/cli/runtime/command-help'
import { withFetchTimeout } from '@/infrastructure/egress/with-fetch-timeout'
import {
  formatBytes,
  printDocument,
  printFailure,
  printProgress,
} from '@/infrastructure/logging/cli-output'

const GITHUB_REPO = 'sovrium/sovrium'
const GITHUB_API_HOST_DEFAULT = 'api.github.com'
const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000 // 24 hours
const UPDATE_CHECK_FILE = join(homedir(), '.sovrium', 'last-update-check')

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

/** Whether all network access is disabled (offline / test mode). */
const isNetworkDisabled = (): boolean => process.env.SOVRIUM_DISABLE_NETWORK === '1'

/** GitHub API host, overridable for tests (point at an unroutable IP to force failure). */
const githubApiHost = (): string => process.env.SOVRIUM_UPDATE_API_HOST || GITHUB_API_HOST_DEFAULT

/**
 * Detect how Sovrium was installed to choose the right update strategy.
 *
 * `SOVRIUM_INSTALL_METHOD` short-circuits detection — it is the test seam that
 * lets every branch be exercised on a CI runner without the matching package
 * manager present, and an escape hatch for operators whose environment fools
 * the heuristics below.
 */
export const detectInstallMethod = (): InstallMethod => {
  const override = process.env.SOVRIUM_INSTALL_METHOD
  if (isInstallMethod(override)) return override

  if (existsSync('/.dockerenv')) return 'docker'
  if (process.env.HOMEBREW_PREFIX) return 'homebrew'

  // Scoop installs the app under `…\scoop\apps\sovrium\current\…`. Match that
  // segment in THIS binary's path (authoritative) rather than the `SCOOP` env
  // var, which any process in a Scoop-aware shell inherits → false positives.
  // Normalize separators + case for Windows before matching.
  const execPathNormalized = process.execPath.replace(/\\/g, '/').toLowerCase()
  if (execPathNormalized.includes('/scoop/apps/sovrium/')) return 'scoop'

  return 'binary'
}

/**
 * Fetch the latest release version from GitHub.
 * Returns undefined on any error (timeout, network, disabled, etc.)
 */
const fetchLatestVersion = async (): Promise<string | undefined> => {
  if (isNetworkDisabled()) return undefined
  try {
    const response = await withFetchTimeout(
      `https://${githubApiHost()}/repos/${GITHUB_REPO}/releases/latest`,
      {},
      3000
    )

    if (!response.ok) return undefined

    const data = (await response.json()) as { readonly tag_name?: string }
    const tag = data.tag_name
    return tag ? tag.replace(/^v/, '') : undefined
  } catch {
    return undefined
  }
}

/**
 * Compare two semver strings. Returns true if b > a.
 */
const isNewerVersion = (current: string, latest: string): boolean => {
  const [aMaj = 0, aMin = 0, aPat = 0] = current.split('.').map(Number)
  const [bMaj = 0, bMin = 0, bPat = 0] = latest.split('.').map(Number)
  if (bMaj !== aMaj) return bMaj > aMaj
  if (bMin !== aMin) return bMin > aMin
  return bPat > aPat
}

/**
 * The package-manager command that updates a managed install, or null when the
 * install manages its own binary (raw binary / docker).
 */
const packageManagerUpdateCommand = (method: InstallMethod): readonly string[] | undefined => {
  // Qualify with the tap (`sovrium/tap/sovrium`): Sovrium ships from a Homebrew
  // tap, not core, so the bare name fails to resolve when the tap isn't already
  // tapped. The qualified name auto-taps, so no separate `brew tap` step is needed.
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
const runPackageManagerUpdate = async (command: readonly string[]): Promise<void> => {
  const display = command.join(' ')

  if (process.env.SOVRIUM_UPDATE_DRY_RUN === '1') {
    Effect.runSync(Console.log(`Dry run: ${display}`))
    return
  }

  printProgress('Updating via your package manager')
  Effect.runSync(Console.log(`  ${display}\n`))
  const proc = Bun.spawn([...command], { stdout: 'inherit', stderr: 'inherit', stdin: 'inherit' })
  const exitCode = await proc.exited
  if (exitCode !== 0) {
    printFailure({
      headline: `${command[0]} exited with code ${exitCode}. Sovrium changed nothing.`,
      guidance: `Re-run '${display}' directly to see what your package manager reported.`,
    })
    // eslint-disable-next-line functional/no-expression-statements
    process.exit(exitCode)
  }
}

/**
 * Bundle of optional invocation-side options for the update command.
 *
 * Threaded as a single object so the handler stays open to future flags
 * (e.g. `--check-only`) without churning the call site.
 */
export interface UpdateCommandOptions {
  /** `--help`/`-h` was present in argv after the `update` token. */
  readonly helpRequested?: boolean
}

const showUpdateHelp = (): void => {
  Effect.runSync(Console.log(UPDATE_HELP_TEXT))
}

/**
 * Handle the 'update' command — update Sovrium regardless of how it was installed.
 *
 * - homebrew/scoop → run the package manager (keeps its version ledger correct)
 * - docker         → print the `docker pull` instruction (a container can't self-update)
 * - desktop        → decline and name the Sovrium app, which owns the update
 * - binary         → self-replace from GitHub Releases (Unix); Windows raw binaries
 *                    are directed to Scoop/Docker (no running-exe overwrite)
 */
export const handleUpdateCommand = async (
  options?: Readonly<UpdateCommandOptions>
): Promise<void> => {
  // `sovrium update --help` shows the update-specific help. The global
  // `--help` early-exit in dispatch.ts only fires when no positional precedes
  // the flag, so subcommand-level help survives parsing — it's surfaced here
  // via the `helpRequested` flag forwarded by index.ts.
  if (options?.helpRequested) {
    showUpdateHelp()
    return
  }

  const installMethod = detectInstallMethod()

  // Checked before anything else runs: the desktop branch must reach neither a
  // package manager nor the network, because the app it belongs to is already
  // doing both. Two updaters racing leave a shell and a sidecar on different
  // versions, expecting different command surfaces of each other.
  //
  // Exit 0, the same shape of answer the `docker` branch gives: this install is
  // managed elsewhere, here is where. A non-zero exit would make a wrapper
  // script treat a correct refusal as a failure, and would tell a user their
  // app is broken when it is not.
  if (installMethod === 'desktop') {
    Effect.runSync(
      Console.log(
        'Sovrium is running inside the Sovrium app, which keeps it up to date for you.\n\n' +
          'Nothing was changed. To update, open the Sovrium app and use its own\n' +
          'update check — it replaces the app and this engine together, so the two\n' +
          'never end up on different versions.'
      )
    )
    return
  }

  const currentVersion = await getCurrentVersion()

  const pmCommand = packageManagerUpdateCommand(installMethod)
  if (pmCommand) {
    await runPackageManagerUpdate(pmCommand)
    return
  }

  if (installMethod === 'docker') {
    Effect.runSync(
      Console.log(
        'Sovrium is running in Docker — a container cannot replace its own image.\n\n' +
          'Pull the new image, then recreate the container:\n' +
          '  docker pull ghcr.io/sovrium/sovrium:latest'
      )
    )
    return
  }

  // installMethod === 'binary'
  if (process.platform === 'win32') {
    Effect.runSync(
      Console.log(
        'A running Windows executable cannot replace itself — nothing was updated.\n\n' +
          'Install via Scoop or Docker so the manager owns the swap, or download the new\n' +
          'binary from https://github.com/sovrium/sovrium/releases'
      )
    )
    return
  }

  if (isNetworkDisabled()) {
    Effect.runSync(
      Console.log(
        `Sovrium v${currentVersion} — network access is disabled, so nothing was checked.\n\n` +
          'Unset SOVRIUM_DISABLE_NETWORK to re-enable the update check.'
      )
    )
    return
  }

  printProgress('Checking for updates', 'times out after 3s')

  const latestVersion = await fetchLatestVersion()
  if (!latestVersion) {
    printFailure({
      headline: 'Could not reach the GitHub releases API. Nothing was replaced.',
      guidance:
        'Check your network, or download the release directly from\n' +
        '  https://github.com/sovrium/sovrium/releases',
    })
    // eslint-disable-next-line functional/no-expression-statements
    process.exit(1)
  }

  if (!isNewerVersion(currentVersion, latestVersion)) {
    Effect.runSync(Console.log(`Already on v${currentVersion} — that is the latest release.`))
    return
  }

  await downloadAndReplace(latestVersion, currentVersion)
}

/**
 * Verify SHA256 checksum of a downloaded archive against the published checksum file.
 * Best-effort: logs warning and continues if checksum file is unavailable.
 * Aborts with exit(1) if checksum mismatches.
 */
const verifyChecksum = async (
  archiveBuffer: Buffer,
  version: string,
  target: string
): Promise<boolean> => {
  const checksumFile = `sovrium-${version}-${target}.sha256`
  const checksumUrl = `https://github.com/${GITHUB_REPO}/releases/download/v${version}/${checksumFile}`
  try {
    const checksumResponse = await fetch(checksumUrl)
    if (checksumResponse.ok) {
      const checksumText = await checksumResponse.text()
      const expectedHash = checksumText.trim().split(/\s+/)[0]
      const hasher = new Bun.CryptoHasher('sha256')
      // eslint-disable-next-line functional/no-expression-statements
      hasher.update(archiveBuffer)
      const actualHash = hasher.digest('hex')
      if (actualHash !== expectedHash) {
        printFailure({
          headline: 'Checksum does not match the published sha256. Nothing was replaced.',
          detail: [`Expected ${expectedHash}`, `Got      ${actualHash}`],
          guidance:
            "The download may be corrupt. Re-run 'sovrium update'; if it fails again,\n" +
            '  report it at https://github.com/sovrium/sovrium/issues',
        })
        // eslint-disable-next-line functional/no-expression-statements
        process.exit(1)
      }
      return true
    }
    return false
  } catch {
    return false
  }
}

/**
 * Download a new binary version and replace the current one.
 */
const downloadAndReplace = async (version: string, currentVersion: string): Promise<void> => {
  const os = process.platform === 'darwin' ? 'darwin' : 'linux'
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64'
  const target = `${os}-${arch}`
  const archive = `sovrium-${version}-${target}.tar.gz`
  const url = `https://github.com/${GITHUB_REPO}/releases/download/v${version}/${archive}`

  const tempDir = join(tmpdir(), `sovrium-update-${Date.now()}`)
  // eslint-disable-next-line functional/no-expression-statements
  await mkdir(tempDir, { recursive: true })

  const response = await fetch(url)
  if (!response.ok) {
    printFailure({
      headline: `Download failed with HTTP ${response.status}. Nothing was replaced.`,
      detail: [url],
      guidance:
        `Release v${version} may have no ${target} build. See\n` +
        '  https://github.com/sovrium/sovrium/releases',
    })
    // eslint-disable-next-line functional/no-expression-statements
    process.exit(1)
  }

  // The size is announced only once `content-length` has made it knowable (T20).
  // A faked estimate is worse than none, so an absent header simply omits it.
  const declaredSize = Number(response.headers.get('content-length'))

  printProgress(
    `Downloading ${archive}`,
    Number.isFinite(declaredSize) && declaredSize > 0 ? formatBytes(declaredSize) : undefined
  )

  const archiveBuffer = Buffer.from(await response.arrayBuffer())

  printProgress('Verifying the checksum')
  const checksumVerified = await verifyChecksum(archiveBuffer, version, target)

  printProgress('Extracting')
  try {
    // `Bun.Archive` un-gzips and untars in-process, so a self-update no longer
    // needs a `tar` binary on PATH — an assumption that holds on a typical Linux
    // host but not on Windows or in a minimal image. The bytes are already in
    // memory for the checksum above, so the archive never round-trips to disk.
    // eslint-disable-next-line functional/no-expression-statements
    await new Bun.Archive(archiveBuffer).extract(tempDir)
  } catch (error) {
    printFailure({
      headline: `Could not extract ${archive}. Nothing was replaced.`,
      detail: [error instanceof Error ? error.message : String(error)],
      guidance: `Retry the update — the download may be truncated or corrupt. If it persists, check that ${tempDir} is writable.`,
    })
    // eslint-disable-next-line functional/no-expression-statements
    process.exit(1)
  }

  const newBinary = join(tempDir, 'sovrium')
  const currentBinary = process.execPath

  await chmod(newBinary, 0o755)

  if (os === 'darwin') {
    // eslint-disable-next-line functional/no-expression-statements
    Bun.spawnSync(['xattr', '-d', 'com.apple.quarantine', newBinary])
  }

  try {
    await rename(newBinary, currentBinary)
  } catch {
    await copyFile(newBinary, currentBinary)
    await chmod(currentBinary, 0o755)
  }

  // No `→` line: the replaced path is already named in a ✓ phase, and a locator
  // must not be invented just to fill the slot (T10).

  printDocument([
    [{ text: `Sovrium v${version}` }],
    checksumVerified
      ? []
      : [{ glyph: 'warn' as const, text: 'Checksum unavailable — installed without verification' }],
    [
      { glyph: 'ok' as const, text: `Downloaded ${archive}` },
      ...(checksumVerified ? [{ glyph: 'ok' as const, text: 'Checksum verified' }] : []),
      { glyph: 'ok' as const, text: `Replaced ${currentBinary}` },
    ],
    [{ text: `Updated from v${currentVersion} to v${version}.` }],
  ])
}

/**
 * Get the current version (compile-time define or package.json fallback).
 */
// eslint-disable-next-line @typescript-eslint/naming-convention -- build-time define constant
declare const __SOVRIUM_VERSION__: string | undefined

export const getCurrentVersion = async (): Promise<string> =>
  typeof __SOVRIUM_VERSION__ !== 'undefined'
    ? __SOVRIUM_VERSION__
    : (
        (await Bun.file(new URL('../../../package.json', import.meta.url)).json()) as {
          version: string
        }
      ).version

/**
 * Whether a startup version notice is worth printing for this install.
 *
 * True only where `sovrium update` would actually do something: `binary`
 * (self-replace) and the two package managers it can drive. The excluded pair
 * are excluded for the same reason and it is not "they cannot update" —
 * `docker` updates out of band, `desktop` updates through the app's own
 * updater. A notice telling either of them to run a command that will decline
 * is worse than silence, because it teaches its reader to ignore notices.
 *
 * A named predicate rather than an inline condition so the table can be pinned
 * by a test: adding a member to {@link InstallMethod} must be a deliberate
 * decision about the nag, not an omission nobody sees for a release.
 */
export const isUpdateNoticeEligible = (method: InstallMethod): boolean =>
  method === 'binary' || method === 'homebrew' || method === 'scoop'

/**
 * Non-blocking background version check on startup.
 * Prints a one-line notice if a newer version is available.
 * Checks at most once every 24 hours.
 *
 * Runs for self-updatable installs only — see {@link isUpdateNoticeEligible}.
 */
export const checkForUpdatesInBackground = (currentVersion: string): void => {
  if (!isUpdateNoticeEligible(detectInstallMethod())) return
  if (isNetworkDisabled()) return

  try {
    if (existsSync(UPDATE_CHECK_FILE)) {
      const lastCheck = Number(readFileSync(UPDATE_CHECK_FILE, 'utf8').trim())
      if (Date.now() - lastCheck < UPDATE_CHECK_INTERVAL_MS) return
    }
  } catch {
    // Ignore errors reading the check file
  }

  void (async () => {
    try {
      const latest = await fetchLatestVersion()
      if (!latest || !isNewerVersion(currentVersion, latest)) return

      const sovriumDir = dirname(UPDATE_CHECK_FILE)
      // eslint-disable-next-line functional/no-expression-statements
      await mkdir(sovriumDir, { recursive: true })
      await writeFile(UPDATE_CHECK_FILE, String(Date.now()))

      console.log(
        `\n  A new version of Sovrium is available: v${latest} (current: v${currentVersion}).` +
          `\n  Run 'sovrium update' to upgrade.\n`
      )
    } catch {
      // Silent failure — update checks must never break the server
    }
  })()
}
