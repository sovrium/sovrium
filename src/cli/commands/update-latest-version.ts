/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { originFor } from '@/domain/kernel/identity/release-signature'
import { resolveReleaseDownloadHost } from '@/domain/models/process-env/release-download'
import { withFetchTimeout } from '@/infrastructure/egress/with-fetch-timeout'
import type { CliFailure } from '@/infrastructure/logging/cli-output'

/**
 * Which release is the newest, asked the way `sovrium update` and the startup
 * notice both ask it.
 *
 * GitHub's releases API allows an address 60 anonymous requests an hour, and a
 * shared office or CI address spends them. So the lookup:
 * - sends a GitHub token from `GH_TOKEN`, then `GITHUB_TOKEN` (the `gh` CLI's
 *   order) to the API, and to nothing else: the download host may be a mirror;
 * - when the API answers with a spent quota, reads the newest version from the
 *   redirect of `releases/latest/download/<file>` instead, which the API quota
 *   does not count;
 * - says which of those happened, so a refusal names its real cause.
 */

const GITHUB_REPO = 'sovrium/sovrium'
const GITHUB_API_HOST_DEFAULT = 'api.github.com'
const LOOKUP_TIMEOUT_MS = 3000

/**
 * A version-less asset every release carries (the desktop updater manifest).
 * Only the redirect it answers is read: its target names the newest tag.
 */
const LATEST_PROBE_ASSET = 'latest.json'

type Env = Readonly<Record<string, string | undefined>>

/** What asking for the newest release came to. */
export type LatestVersionLookup =
  | { readonly kind: 'ok'; readonly version: string; readonly via: 'api' | 'download' }
  /** The API quota is spent; `reset` is the epoch second it refills, when GitHub said. */
  | { readonly kind: 'rate-limited'; readonly reset: number | undefined }
  | { readonly kind: 'http'; readonly status: number }
  /** An answer came, but its body is no release (a captive portal's page, JSON with no tag). */
  | { readonly kind: 'unreadable'; readonly status: number; readonly contentType: string }
  | { readonly kind: 'network' }

/** The GitHub token to send to the releases API: `GH_TOKEN`, then `GITHUB_TOKEN`; empty is unset. */
export const githubTokenFrom = (env: Env): string | undefined =>
  [env['GH_TOKEN'], env['GITHUB_TOKEN']].map((value) => value?.trim() ?? '').find(Boolean)

/**
 * Whether an API answer is GitHub's spent-quota refusal, and when it ends.
 * GitHub answers `429`, or `403` with `x-ratelimit-remaining: 0`; any other
 * `403` is a different refusal and is not reported as a rate limit.
 */
export const rateLimitOf = (
  status: number,
  headers: Readonly<Headers>
): { readonly reset: number | undefined } | undefined => {
  const spent = status === 429 || (status === 403 && headers.get('x-ratelimit-remaining') === '0')
  if (!spent) return undefined
  const reset = Number(headers.get('x-ratelimit-reset'))
  return { reset: Number.isFinite(reset) && reset > 0 ? reset : undefined }
}

/** The version a `releases/download/v<version>/…` URL names, or undefined. */
export const versionFromReleaseUrl = (url: string): string | undefined =>
  /\/releases\/download\/v(\d+\.\d+\.\d+[^/]*)\//.exec(url)?.[1]

/**
 * Read the newest version from the redirect of `releases/latest/download/…`
 * on the download host. The redirect is not followed: its target is the answer.
 */
const versionFromLatestDownload = async (env: Env): Promise<string | undefined> => {
  const url = `${originFor(resolveReleaseDownloadHost(env))}/${GITHUB_REPO}/releases/latest/download/${LATEST_PROBE_ASSET}`
  try {
    const response = await withFetchTimeout(url, { redirect: 'manual' }, LOOKUP_TIMEOUT_MS)
    const location = response.headers.get('location')
    if (response.status < 300 || response.status >= 400 || location === null) return undefined
    return versionFromReleaseUrl(new URL(location, url).pathname)
  } catch {
    return undefined
  }
}

/**
 * The release tag an API answer carries, read in its own guard: a body that is
 * not JSON, or JSON with no `tag_name`, is an unreadable reply, never a network
 * failure — a proxy answering in GitHub's place is not the absence of a network.
 */
export const releaseTagOf = async (response: Response): Promise<string | undefined> => {
  try {
    const body: unknown = await response.json()
    const tag =
      typeof body === 'object' && body !== null
        ? (body as { tag_name?: unknown }).tag_name
        : undefined
    return typeof tag === 'string' && tag.length > 0 ? tag : undefined
  } catch {
    return undefined
  }
}

const unreadableReply = (response: Response): LatestVersionLookup => ({
  kind: 'unreadable',
  status: response.status,
  contentType: response.headers.get('content-type') ?? 'none',
})

/** Ask the releases API, then — on a spent quota — the latest-release download road. */
export const fetchLatestVersion = async (env: Env = process.env): Promise<LatestVersionLookup> => {
  if (env['SOVRIUM_DISABLE_NETWORK'] === '1') return { kind: 'network' }
  const token = githubTokenFrom(env)
  const apiHost = env['SOVRIUM_UPDATE_API_HOST'] || GITHUB_API_HOST_DEFAULT
  try {
    const response = await withFetchTimeout(
      `${originFor(apiHost)}/repos/${GITHUB_REPO}/releases/latest`,
      {
        redirect: 'follow',
        headers: token === undefined ? {} : { authorization: `Bearer ${token}` },
      },
      LOOKUP_TIMEOUT_MS
    )
    const limited = rateLimitOf(response.status, response.headers)
    if (limited !== undefined) {
      const version = await versionFromLatestDownload(env)
      return version === undefined
        ? { kind: 'rate-limited', reset: limited.reset }
        : { kind: 'ok', version, via: 'download' }
    }
    if (!response.ok) return { kind: 'http', status: response.status }
    const tag = await releaseTagOf(response)
    return tag === undefined
      ? unreadableReply(response)
      : { kind: 'ok', version: tag.replace(/^v/, ''), via: 'api' }
  } catch {
    return { kind: 'network' }
  }
}

/** An epoch second as local `HH:MM`, 24-hour (hand-rolled: ICU may render midnight `24:00`). */
export const formatResetClock = (epochSeconds: number): string => {
  const date = new Date(epochSeconds * 1000)
  return [date.getHours(), date.getMinutes()].map((part) => String(part).padStart(2, '0')).join(':')
}

const RELEASES_PAGE = '  https://github.com/sovrium/sovrium/releases'

/** Why the newest release could not be found, worded for `printFailure`. */
export const lookupFailure = (
  lookup: Exclude<LatestVersionLookup, { readonly kind: 'ok' }>
): CliFailure => {
  if (lookup.kind === 'rate-limited') {
    const until = lookup.reset === undefined ? '' : `, resets at ${formatResetClock(lookup.reset)}`
    return {
      headline: `GitHub API rate limit reached${until}. Nothing was replaced.`,
      guidance:
        'Set GITHUB_TOKEN (or GH_TOKEN) to a GitHub token to lift the anonymous limit,\n' +
        `  or download the release directly from\n${RELEASES_PAGE}`,
    }
  }
  if (lookup.kind === 'http') {
    return {
      headline: `The GitHub releases API answered HTTP ${lookup.status}. Nothing was replaced.`,
      guidance: `Retry later, or download the release directly from\n${RELEASES_PAGE}`,
    }
  }
  if (lookup.kind === 'unreadable') {
    return {
      headline: `The GitHub releases API answered HTTP ${lookup.status} with an unreadable reply (content type ${lookup.contentType}). Nothing was replaced.`,
      guidance:
        'A proxy or a network sign-in page may be answering in its place. Sign in to the network\n' +
        `  or check the proxy, or download the release directly from\n${RELEASES_PAGE}`,
    }
  }
  return {
    headline: 'Could not reach the GitHub releases API. Nothing was replaced.',
    guidance: `Check your network, or download the release directly from\n${RELEASES_PAGE}`,
  }
}
