#!/usr/bin/env bun
/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { existsSync, readFileSync } from 'node:fs'
import { chmod, copyFile, mkdir, rename, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { Effect, Console } from 'effect'
import { withFetchTimeout } from '@/infrastructure/utils/with-fetch-timeout'

const GITHUB_REPO = 'sovrium/sovrium'
const GITHUB_API_HOST_DEFAULT = 'api.github.com'
const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000
const UPDATE_CHECK_FILE = join(homedir(), '.sovrium', 'last-update-check')

export type InstallMethod = 'binary' | 'npm' | 'homebrew' | 'docker' | 'scoop'

const INSTALL_METHODS = ['binary', 'npm', 'homebrew', 'docker', 'scoop'] as const

const isInstallMethod = (value: string | undefined): value is InstallMethod =>
  value !== undefined && (INSTALL_METHODS as readonly string[]).includes(value)

const isNetworkDisabled = (): boolean => process.env.SOVRIUM_DISABLE_NETWORK === '1'

const githubApiHost = (): string => process.env.SOVRIUM_UPDATE_API_HOST || GITHUB_API_HOST_DEFAULT

export const detectInstallMethod = (): InstallMethod => {
  const override = process.env.SOVRIUM_INSTALL_METHOD
  if (isInstallMethod(override)) return override

  if (existsSync('/.dockerenv')) return 'docker'
  if (process.env.HOMEBREW_PREFIX) return 'homebrew'

  const execPathNormalized = process.execPath.replace(/\\/g, '/').toLowerCase()
  if (execPathNormalized.includes('/scoop/apps/sovrium/')) return 'scoop'

  if (process.execPath.includes('node_modules') || process.execPath.includes('.bun')) return 'npm'
  return 'binary'
}

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

const isNewerVersion = (current: string, latest: string): boolean => {
  const [aMaj = 0, aMin = 0, aPat = 0] = current.split('.').map(Number)
  const [bMaj = 0, bMin = 0, bPat = 0] = latest.split('.').map(Number)
  if (bMaj !== aMaj) return bMaj > aMaj
  if (bMin !== aMin) return bMin > aMin
  return bPat > aPat
}

const packageManagerUpdateCommand = (method: InstallMethod): readonly string[] | undefined => {
  if (method === 'homebrew') return ['brew', 'upgrade', 'sovrium/tap/sovrium']
  if (method === 'scoop') return ['powershell', '-NoProfile', '-Command', 'scoop update sovrium']
  return undefined
}

const runPackageManagerUpdate = async (command: readonly string[]): Promise<void> => {
  const display = command.join(' ')

  if (process.env.SOVRIUM_UPDATE_DRY_RUN === '1') {
    Effect.runSync(Console.log(`would run: ${display}`))
    return
  }

  Effect.runSync(Console.log(`Updating via your package manager:\n  ${display}\n`))
  const proc = Bun.spawn([...command], { stdout: 'inherit', stderr: 'inherit', stdin: 'inherit' })
  const exitCode = await proc.exited
  if (exitCode !== 0) {
    Effect.runSync(Console.error(`\nUpdate command exited with code ${exitCode}.`))
    process.exit(exitCode)
  }
}

export interface UpdateCommandOptions {
  readonly helpRequested?: boolean
}

const UPDATE_HELP_TEXT = [
  'Sovrium CLI — update to the latest version',
  '',
  'Usage:',
  '  sovrium update                            Update Sovrium to the latest version',
  '',
  'Behavior depends on how Sovrium was installed:',
  '  binary                                    Self-replace from GitHub Releases (Unix)',
  '  homebrew                                  Delegates to `brew upgrade sovrium/tap/sovrium`',
  '  scoop                                     Delegates to `scoop update sovrium`',
  '  docker                                    Prints `docker pull` instruction',
  '  npm                                       Prints deprecation notice (npm is retired)',
  '',
  'Options:',
  '  --help, -h                                Show this help message',
  '',
  'Environment variables (advanced / test seams):',
  '  SOVRIUM_INSTALL_METHOD                    Force the detected install method',
  '  SOVRIUM_DISABLE_NETWORK                   Skip all network calls (offline)',
  '  SOVRIUM_UPDATE_API_HOST                   Override the GitHub API host',
  '  SOVRIUM_UPDATE_DRY_RUN                    Print package-manager command instead of running',
].join('\n')

const showUpdateHelp = (): void => {
  Effect.runSync(Console.log(UPDATE_HELP_TEXT))
}

export const handleUpdateCommand = async (
  options?: Readonly<UpdateCommandOptions>
): Promise<void> => {
  if (options?.helpRequested) {
    showUpdateHelp()
    return
  }

  const installMethod = detectInstallMethod()
  const currentVersion = await getCurrentVersion()
  Effect.runSync(Console.log(`Current version: ${currentVersion}`))

  const pmCommand = packageManagerUpdateCommand(installMethod)
  if (pmCommand) {
    await runPackageManagerUpdate(pmCommand)
    return
  }

  if (installMethod === 'npm') {
    Effect.runSync(
      Console.log(
        'The sovrium npm package is deprecated.\n' +
          'Switch to the standalone binary for automatic updates:\n' +
          '  curl -fsSL https://sovrium.com/install | sh\n\n' +
          'Source code: https://github.com/sovrium/sovrium'
      )
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

  if (process.platform === 'win32') {
    Effect.runSync(
      Console.log(
        'Self-update of a raw Windows binary is not supported.\n' +
          '  Install via Scoop (scoop update sovrium) or Docker, or re-download from\n' +
          '  https://github.com/sovrium/sovrium/releases'
      )
    )
    return
  }

  if (isNetworkDisabled()) {
    Effect.runSync(
      Console.log('Network access is disabled (SOVRIUM_DISABLE_NETWORK). Skipping update check.')
    )
    return
  }

  Effect.runSync(Console.log('Checking for updates...'))

  const latestVersion = await fetchLatestVersion()
  if (!latestVersion) {
    Effect.runSync(Console.error('Could not check for updates. Please try again later.'))
    process.exit(1)
  }

  if (!isNewerVersion(currentVersion, latestVersion)) {
    Effect.runSync(Console.log(`Already up to date (v${currentVersion}).`))
    return
  }

  await downloadAndReplace(latestVersion)
}

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
      hasher.update(archiveBuffer)
      const actualHash = hasher.digest('hex')
      if (actualHash !== expectedHash) {
        Effect.runSync(Console.error('Checksum verification failed! Aborting update.'))
        Effect.runSync(Console.error(`  Expected: ${expectedHash}`))
        Effect.runSync(Console.error(`  Got:      ${actualHash}`))
        process.exit(1)
      }
      Effect.runSync(Console.log('Checksum verified ✓'))
    }
  } catch {
    Effect.runSync(Console.log('Checksum not available, skipping verification'))
  }
}

const downloadAndReplace = async (version: string): Promise<void> => {
  Effect.runSync(Console.log(`New version available: ${version}`))

  const os = process.platform === 'darwin' ? 'darwin' : 'linux'
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64'
  const target = `${os}-${arch}`
  const archive = `sovrium-${version}-${target}.tar.gz`
  const url = `https://github.com/${GITHUB_REPO}/releases/download/v${version}/${archive}`

  Effect.runSync(Console.log(`Downloading ${archive}...`))

  const tempDir = join(tmpdir(), `sovrium-update-${Date.now()}`)
  await mkdir(tempDir, { recursive: true })

  const archivePath = join(tempDir, archive)
  const response = await fetch(url)
  if (!response.ok) {
    Effect.runSync(Console.error(`Download failed (HTTP ${response.status}). URL: ${url}`))
    process.exit(1)
  }

  const archiveBuffer = Buffer.from(await response.arrayBuffer())
  await writeFile(archivePath, archiveBuffer)
  await verifyChecksum(archiveBuffer, version, target)

  Effect.runSync(Console.log('Extracting...'))
  const tar = Bun.spawnSync(['tar', 'xzf', archivePath, '-C', tempDir])
  if (tar.exitCode !== 0) {
    Effect.runSync(Console.error('Failed to extract archive.'))
    process.exit(1)
  }

  const newBinary = join(tempDir, 'sovrium')
  const currentBinary = process.execPath

  await chmod(newBinary, 0o755)

  if (os === 'darwin') {
    Bun.spawnSync(['xattr', '-d', 'com.apple.quarantine', newBinary])
  }

  try {
    await rename(newBinary, currentBinary)
  } catch {
    await copyFile(newBinary, currentBinary)
    await chmod(currentBinary, 0o755)
  }

  Effect.runSync(Console.log(`\nUpdated to v${version} successfully.`))
}

declare const __SOVRIUM_VERSION__: string | undefined

export const getCurrentVersion = async (): Promise<string> =>
  typeof __SOVRIUM_VERSION__ !== 'undefined'
    ? __SOVRIUM_VERSION__
    : (
        (await Bun.file(new URL('../../package.json', import.meta.url)).json()) as {
          version: string
        }
      ).version

export const checkForUpdatesInBackground = (currentVersion: string): void => {
  const method = detectInstallMethod()
  if (method !== 'binary' && method !== 'homebrew' && method !== 'scoop') return
  if (isNetworkDisabled()) return

  try {
    if (existsSync(UPDATE_CHECK_FILE)) {
      const lastCheck = Number(readFileSync(UPDATE_CHECK_FILE, 'utf8').trim())
      if (Date.now() - lastCheck < UPDATE_CHECK_INTERVAL_MS) return
    }
  } catch {
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
    }
  })()
}
