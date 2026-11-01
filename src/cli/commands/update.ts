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
 * - `GH_TOKEN` / `GITHUB_TOKEN`  a token for the releases API (see `update-latest-version`)
 */

import { existsSync, readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import {
  detectInstallMethod,
  packageManagerUpdateCommand,
  runPackageManagerUpdate,
  type InstallMethod,
} from '@/cli/commands/update-install-method'
import { fetchLatestVersion, lookupFailure } from '@/cli/commands/update-latest-version'
import { downloadAndReplace } from '@/cli/commands/update-replace'
import { defineFlags, flag } from '@/cli/runtime/flag-schema'
import { refuseCommand, withFlagsAsync } from '@/cli/runtime/run-command'
import { UPDATE_HELP_TEXT } from '@/cli/runtime/update-help'
import { printLine, printProgress } from '@/infrastructure/logging/cli-output'

const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000 // 24 hours
const UPDATE_CHECK_FILE = join(homedir(), '.sovrium', 'last-update-check')

/** Whether all network access is disabled (offline / test mode). */
const isNetworkDisabled = (): boolean => process.env.SOVRIUM_DISABLE_NETWORK === '1'

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
  printLine(UPDATE_HELP_TEXT)
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
const runUpdateCommand = async (options?: Readonly<UpdateCommandOptions>): Promise<void> => {
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
    printLine(
      'Sovrium is running inside the Sovrium app, which keeps it up to date for you.\n\n' +
        'Nothing was changed. To update, open the Sovrium app and use its own\n' +
        'update check — it replaces the app and this engine together, so the two\n' +
        'never end up on different versions.'
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
    printLine(
      'Sovrium is running in Docker — a container cannot replace its own image.\n\n' +
        'Pull the new image, then recreate the container:\n' +
        '  docker pull ghcr.io/sovrium/sovrium:latest'
    )
    return
  }

  // installMethod === 'binary'
  if (process.platform === 'win32') {
    printLine(
      'A running Windows executable cannot replace itself — nothing was updated.\n\n' +
        'Install via Scoop or Docker so the manager owns the swap, or download the new\n' +
        'binary from https://github.com/sovrium/sovrium/releases'
    )
    return
  }

  if (isNetworkDisabled()) {
    printLine(
      `Sovrium v${currentVersion} — network access is disabled, so nothing was checked.\n\n` +
        'Unset SOVRIUM_DISABLE_NETWORK to re-enable the update check.'
    )
    return
  }

  printProgress('Checking for updates', 'times out after 3s')

  const lookup = await fetchLatestVersion()
  if (lookup.kind !== 'ok') {
    return refuseCommand(lookupFailure(lookup))
  }
  const latestVersion = lookup.version
  if (lookup.via === 'download') {
    printLine(`GitHub API rate limit reached — found v${latestVersion} via the latest release.`)
  }

  if (!isNewerVersion(currentVersion, latestVersion)) {
    printLine(`Already on v${currentVersion} — that is the latest release.`)
    return
  }

  await downloadAndReplace(latestVersion, currentVersion, options?.insecureSkipChecksum === true)
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
      const lookup = await fetchLatestVersion()
      if (lookup.kind !== 'ok' || !isNewerVersion(currentVersion, lookup.version)) return
      const latest = lookup.version

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

/** The flags `sovrium update` reads beyond the shared ones. */
export const updateFlags = defineFlags({
  insecureSkipChecksum: flag.switch('--insecure-skip-checksum'),
})

/** Handle `sovrium update`. */
export const handleUpdateCommand = withFlagsAsync(updateFlags, (args) =>
  runUpdateCommand({
    helpRequested: args.helpRequested ?? false,
    insecureSkipChecksum: args.flags.insecureSkipChecksum,
  })
)
