/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * How `sovrium update` decides a download can be trusted: HTTPS-only URLs
 * (final redirect included), a published sha256 that must be fetched, read and
 * matched, and a detached Ed25519 signature by a release key the binary trusts. Split from `update.ts`, which owns the flow; this module owns the
 * rules, so each is testable without a network or a binary to replace.
 *
 * Every request is HTTPS, final redirect included. The host seams
 * (`SOVRIUM_UPDATE_API_HOST`, `SOVRIUM_UPDATE_DOWNLOAD_HOST`) fall back to plain
 * HTTP for a LOOPBACK host only, which is what lets a spec stand a local server
 * in for GitHub; no other host is ever reached over HTTP.
 */

import {
  resolveReleaseSigningKeys,
  type ReleaseSigningKey,
} from '@/cli/commands/update-signing-keys'
import { importEd25519PublicKey, verifyDetached } from '@/domain/kernel/identity/ed25519'
import { withFetchStallTimeout } from '@/infrastructure/egress/with-fetch-timeout'
import { printFailure, printProgress, printStderr } from '@/infrastructure/logging/cli-output'

/** The opt-out that installs a release whose checksum cannot be verified. */
export const INSECURE_SKIP_CHECKSUM_FLAG = '--insecure-skip-checksum'

/** The result line of an update installed with the opt-out. */
export const UNVERIFIED_NOTE = `Checksum not verified, signature not verified — installed with ${INSECURE_SKIP_CHECKSUM_FLAG}`

/** The result lines of an update whose checksum and signature both verified. */
export const VERIFIED_LINES = [
  { glyph: 'ok' as const, text: 'Checksum verified' },
  { glyph: 'ok' as const, text: 'Signature verified' },
] as const

/**
 * Announce the opt-out BEFORE the download, on stderr, so it can be neither
 * missed in a log nor mistaken for a normal update.
 */
export const announceSkippedChecksum = (): void =>
  printStderr(
    `Warning: ${INSECURE_SKIP_CHECKSUM_FLAG} is set. The download will NOT be verified against its published sha256 nor its release signature.`
  )

/** `host` or `host:port` names this machine (127.0.0.0/8, `localhost`, `::1`). */
export const isLoopbackHost = (host: string): boolean => {
  const hostname = host.startsWith('[')
    ? host.slice(1, host.indexOf(']'))
    : (host.split(':')[0] ?? '')
  return hostname === 'localhost' || hostname === '::1' || /^127(?:\.\d{1,3}){3}$/.test(hostname)
}

/** `https://<host>`, or `http://<host>` for a loopback test host — never otherwise. */
export const originFor = (host: string): string =>
  `${isLoopbackHost(host) ? 'http' : 'https'}://${host}`

/**
 * Whether a response's FINAL url (after redirects) may be trusted: HTTPS, or the
 * loopback test host. GitHub answers an asset download with a redirect to its
 * storage host, and a redirect is exactly where a downgrade to HTTP would hide.
 */
export const isTrustedFinalUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || isLoopbackHost(parsed.host)
  } catch {
    return false
  }
}

/** The download URL of one release asset; the host is overridable for tests. */
export const releaseAssetUrl = (version: string, file: string): string =>
  `${originFor(process.env.SOVRIUM_UPDATE_DOWNLOAD_HOST || 'github.com')}/sovrium/sovrium/releases/download/v${version}/${file}`

/** Guidance shared by every checksum refusal: retry, then report — never work around it. */
export const CHECKSUM_GUIDANCE =
  "Re-run 'sovrium update'. If it keeps failing, do not install by hand: report it to\n" +
  '  security@sovrium.com (or https://github.com/sovrium/sovrium/issues), with the\n' +
  '  version and platform. The checksum and the release signature protect you from a corrupt\n' +
  '  or tampered download.'

/** The opt-out sentence every verification refusal ends with. */
const OPT_OUT_GUIDANCE = `  To install without verification anyway (not recommended): sovrium update ${INSECURE_SKIP_CHECKSUM_FLAG}`

/** A 64-character hex sha256, the first token of a published `.sha256` file. */
export const parsePublishedSha256 = (text: string): string | undefined => {
  const token = text.trim().split(/\s+/)[0]?.toLowerCase() ?? ''
  return /^[0-9a-f]{64}$/.test(token) ? token : undefined
}

/**
 * Fetch the published `.sha256` for a release asset. `undefined` means it could
 * not be read at all — missing, unreachable, redirected off HTTPS, or not a
 * sha256 — which the caller treats as a refusal, never as "skip".
 */
export const fetchPublishedSha256 = async (
  checksumUrl: string,
  stallTimeoutMs: number
): Promise<string | undefined> => {
  try {
    const text = await withFetchStallTimeout(checksumUrl, {}, stallTimeoutMs, async (response) =>
      response.ok && isTrustedFinalUrl(response.url || checksumUrl) ? response.text() : undefined
    )
    return text === undefined ? undefined : parsePublishedSha256(text)
  } catch {
    return undefined
  }
}

/**
 * Verify the downloaded archive against its published sha256, or stop.
 *
 * FAIL CLOSED: every release publishes `sovrium-<version>-<target>.sha256`, so
 * a checksum that cannot be fetched or read is a fault, not a reason to install
 * unverified. Both that and a mismatch exit 1 with nothing replaced. The only
 * way past is `--insecure-skip-checksum`, in which case nothing is fetched and
 * the result says the binary was NOT verified.
 *
 * Returns `true` when verified, `false` only for the explicit opt-out.
 */
export const verifyChecksum = async (
  archiveBuffer: Buffer,
  options: {
    readonly checksumUrl: string
    readonly stallTimeoutMs: number
    readonly insecureSkipChecksum: boolean
  }
): Promise<boolean> => {
  const { checksumUrl, stallTimeoutMs, insecureSkipChecksum } = options
  if (insecureSkipChecksum) return false

  const expectedHash = await fetchPublishedSha256(checksumUrl, stallTimeoutMs)
  if (expectedHash === undefined) {
    printFailure({
      headline: `Could not verify the download: the published checksum is missing or unreadable. Nothing was replaced.`,
      detail: [checksumUrl],
      guidance: `${CHECKSUM_GUIDANCE}\n\n${OPT_OUT_GUIDANCE}`,
    })
    process.exit(1)
  }

  const hasher = new Bun.CryptoHasher('sha256')
  hasher.update(archiveBuffer)
  const actualHash = hasher.digest('hex')
  if (actualHash !== expectedHash) {
    printFailure({
      headline: 'Checksum does not match the published sha256. Nothing was replaced.',
      detail: [`Expected ${expectedHash}`, `Got      ${actualHash}`],
      guidance: CHECKSUM_GUIDANCE,
    })
    process.exit(1)
  }
  return true
}

/**
 * Fetch the published `.sig` of a release archive: the base64 of an Ed25519
 * signature over its exact bytes. `undefined` means it could not be read —
 * missing, unreachable or redirected off HTTPS — which the caller refuses.
 */
export const fetchPublishedSignature = async (
  signatureUrl: string,
  stallTimeoutMs: number
): Promise<string | undefined> => {
  try {
    const text = await withFetchStallTimeout(signatureUrl, {}, stallTimeoutMs, async (response) =>
      response.ok && isTrustedFinalUrl(response.url || signatureUrl) ? response.text() : undefined
    )
    const trimmed = text?.trim() ?? ''
    return trimmed === '' ? undefined : trimmed
  } catch {
    return undefined
  }
}

/** A release key, as {@link verifySignature} needs it: its base64 public key. */
export interface TrustedReleaseKey {
  readonly publicKey: string
}

/**
 * Whether `signature` is a valid signature of `archive` by ANY of `keys`. A
 * `.sig` names no key, so every trusted key is tried; an unreadable key never
 * verifies anything.
 */
export const isSignedByTrustedKey = (
  archive: Readonly<Uint8Array>,
  signature: string,
  keys: readonly TrustedReleaseKey[]
): boolean =>
  keys.some((key) => {
    const publicKey = importEd25519PublicKey(key.publicKey)
    return publicKey !== undefined && verifyDetached(archive, signature, publicKey)
  })

/**
 * Verify the downloaded archive against its published signature, or stop.
 * Runs AFTER the checksum.
 *
 * FAIL CLOSED, in the checksum's family: a `.sig` that cannot be fetched, a
 * signature over other bytes, and a signature by a key the binary does not
 * trust all exit 1 with nothing replaced. `--insecure-skip-checksum` skips
 * this check too, and the result then says so.
 *
 * Returns `true` when verified, `false` only for the explicit opt-out.
 */
export const verifySignature = async (
  archiveBuffer: Readonly<Uint8Array>,
  options: {
    readonly signatureUrl: string
    readonly stallTimeoutMs: number
    readonly insecureSkipChecksum: boolean
    readonly keys: readonly TrustedReleaseKey[]
  }
): Promise<boolean> => {
  const { signatureUrl, stallTimeoutMs, insecureSkipChecksum, keys } = options
  if (insecureSkipChecksum) return false

  const signature = await fetchPublishedSignature(signatureUrl, stallTimeoutMs)
  if (signature === undefined) {
    printFailure({
      headline: `Could not verify the download: the published signature is missing or unreadable. Nothing was replaced.`,
      detail: [signatureUrl],
      guidance: `${CHECKSUM_GUIDANCE}\n\n${OPT_OUT_GUIDANCE}`,
    })
    process.exit(1)
  }

  if (!isSignedByTrustedKey(archiveBuffer, signature, keys)) {
    printFailure({
      headline:
        'The signature is not a valid signature of this download by a trusted Sovrium release key. Nothing was replaced.',
      detail: [signatureUrl],
      guidance: CHECKSUM_GUIDANCE,
    })
    process.exit(1)
  }
  return true
}

/** The download host releases come from: `SOVRIUM_UPDATE_DOWNLOAD_HOST`, else `github.com`. */
const downloadHost = (): string => process.env.SOVRIUM_UPDATE_DOWNLOAD_HOST || 'github.com'

/**
 * The release keys a download from `host` is judged against, at `now`: the
 * `SOVRIUM_UPDATE_SIGNING_KEYS` override for a loopback host only, the
 * embedded keys for every other host. Throws on a malformed override.
 */
export const releaseKeysFor = (options: {
  readonly host: string
  readonly now: number
  readonly env?: Readonly<Record<string, string | undefined>>
  readonly embedded?: readonly ReleaseSigningKey[]
}): readonly ReleaseSigningKey[] =>
  resolveReleaseSigningKeys({
    loopbackDownload: isLoopbackHost(options.host),
    now: options.now,
    ...(options.env === undefined ? {} : { env: options.env }),
    ...(options.embedded === undefined ? {} : { embedded: options.embedded }),
  })

/** This process's release keys; a malformed override is a refusal, never "trust nothing". */
const readReleaseKeys = (): readonly TrustedReleaseKey[] => {
  try {
    return releaseKeysFor({ host: downloadHost(), now: Date.now() })
  } catch (error) {
    printFailure({
      headline: 'Could not read the release signing keys. Nothing was replaced.',
      detail: [error instanceof Error ? error.message : String(error)],
      guidance: CHECKSUM_GUIDANCE,
    })
    return process.exit(1)
  }
}

/**
 * Both checks, in order — the checksum (`<archive>` with `.tar.gz` swapped for
 * `.sha256`), then the signature (`<archive>.sig`) — each refusal exiting with
 * nothing replaced.
 *
 * Returns `true` when both verified, `false` only for the explicit opt-out,
 * which skips both.
 */
export const verifyRelease = async (
  archiveBuffer: Buffer,
  options: {
    readonly archiveUrl: string
    readonly stallTimeoutMs: number
    readonly insecureSkipChecksum: boolean
  }
): Promise<boolean> => {
  const { archiveUrl, stallTimeoutMs, insecureSkipChecksum } = options
  if (insecureSkipChecksum) return false
  printProgress('Verifying the checksum')
  const checksumUrl = archiveUrl.replace(/\.tar\.gz$/, '.sha256')
  await verifyChecksum(archiveBuffer, { checksumUrl, stallTimeoutMs, insecureSkipChecksum })
  printProgress('Verifying the signature')
  return verifySignature(archiveBuffer, {
    signatureUrl: `${archiveUrl}.sig`,
    stallTimeoutMs,
    insecureSkipChecksum,
    keys: readReleaseKeys(),
  })
}
