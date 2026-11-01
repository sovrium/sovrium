/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Shared helpers for the Homebrew formula + Scoop manifest generators.
 *
 * Both generators read a per-target SHA256 from a published GitHub Release and
 * substitute it into a template that every `brew install sovrium` and
 * `scoop install sovrium` then trusts. The hash is therefore never taken on the
 * release page's word: `fetchChecksum` downloads the archive itself and its
 * detached `.sig`, verifies the signature against the release keys this
 * repository embeds (`EMBEDDED_RELEASE_SIGNING_KEYS`), and returns the sha256
 * only when it is a well-formed 64-hex digest AND the digest of the bytes whose
 * signature verified. Whoever can edit a release can edit its `.sha256`; they
 * cannot sign with the release key.
 *
 * Three failure modes are guarded here so neither generator can repeat them:
 *
 * - A release asset can lag behind the job that reads it, so a network or HTTP
 *   failure is retried with backoff before giving up.
 * - A rendered artifact must NEVER ship with an unresolved placeholder (that is
 *   what produced the broken `CHECKSUM_NOT_AVAILABLE` formula in the v0.5.3
 *   tap), so `assertNoUnresolvedChecksums` fails the job loudly.
 * - A published hash that is malformed, that does not match the archive, or an
 *   archive whose signature does not verify is NOT lag: it throws
 *   {@link ReleaseIntegrityError} at once, before any tap file is written.
 *
 * Network, timing, keys and clock are injectable (`fetchFn`, `sleep`, `keys`,
 * `now`) so the generators can be unit-tested without real HTTP or
 * `mock.module()`.
 */

import { createHash } from 'node:crypto'
import {
  EMBEDDED_RELEASE_SIGNING_KEYS,
  isSignedByTrustedKey,
  isTrustedFinalUrl,
  parsePublishedSha256,
  startedReleaseKeys,
  type TrustedReleaseKey,
} from '@/domain/kernel/identity/release-signature'
import { printStderr } from '@/infrastructure/logging/cli-output'

const DEFAULT_GITHUB_REPO = 'sovrium/sovrium'
const DEFAULT_RETRIES = 3
const DEFAULT_RETRY_DELAY_MS = 2000

/**
 * Sentinel substituted when a checksum cannot be fetched after all retries.
 * It must never reach a published artifact — `assertNoUnresolvedChecksums`
 * exists to make sure of that.
 */
export const CHECKSUM_NOT_AVAILABLE = 'CHECKSUM_NOT_AVAILABLE'

/**
 * The release itself is wrong, not late: a malformed published hash, a hash
 * that is not the archive's, or a signature that does not verify. Never
 * retried, never turned into the sentinel: the generator stops before writing.
 */
export class ReleaseIntegrityError extends Error {
  override readonly name = 'ReleaseIntegrityError'
}

export interface FetchChecksumOptions {
  /** Fetch implementation (injected in tests). Defaults to the global `fetch`. */
  readonly fetchFn?: typeof fetch
  /** Total attempts before falling back to the sentinel. Defaults to 3. */
  readonly retries?: number
  /** Delay between attempts, in ms. Defaults to 2000. */
  readonly retryDelayMs?: number
  /** GitHub `owner/repo` hosting the release assets. Defaults to `sovrium/sovrium`. */
  readonly githubRepo?: string
  /** Sleep implementation (injected in tests to avoid real delays). */
  readonly sleep?: (ms: number) => Promise<void>
  /**
   * The release keys a signature may verify against. Defaults to the keys of
   * `EMBEDDED_RELEASE_SIGNING_KEYS` whose `validFrom` has passed at `now`.
   */
  readonly keys?: readonly TrustedReleaseKey[]
  /** The instant keys are judged at, in ms since the epoch. Defaults to `Date.now()`. */
  readonly now?: number
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

/** The archive a release publishes for `target`: a `.zip` on Windows, a `.tar.gz` elsewhere. */
export const releaseArchiveName = (version: string, target: string): string =>
  `sovrium-${version}-${target}.${target.startsWith('windows-') ? 'zip' : 'tar.gz'}`

/** One GET that must succeed over a trusted final URL; any other outcome throws (and is retried). */
const fetchOk = async (fetchFn: typeof fetch, url: string): Promise<Response> => {
  const response = await fetchFn(url)
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }
  // A redirect is where a downgrade to plain HTTP would hide; GitHub answers an
  // asset download with one. An empty `url` is a constructed Response (tests).
  if (response.url !== '' && !isTrustedFinalUrl(response.url)) {
    throw new ReleaseIntegrityError(
      `${url} was redirected to an untrusted location: ${response.url}`
    )
  }
  return response
}

/**
 * Read one target's sha256 and prove it: well-formed, equal to the digest of
 * the archive downloaded here, and that archive signed by a trusted release key.
 */
const fetchVerifiedOnce = async (
  fetchFn: typeof fetch,
  base: string,
  version: string,
  target: string,
  keys: readonly TrustedReleaseKey[]
): Promise<string> => {
  const archive = releaseArchiveName(version, target)
  const [checksumText, archiveBytes, signature] = await Promise.all([
    fetchOk(fetchFn, `${base}/sovrium-${version}-${target}.sha256`).then((r) => r.text()),
    fetchOk(fetchFn, `${base}/${archive}`).then(async (r) => new Uint8Array(await r.arrayBuffer())),
    fetchOk(fetchFn, `${base}/${archive}.sig`).then((r) => r.text()),
  ])

  const published = parsePublishedSha256(checksumText)
  if (published === undefined) {
    throw new ReleaseIntegrityError(
      `the published checksum for ${archive} is not a 64-character hex sha256: ` +
        JSON.stringify(checksumText.trim().slice(0, 80))
    )
  }
  const actual = createHash('sha256').update(archiveBytes).digest('hex')
  if (actual !== published) {
    throw new ReleaseIntegrityError(
      `${archive} hashes to ${actual}, but the release publishes ${published}`
    )
  }
  if (!isSignedByTrustedKey(archiveBytes, signature.trim(), keys)) {
    throw new ReleaseIntegrityError(
      `${archive}.sig does not verify against any trusted Sovrium release key`
    )
  }
  return published
}

/**
 * Fetch the SHA256 for one release target (e.g. `darwin-arm64`), verified as
 * described in the module comment. Network and HTTP failures are retried with
 * a fixed backoff to ride out post-release asset-propagation lag, and return
 * {@link CHECKSUM_NOT_AVAILABLE} only after every attempt failed — callers must
 * treat that as fatal via {@link assertNoUnresolvedChecksums}. An integrity
 * failure throws {@link ReleaseIntegrityError} at once.
 */
export async function fetchChecksum(
  version: string,
  target: string,
  options: FetchChecksumOptions = {}
): Promise<string> {
  const {
    fetchFn = fetch,
    retries = DEFAULT_RETRIES,
    retryDelayMs = DEFAULT_RETRY_DELAY_MS,
    githubRepo = DEFAULT_GITHUB_REPO,
    sleep = defaultSleep,
    now = Date.now(),
  } = options
  const keys = options.keys ?? startedReleaseKeys(EMBEDDED_RELEASE_SIGNING_KEYS, now)
  if (keys.length === 0) {
    throw new ReleaseIntegrityError(
      'no trusted release key is in force, so no signature can be verified'
    )
  }

  const base = `https://github.com/${githubRepo}/releases/download/v${version}`

  let lastError: unknown
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await fetchVerifiedOnce(fetchFn, base, version, target, keys)
    } catch (error) {
      if (error instanceof ReleaseIntegrityError) throw error
      lastError = error
      if (attempt < retries) {
        printStderr(
          `Warning: checksum fetch for ${target} failed (attempt ${attempt}/${retries}): ${error} — retrying in ${retryDelayMs}ms`
        )
        await sleep(retryDelayMs)
      }
    }
  }

  printStderr(
    `Error: could not fetch checksum for ${target} after ${retries} attempt(s): ${lastError}`
  )
  return CHECKSUM_NOT_AVAILABLE
}

/**
 * Guard a fully-rendered formula/manifest before it is printed, written, or
 * committed. Throws if any checksum placeholder survived substitution — a
 * release must never publish an artifact pinning {@link CHECKSUM_NOT_AVAILABLE}.
 *
 * @param rendered The substituted template content.
 * @param label    A human-readable label for the artifact (used in the error).
 */
export function assertNoUnresolvedChecksums(rendered: string, label: string): void {
  const unresolved = rendered.split(CHECKSUM_NOT_AVAILABLE).length - 1
  if (unresolved > 0) {
    throw new Error(
      `${label}: ${unresolved} checksum placeholder(s) (${CHECKSUM_NOT_AVAILABLE}) survived ` +
        'substitution — one or more release assets could not be fetched. Refusing to publish a ' +
        'broken artifact; re-run once the release `.sha256` assets are servable.'
    )
  }
}
