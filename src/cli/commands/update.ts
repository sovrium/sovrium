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
 * - `SOVRIUM_UPDATE_DOWNLOAD_HOST`  override the release-asset host (default github.com)
 * - `SOVRIUM_UPDATE_INSTALL_PATH`   replace this file instead of the running executable
 * - `SOVRIUM_UPDATE_DRY_RUN`   print the package-manager command instead of running it
 */

import { existsSync, readFileSync } from 'node:fs'
import { chmod, copyFile, mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { Effect, Console } from 'effect'
import {
  CHECKSUM_GUIDANCE,
  UNVERIFIED_NOTE,
  announceSkippedChecksum,
  isTrustedFinalUrl,
  originFor,
  releaseAssetUrl,
  verifyChecksum,
} from '@/cli/commands/update-verify'
import { UPDATE_HELP_TEXT } from '@/cli/runtime/command-help'
import { withFetchStallTimeout, withFetchTimeout } from '@/infrastructure/egress/with-fetch-timeout'
import {
  formatBytes,
  printDocument,
  printFailure,
  printProgress,
  type CliFailure,
} from '@/infrastructure/logging/cli-output'

const GITHUB_REPO = 'sovrium/sovrium'
const GITHUB_API_HOST_DEFAULT = 'api.github.com'
const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000 // 24 hours
const UPDATE_CHECK_FILE = join(homedir(), '.sovrium', 'last-update-check')

/**
 * How long a release download may go without progress before it is abandoned.
 *
 * An INACTIVITY deadline, not a total one: the archive is ~70 MB, which an
 * honest slow link takes minutes to deliver, while a peer that accepted the
 * connection and stopped sending would otherwise hold `sovrium update` forever.
 */
const DOWNLOAD_STALL_TIMEOUT_MS = 30_000

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
 * - Homebrew keeps a formula under `<prefix>/Cellar/sovrium/<version>/` and
 *   links `<prefix>/bin/sovrium` to it. Bun resolves symlinks when it computes
 *   `process.execPath` (on Linux, macOS and Windows alike), so the linked
 *   command still reports its Cellar path.
 * - Scoop installs under `…\scoop\apps\sovrium\current\…`.
 *
 * Separators and case are normalised first, for Windows paths and for
 * case-insensitive macOS volumes.
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

  const execPathNormalized = probe.execPath.replace(/\\/g, '/').toLowerCase()
  if (execPathNormalized.includes('/cellar/sovrium/')) return 'homebrew'
  if (execPathNormalized.includes('/scoop/apps/sovrium/')) return 'scoop'

  return 'binary'
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
 * Fetch the latest release version from GitHub.
 * Returns undefined on any error (timeout, network, disabled, etc.)
 */
const fetchLatestVersion = async (): Promise<string | undefined> => {
  if (isNetworkDisabled()) return undefined
  try {
    const response = await withFetchTimeout(
      `${originFor(githubApiHost())}/repos/${GITHUB_REPO}/releases/latest`,
      { redirect: 'follow' },
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
  /** `--insecure-skip-checksum`: install without verifying the published sha256. */
  readonly insecureSkipChecksum?: boolean
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
    process.exit(1)
  }

  if (!isNewerVersion(currentVersion, latestVersion)) {
    Effect.runSync(Console.log(`Already on v${currentVersion} — that is the latest release.`))
    return
  }

  await downloadAndReplace(latestVersion, currentVersion, options?.insecureSkipChecksum === true)
}

/** A finished download, or why it failed and what the operator can do about it. */
type DownloadOutcome =
  | { readonly kind: 'downloaded'; readonly buffer: Buffer }
  | { readonly kind: 'failed'; readonly failed: string; readonly guidance: string }

/**
 * Download the release archive, or stop with a failure that names why.
 *
 * Every failure here happens before anything is replaced, and says so. The
 * download aborts when it makes no progress for {@link DOWNLOAD_STALL_TIMEOUT_MS}.
 */
const downloadArchive = async (
  url: string,
  archive: string,
  version: string,
  target: string
): Promise<Buffer> => {
  const outcome: DownloadOutcome = await withFetchStallTimeout<DownloadOutcome>(
    url,
    {},
    DOWNLOAD_STALL_TIMEOUT_MS,
    async (response) => {
      if (!response.ok) {
        return {
          kind: 'failed',
          failed: `Download failed with HTTP ${response.status}.`,
          guidance:
            `Release v${version} may have no ${target} build. See\n` +
            '  https://github.com/sovrium/sovrium/releases',
        }
      }
      if (!isTrustedFinalUrl(response.url || url)) {
        return {
          kind: 'failed',
          failed: 'Download was redirected to a non-HTTPS location.',
          guidance: CHECKSUM_GUIDANCE,
        }
      }
      // The size is announced only once `content-length` has made it knowable (T20).
      // A faked estimate is worse than none, so an absent header simply omits it.
      const declaredSize = Number(response.headers.get('content-length'))
      printProgress(
        `Downloading ${archive}`,
        Number.isFinite(declaredSize) && declaredSize > 0 ? formatBytes(declaredSize) : undefined
      )
      return { kind: 'downloaded', buffer: Buffer.from(await response.arrayBuffer()) }
    }
  ).catch((error: unknown): DownloadOutcome => ({
    kind: 'failed',
    failed:
      error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')
        ? `Download stalled: no data for ${DOWNLOAD_STALL_TIMEOUT_MS / 1000} s.`
        : `Download failed: ${error instanceof Error ? error.message : String(error)}.`,
    guidance: "Check the network connection, then re-run 'sovrium update'.",
  }))
  if (outcome.kind === 'downloaded') return outcome.buffer

  printFailure({
    headline: `${outcome.failed} Nothing was replaced.`,
    detail: [url],
    guidance: outcome.guidance,
  })
  process.exit(1)
}

/**
 * Delete a file or directory, ignoring every failure.
 *
 * Only for leftovers of this command — a staged binary or the extraction
 * directory. Neither is worth failing an update over, and neither holds
 * anything the operator could act on.
 */
const removeQuietly = (path: string): Promise<void> =>
  rm(path, { recursive: true, force: true }).catch(() => undefined)

/**
 * Where the new binary is staged before it takes the current one's place.
 *
 * In the SAME directory as the current binary, so the final step is a
 * `rename` within one filesystem — atomic, and never an in-place write over
 * the running executable (which macOS can answer by killing a signed binary on
 * its next launch). Dot-prefixed so a half-finished update does not show up as
 * a second command on PATH.
 */
export const stagingPathFor = (currentBinary: string, stamp: string): string =>
  join(dirname(currentBinary), `.sovrium-update-${stamp}`)

/**
 * Put the extracted binary in place of the current one.
 *
 * Copies it next to the current binary, makes it executable, lets `prepare`
 * touch the staged file (macOS clears its quarantine flag there), then renames
 * it over the current binary. Resolves to `undefined` once the new binary is
 * in place, or to the error that stopped it — in which case the staged copy has
 * been removed and the current binary is exactly as it was.
 */
export const replaceBinary = async (
  newBinary: string,
  currentBinary: string,
  stamp: string,
  prepare: (staged: string) => void = () => undefined
): Promise<unknown> => {
  const staged = stagingPathFor(currentBinary, stamp)
  const failure: unknown = await copyFile(newBinary, staged)
    .then(() => chmod(staged, 0o755))
    .then(() => prepare(staged))
    .then(() => rename(staged, currentBinary))
    .then(
      () => undefined,
      (error: unknown) => error ?? new Error('The binary could not be replaced.')
    )
  if (failure !== undefined) await removeQuietly(staged)
  return failure
}

/**
 * Why the new binary could not be put in place, worded for `printFailure`.
 *
 * A permission error gets its own answer because it is the common case — a
 * binary installed with `sudo` into a system directory — and the fix is a
 * command the operator can run, not a retry.
 */
export const replaceFailure = (error: unknown, currentBinary: string): CliFailure => {
  const code =
    typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined
  if (code === 'EACCES' || code === 'EPERM') {
    return {
      headline: `Cannot write to ${dirname(currentBinary)}. Nothing was replaced.`,
      detail: [`${currentBinary} is in a directory this user cannot write to.`],
      guidance:
        "Re-run it as the owner of that directory, for example 'sudo sovrium update',\n" +
        '  or reinstall into a directory you own: curl -fsSL https://sovrium.com/install | sh',
    }
  }
  return {
    headline: `Could not replace ${currentBinary}. Nothing was replaced.`,
    detail: [error instanceof Error ? error.message : String(error)],
    guidance: "Fix the problem above, then re-run 'sovrium update'.",
  }
}

/**
 * Download a new binary version and replace the current one.
 */
const downloadAndReplace = async (
  version: string,
  currentVersion: string,
  insecureSkipChecksum: boolean
): Promise<void> => {
  const os = process.platform === 'darwin' ? 'darwin' : 'linux'
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64'
  const target = `${os}-${arch}`
  const archive = `sovrium-${version}-${target}.tar.gz`
  const url = releaseAssetUrl(version, archive)
  if (insecureSkipChecksum) announceSkippedChecksum()

  const archiveBuffer = await downloadArchive(url, archive, version, target)

  // Verified before the extraction directory exists: a refusal exits from
  // inside `verifyChecksum`, and would otherwise leave the directory behind.
  if (!insecureSkipChecksum) printProgress('Verifying the checksum')
  const checksumVerified = await verifyChecksum(archiveBuffer, {
    checksumUrl: releaseAssetUrl(version, `sovrium-${version}-${target}.sha256`),
    stallTimeoutMs: DOWNLOAD_STALL_TIMEOUT_MS,
    insecureSkipChecksum,
  })

  const stamp = `${Date.now()}`
  const tempDir = join(tmpdir(), `sovrium-update-${stamp}`)
  await mkdir(tempDir, { recursive: true })

  printProgress('Extracting')
  try {
    // `Bun.Archive` un-gzips and untars in-process, so a self-update no longer
    // needs a `tar` binary on PATH — an assumption that holds on a typical Linux
    // host but not on Windows or in a minimal image. The bytes are already in
    // memory for the checksum above, so the archive never round-trips to disk.
    await new Bun.Archive(archiveBuffer).extract(tempDir)
  } catch (error) {
    await removeQuietly(tempDir)
    printFailure({
      headline: `Could not extract ${archive}. Nothing was replaced.`,
      detail: [error instanceof Error ? error.message : String(error)],
      guidance: `Retry the update — the download may be truncated or corrupt. If it persists, check that ${tmpdir()} is writable.`,
    })
    process.exit(1)
  }

  const currentBinary = process.env.SOVRIUM_UPDATE_INSTALL_PATH || process.execPath
  const failure = await replaceBinary(join(tempDir, 'sovrium'), currentBinary, stamp, (staged) => {
    if (os === 'darwin') {
      Bun.spawnSync(['xattr', '-d', 'com.apple.quarantine', staged])
    }
  })
  await removeQuietly(tempDir)
  if (failure !== undefined) {
    printFailure(replaceFailure(failure, currentBinary))
    process.exit(1)
  }

  // No `→` line: the replaced path is already named in a ✓ phase, and a locator
  // must not be invented just to fill the slot (T10).

  printDocument([
    [{ text: `Sovrium v${version}` }],
    checksumVerified ? [] : [{ glyph: 'warn' as const, text: UNVERIFIED_NOTE }],
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
