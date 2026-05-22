/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


const DEFAULT_GITHUB_REPO = 'sovrium/sovrium'
const DEFAULT_RETRIES = 3
const DEFAULT_RETRY_DELAY_MS = 2000

export const CHECKSUM_NOT_AVAILABLE = 'CHECKSUM_NOT_AVAILABLE'

export interface FetchChecksumOptions {
  readonly fetchFn?: typeof fetch
  readonly retries?: number
  readonly retryDelayMs?: number
  readonly githubRepo?: string
  readonly sleep?: (ms: number) => Promise<void>
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

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
