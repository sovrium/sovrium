/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * How `sovrium update` decides a download can be trusted: HTTPS-only URLs
 * (final redirect included), and a published sha256 that must be fetched, read
 * and matched. Split from `update.ts`, which owns the flow; this module owns the
 * rules, so each is testable without a network or a binary to replace.
 *
 * Every request is HTTPS, final redirect included. The host seams
 * (`SOVRIUM_UPDATE_API_HOST`, `SOVRIUM_UPDATE_DOWNLOAD_HOST`) fall back to plain
 * HTTP for a LOOPBACK host only, which is what lets a spec stand a local server
 * in for GitHub; no other host is ever reached over HTTP.
 */

import { withFetchStallTimeout } from '@/infrastructure/egress/with-fetch-timeout'
import { printFailure, printStderr } from '@/infrastructure/logging/cli-output'

/** The opt-out that installs a release whose checksum cannot be verified. */
export const INSECURE_SKIP_CHECKSUM_FLAG = '--insecure-skip-checksum'

/** The result line of an update installed with the opt-out. */
export const UNVERIFIED_NOTE = `Checksum not verified — installed with ${INSECURE_SKIP_CHECKSUM_FLAG}`

/**
 * Announce the opt-out BEFORE the download, on stderr, so it can be neither
 * missed in a log nor mistaken for a normal update.
 */
export const announceSkippedChecksum = (): void =>
  printStderr(
    `Warning: ${INSECURE_SKIP_CHECKSUM_FLAG} is set. The download will NOT be verified against its published sha256.`
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
  '  version and platform. The checksum protects you from a corrupt or tampered download.'

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
      guidance:
        `${CHECKSUM_GUIDANCE}\n\n` +
        `  To install without verification anyway (not recommended): sovrium update ${INSECURE_SKIP_CHECKSUM_FLAG}`,
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
