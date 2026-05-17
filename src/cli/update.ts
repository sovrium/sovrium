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
 * - Self-updating the binary (download + atomic replace)
 * - Non-blocking background version check on startup
 */

/* eslint-disable max-statements -- imperative CLI command handlers */

import { existsSync, readFileSync } from 'node:fs'
import { chmod, copyFile, mkdir, rename, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { Effect, Console } from 'effect'
import { withFetchTimeout } from '@/infrastructure/utils/with-fetch-timeout'

const GITHUB_REPO = 'sovrium/sovrium'
const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000 // 24 hours
const UPDATE_CHECK_FILE = join(homedir(), '.sovrium', 'last-update-check')

/**
 * Detect how Sovrium was installed to provide appropriate upgrade instructions.
 */
export const detectInstallMethod = (): 'binary' | 'npm' | 'homebrew' | 'docker' => {
  if (existsSync('/.dockerenv')) return 'docker'
  if (process.env.HOMEBREW_PREFIX) return 'homebrew'
  if (process.execPath.includes('node_modules') || process.execPath.includes('.bun')) return 'npm'
  return 'binary'
}

/**
 * Fetch the latest release version from GitHub.
 * Returns undefined on any error (timeout, network, etc.)
 */
const fetchLatestVersion = async (): Promise<string | undefined> => {
  try {
    const response = await withFetchTimeout(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
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
 * Handle the 'update' command — self-update the binary from GitHub Releases.
 */
export const handleUpdateCommand = async (): Promise<void> => {
  const installMethod = detectInstallMethod()

  if (installMethod === 'npm') {
    Effect.runSync(
      Console.log(
        'The sovrium npm package is deprecated.\n' +
          'Switch to the standalone binary for automatic updates:\n' +
          '  curl -fsSL https://raw.githubusercontent.com/sovrium/sovrium/main/scripts/install.sh | sh\n\n' +
          'Source code: https://github.com/sovrium/sovrium'
      )
    )
    return
  }
  if (installMethod === 'homebrew') {
    Effect.runSync(
      Console.log('Sovrium was installed via Homebrew. Update with:\n  brew upgrade sovrium')
    )
    return
  }
  if (installMethod === 'docker') {
    Effect.runSync(
      Console.log(
        'Sovrium is running in Docker. Update with:\n  docker pull ghcr.io/sovrium/sovrium:latest'
      )
    )
    return
  }

  const currentVersion = await getCurrentVersion()
  Effect.runSync(Console.log(`Current version: ${currentVersion}`))
  Effect.runSync(Console.log('Checking for updates...'))

  const latestVersion = await fetchLatestVersion()
  if (!latestVersion) {
    Effect.runSync(Console.error('Could not check for updates. Please try again later.'))
    // eslint-disable-next-line functional/no-expression-statements
    process.exit(1)
  }

  if (!isNewerVersion(currentVersion, latestVersion)) {
    Effect.runSync(Console.log(`Already up to date (v${currentVersion}).`))
    return
  }

  // eslint-disable-next-line functional/no-expression-statements
  await downloadAndReplace(latestVersion)
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
): Promise<void> => {
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
        Effect.runSync(Console.error('Checksum verification failed! Aborting update.'))
        Effect.runSync(Console.error(`  Expected: ${expectedHash}`))
        Effect.runSync(Console.error(`  Got:      ${actualHash}`))
        // eslint-disable-next-line functional/no-expression-statements
        process.exit(1)
      }
      Effect.runSync(Console.log('Checksum verified ✓'))
    }
  } catch {
    Effect.runSync(Console.log('Checksum not available, skipping verification'))
  }
}

/**
 * Download a new binary version and replace the current one.
 */
const downloadAndReplace = async (version: string): Promise<void> => {
  Effect.runSync(Console.log(`New version available: ${version}`))

  const os = process.platform === 'darwin' ? 'darwin' : 'linux'
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64'
  const target = `${os}-${arch}`
  const archive = `sovrium-${version}-${target}.tar.gz`
  const url = `https://github.com/${GITHUB_REPO}/releases/download/v${version}/${archive}`

  Effect.runSync(Console.log(`Downloading ${archive}...`))

  const tempDir = join(tmpdir(), `sovrium-update-${Date.now()}`)
  // eslint-disable-next-line functional/no-expression-statements
  await mkdir(tempDir, { recursive: true })

  const archivePath = join(tempDir, archive)
  const response = await fetch(url)
  if (!response.ok) {
    Effect.runSync(Console.error(`Download failed (HTTP ${response.status}). URL: ${url}`))
    // eslint-disable-next-line functional/no-expression-statements
    process.exit(1)
  }

  const archiveBuffer = Buffer.from(await response.arrayBuffer())
  // eslint-disable-next-line functional/no-expression-statements
  await writeFile(archivePath, archiveBuffer)
  // eslint-disable-next-line functional/no-expression-statements
  await verifyChecksum(archiveBuffer, version, target)

  Effect.runSync(Console.log('Extracting...'))
  const tar = Bun.spawnSync(['tar', 'xzf', archivePath, '-C', tempDir])
  if (tar.exitCode !== 0) {
    Effect.runSync(Console.error('Failed to extract archive.'))
    // eslint-disable-next-line functional/no-expression-statements
    process.exit(1)
  }

  const newBinary = join(tempDir, 'sovrium')
  const currentBinary = process.execPath

  // eslint-disable-next-line functional/no-expression-statements
  await chmod(newBinary, 0o755)

  if (os === 'darwin') {
    // eslint-disable-next-line functional/no-expression-statements
    Bun.spawnSync(['xattr', '-d', 'com.apple.quarantine', newBinary])
  }

  try {
    // eslint-disable-next-line functional/no-expression-statements
    await rename(newBinary, currentBinary)
  } catch {
    // eslint-disable-next-line functional/no-expression-statements
    await copyFile(newBinary, currentBinary)
    // eslint-disable-next-line functional/no-expression-statements
    await chmod(currentBinary, 0o755)
  }

  Effect.runSync(Console.log(`\nUpdated to v${version} successfully.`))
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
        (await Bun.file(new URL('../../package.json', import.meta.url)).json()) as {
          version: string
        }
      ).version

/**
 * Non-blocking background version check on startup.
 * Prints a one-line notice if a newer version is available.
 * Checks at most once every 24 hours.
 */
export const checkForUpdatesInBackground = (currentVersion: string): void => {
  if (detectInstallMethod() !== 'binary') return

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
      // eslint-disable-next-line functional/no-expression-statements
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
