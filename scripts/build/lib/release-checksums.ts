/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Shared helpers for the Homebrew formula + Scoop manifest generators.
 *
 * Both generators fetch per-target SHA256 checksums from a published GitHub
 * Release and substitute them into a template. Two failure modes are guarded
 * here so neither generator can repeat them:
 *
 * - A release asset can lag behind the job that reads it, so `fetchChecksum`
 *   retries with backoff before giving up.
 * - A rendered artifact must NEVER ship with an unresolved placeholder (that is
 *   what produced the broken `CHECKSUM_NOT_AVAILABLE` formula in the v0.5.3
 *   tap), so `assertNoUnresolvedChecksums` fails the job loudly.
 *
 * Network and timing are injectable (`fetchFn`, `sleep`) so the generators can
 * be unit-tested without real HTTP or `mock.module()`.
 */

const DEFAULT_GITHUB_REPO = 'sovrium/sovrium'
const DEFAULT_RETRIES = 3
const DEFAULT_RETRY_DELAY_MS = 2000

/**
 * Sentinel substituted when a checksum cannot be fetched after all retries.
 * It must never reach a published artifact — `assertNoUnresolvedChecksums`
 * exists to make sure of that.
 */
export const CHECKSUM_NOT_AVAILABLE = 'CHECKSUM_NOT_AVAILABLE'

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
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Fetch the SHA256 for one release target (e.g. `darwin-arm64`). Retries with a
 * fixed backoff to ride out post-release asset-propagation lag. Returns
 * {@link CHECKSUM_NOT_AVAILABLE} only after exhausting every attempt — callers
 * must treat that as fatal via {@link assertNoUnresolvedChecksums}.
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
  } = options

  const url = `https://github.com/${githubRepo}/releases/download/v${version}/sovrium-${version}-${target}.sha256`

  let lastError: unknown
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await fetchFn(url)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      const text = await response.text()
      // Format: "hash  filename" — take the leading hash token.
      const hash = text.trim().split(/\s+/)[0]
      if (hash !== undefined && hash !== '') {
        return hash
      }
      throw new Error('empty checksum body')
    } catch (error) {
      lastError = error
      if (attempt < retries) {
        console.error(
          `Warning: checksum fetch for ${target} failed (attempt ${attempt}/${retries}): ${error} — retrying in ${retryDelayMs}ms`
        )
        await sleep(retryDelayMs)
      }
    }
  }

  console.error(
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
