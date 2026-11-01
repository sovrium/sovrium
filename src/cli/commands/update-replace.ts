/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The self-replace half of `sovrium update` for a raw binary: download the
 * release archive, verify it, and swap it in place of the running binary.
 */

import { chmod, copyFile, mkdir, rename, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import {
  CHECKSUM_GUIDANCE,
  UNVERIFIED_NOTE,
  VERIFIED_LINES,
  announceSkippedChecksum,
  verifyRelease,
} from '@/cli/commands/update-verify'
import { refuseCommand } from '@/cli/runtime/run-command'
import {
  RELEASE_DOWNLOAD_STALL_TIMEOUT_MS,
  isTrustedFinalUrl,
} from '@/domain/kernel/identity/release-signature'
import { releaseAssetUrl } from '@/domain/models/process-env/release-download'
import { withFetchStallTimeout } from '@/infrastructure/egress/with-fetch-timeout'
import {
  formatBytes,
  printDocument,
  printProgress,
  type CliFailure,
} from '@/infrastructure/logging/cli-output'

/** How long a release download may go without progress; shared with `instance/engineInstall`. */
const DOWNLOAD_STALL_TIMEOUT_MS = RELEASE_DOWNLOAD_STALL_TIMEOUT_MS

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

  return refuseCommand({
    headline: `${outcome.failed} Nothing was replaced.`,
    detail: [url],
    guidance: outcome.guidance,
  })
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

/** Unpack the verified archive into a fresh directory; a failure removes it and refuses. */
const extractArchive = async (
  archiveBuffer: Buffer,
  archive: string,
  tempDir: string
): Promise<void> => {
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
    return refuseCommand({
      headline: `Could not extract ${archive}. Nothing was replaced.`,
      detail: [error instanceof Error ? error.message : String(error)],
      guidance: `Retry the update — the download may be truncated or corrupt. If it persists, check that ${tmpdir()} is writable.`,
    })
  }
}

/** Swap the extracted binary in for the running one, clearing macOS quarantine on the way. */
const installExtracted = async (tempDir: string, stamp: string): Promise<string> => {
  const currentBinary = process.env.SOVRIUM_UPDATE_INSTALL_PATH || process.execPath
  const failure = await replaceBinary(join(tempDir, 'sovrium'), currentBinary, stamp, (staged) => {
    if (process.platform === 'darwin') {
      Bun.spawnSync(['xattr', '-d', 'com.apple.quarantine', staged])
    }
  })
  await removeQuietly(tempDir)
  if (failure !== undefined) {
    return refuseCommand(replaceFailure(failure, currentBinary))
  }
  return currentBinary
}

/**
 * Download a new binary version and replace the current one.
 */
export const downloadAndReplace = async (
  version: string,
  currentVersion: string,
  insecureSkipChecksum: boolean
): Promise<void> => {
  const os = process.platform === 'darwin' ? 'darwin' : 'linux'
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64'
  const target = `${os}-${arch}`
  const archive = `sovrium-${version}-${target}.tar.gz`
  const url = releaseAssetUrl(version, archive, process.env)
  if (insecureSkipChecksum) announceSkippedChecksum()

  const archiveBuffer = await downloadArchive(url, archive, version, target)

  // Verified before the extraction directory exists: a refusal exits from
  // inside `verifyRelease`, and would otherwise leave the directory behind.
  const verified = await verifyRelease(archiveBuffer, {
    archiveUrl: url,
    stallTimeoutMs: DOWNLOAD_STALL_TIMEOUT_MS,
    insecureSkipChecksum,
  })

  const stamp = `${Date.now()}`
  const tempDir = join(tmpdir(), `sovrium-update-${stamp}`)
  await extractArchive(archiveBuffer, archive, tempDir)
  const currentBinary = await installExtracted(tempDir, stamp)

  // No `→` line: the replaced path is already named in a ✓ phase, and a locator
  // must not be invented just to fill the slot (T10).

  printDocument([
    [{ text: `Sovrium v${version}` }],
    verified ? [] : [{ glyph: 'warn' as const, text: UNVERIFIED_NOTE }],
    [
      { glyph: 'ok' as const, text: `Downloaded ${archive}` },
      ...(verified ? VERIFIED_LINES : []),
      { glyph: 'ok' as const, text: `Replaced ${currentBinary}` },
    ],
    [{ text: `Updated from v${currentVersion} to v${version}.` }],
  ])
}
