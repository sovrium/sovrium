/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { chmod, lstat, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { Effect } from 'effect'
import { InstanceSupervisorError } from '@/application/ports/services/instance-supervisor'
import {
  RELEASE_DOWNLOAD_STALL_TIMEOUT_MS,
  isSignedByTrustedKey,
  isTrustedFinalUrl,
  parsePublishedSha256,
  releaseTargetFor,
} from '@/domain/kernel/identity/release-signature'
import {
  releaseAssetUrl,
  releaseKeysFor,
  resolveReleaseDownloadHost,
} from '@/domain/models/process-env/release-download'
import { withFetchStallTimeout } from '@/infrastructure/egress/with-fetch-timeout'
import type { ProcessRunner } from '@/application/ports/services/process-runner'

/**
 * One Sovrium release, fetched and judged as `sovrium update` judges it: the
 * archive, its published `.sha256` and its detached `.tar.gz.sig`, all three
 * over HTTPS (or from a loopback stand-in) within the download stall timeout;
 * then the sha256, then the signature against the release keys the running
 * binary ships, then the version the unpacked binary reports. Every refusal
 * names the version and the check.
 */

type Runner = Effect.Success<typeof ProcessRunner>

/** How long `<binary> --version` may take. */
const VERSION_CHECK_TIMEOUT_MS = 30_000

export const engineError = (message: string, cause?: unknown) =>
  new InstanceSupervisorError({ message, ...(cause === undefined ? {} : { cause }) })

export const describe = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause)

/** A refusal while installing `version`: every message names it. */
export class EngineRefusal extends Error {}

/** The largest release archive accepted; a release binary is well under a tenth of it. */
const MAX_ARCHIVE_BYTES = 512 * 1024 * 1024

/** The largest `.sha256` or `.sig` accepted: each is one short line. */
const MAX_NOTE_BYTES = 64 * 1024

/** A body read whole, refused as soon as it passes `maxBytes`, announced or not. */
const readCapped = async (
  response: Response,
  maxBytes: number
): Promise<Uint8Array | undefined> => {
  if (Number(response.headers.get('content-length') ?? 0) > maxBytes) return undefined
  if (response.body === null) return new Uint8Array(0)
  const reader = response.body.getReader()
  let chunks: readonly Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined)
      return undefined
    }
    chunks = [...chunks, value]
  }
  const bytes = new Uint8Array(total)
  chunks.reduce((offset, chunk) => {
    bytes.set(chunk, offset)
    return offset + chunk.byteLength
  }, 0)
  return bytes
}

/**
 * One release asset, read whole within the download stall timeout and under
 * `maxBytes`, from a trusted final URL.
 */
const fetchAsset = async (url: string, version: string, maxBytes: number): Promise<Uint8Array> =>
  withFetchStallTimeout(url, {}, RELEASE_DOWNLOAD_STALL_TIMEOUT_MS, async (response) => {
    if (!response.ok) {
      throw new EngineRefusal(
        `instance: engine ${version}: could not download ${url}: HTTP ${String(response.status)}`
      )
    }
    if (!isTrustedFinalUrl(response.url || url)) {
      throw new EngineRefusal(
        `instance: engine ${version}: ${url} was redirected off HTTPS, to ${response.url}`
      )
    }
    const bytes = await readCapped(response, maxBytes)
    if (bytes === undefined) {
      throw new EngineRefusal(
        `instance: engine ${version}: ${url} is larger than ${String(maxBytes)} bytes`
      )
    }
    return bytes
  }).catch((cause: unknown) => {
    if (cause instanceof EngineRefusal) throw cause
    throw new EngineRefusal(
      `instance: engine ${version}: could not download ${url}: ${describe(cause)}`
    )
  })

const sha256Hex = (bytes: Uint8Array): string => {
  const hasher = new Bun.CryptoHasher('sha256')
  hasher.update(bytes)
  return hasher.digest('hex')
}

/** The three assets of a release, checked in order: sha256, then signature. */
export const downloadVerified = async (version: string): Promise<Uint8Array> => {
  const archiveName = `sovrium-${version}-${releaseTargetFor(process.platform, process.arch)}.tar.gz`
  const archiveUrl = releaseAssetUrl(version, archiveName)
  const [archive, checksum, signature] = await Promise.all([
    fetchAsset(archiveUrl, version, MAX_ARCHIVE_BYTES),
    fetchAsset(archiveUrl.replace(/\.tar\.gz$/, '.sha256'), version, MAX_NOTE_BYTES),
    fetchAsset(`${archiveUrl}.sig`, version, MAX_NOTE_BYTES),
  ])
  const published = parsePublishedSha256(new TextDecoder().decode(checksum))
  if (published === undefined) {
    throw new EngineRefusal(`instance: engine ${version}: the published sha256 is not readable`)
  }
  if (sha256Hex(archive) !== published) {
    throw new EngineRefusal(
      `instance: engine ${version}: the archive does not match its published sha256 checksum`
    )
  }
  const keys = (() => {
    try {
      return releaseKeysFor({ host: resolveReleaseDownloadHost(), now: Date.now() })
    } catch (cause) {
      throw new EngineRefusal(`instance: engine ${version}: ${describe(cause)}`)
    }
  })()
  if (!isSignedByTrustedKey(archive, new TextDecoder().decode(signature).trim(), keys)) {
    throw new EngineRefusal(
      `instance: engine ${version}: the release signature is not by a Sovrium release key this engine trusts`
    )
  }
  return archive
}

/** The one entry of a release archive, as `tar czf … sovrium` writes it. */
const BINARY_ENTRY = 'sovrium'

/**
 * Unpack the binary of a verified archive into `staging`, mode 0555. Only the
 * `sovrium` entry is extracted, and it must arrive as a regular file with no
 * other name: a symlink, a hard link or anything else the archive carries never
 * reaches the store.
 */
export const unpack = async (
  archive: Uint8Array,
  staging: string,
  version: string
): Promise<void> => {
  await new Bun.Archive(archive)
    .extract(staging, { glob: [BINARY_ENTRY, `./${BINARY_ENTRY}`] })
    .catch((cause: unknown) => {
      throw new EngineRefusal(
        `instance: engine ${version}: the archive cannot be unpacked: ${describe(cause)}`
      )
    })
  const binary = join(staging, BINARY_ENTRY)
  const [found, entries] = await Promise.all([
    lstat(binary).catch(() => undefined),
    readdir(staging),
  ])
  if (found?.isFile() !== true || found.nlink !== 1 || entries.length !== 1) {
    throw new EngineRefusal(
      `instance: engine ${version}: the archive holds no sovrium binary as a single regular file`
    )
  }
  await chmod(binary, 0o555)
}

/** `<binary> --version` must print exactly `version`. */
export const checkReportedVersion = (runner: Runner, binary: string, version: string) =>
  runner
    .run([binary, '--version'], { timeoutMs: VERSION_CHECK_TIMEOUT_MS, maxOutputBytes: 4096 })
    .pipe(
      Effect.mapError((error) =>
        engineError(`instance: engine ${version}: the binary did not run: ${error.message}`, error)
      ),
      Effect.flatMap((result) => {
        const reported = result.stdout.trim()
        return result.exitCode === 0 && reported === version
          ? Effect.void
          : Effect.fail(
              engineError(
                `instance: engine ${version}: the binary reports version ${reported === '' ? `nothing (exit ${String(result.exitCode)})` : reported}, not ${version}`
              )
            )
      })
    )
