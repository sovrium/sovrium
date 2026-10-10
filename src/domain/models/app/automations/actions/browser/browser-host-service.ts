/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The `allowedHosts` of a `browser/run` step, read the one way every reader
 * reads them: the boot check of a written-out `goto`, the driver's guard on
 * every request, and the page's `connect-src`.
 *
 * An entry names a host and, optionally, a port:
 *
 * - `app.example.com` matches that host on its scheme's default port only;
 * - `app.example.com:8443` matches that host on that port only;
 * - `*.example.com` matches any sub-domain of `example.com` — never
 *   `example.com` itself — on the default port.
 *
 * Names are compared lower-case. Pure.
 */

interface HostEntry {
  readonly wildcard: boolean
  /** The host name, lower-case, without the `*.` of a wildcard. */
  readonly hostname: string
  /** The port as written, `''` when the entry names none. */
  readonly port: string
}

/** Read one `allowedHosts` entry. */
const parseHostEntry = (entry: string): HostEntry => {
  const lower = entry.trim().toLowerCase()
  const wildcard = lower.startsWith('*.')
  const rest = wildcard ? lower.slice(2) : lower
  const colon = rest.lastIndexOf(':')
  return colon === -1
    ? { wildcard, hostname: rest, port: '' }
    : { wildcard, hostname: rest.slice(0, colon), port: rest.slice(colon + 1) }
}

/** The URL, parsed, or `undefined` when it does not parse. */
const parseUrl = (url: string): Readonly<URL> | undefined => {
  try {
    return new URL(url)
  } catch {
    return undefined
  }
}

const entryMatches = (entry: HostEntry, hostname: string, port: string): boolean => {
  if (entry.port !== port) return false
  return entry.wildcard ? hostname.endsWith(`.${entry.hostname}`) : hostname === entry.hostname
}

/**
 * Whether `url` is on one of `allowedHosts`. A URL that does not parse, or
 * whose scheme carries no host (`data:`, `about:`), is on none of them.
 */
export const isAllowedHost = (url: string, allowedHosts: readonly string[]): boolean => {
  const parsed = parseUrl(url)
  if (parsed === undefined || parsed.hostname === '') return false
  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  return allowedHosts
    .map(parseHostEntry)
    .some((entry) => entryMatches(entry, hostname, parsed.port))
}

/** The host (and port) of a URL as a person reads it, or the URL itself when it does not parse. */
export const hostOf = (url: string): string => parseUrl(url)?.host ?? url

/**
 * The CSP source list that lets a page talk to `allowedHosts` and nothing else:
 * each entry over `http`, `https`, `ws` and `wss`.
 */
export const allowedConnectSources = (allowedHosts: readonly string[]): string =>
  allowedHosts
    .map(parseHostEntry)
    .flatMap((entry) => {
      const host = `${entry.wildcard ? '*.' : ''}${entry.hostname}${entry.port === '' ? '' : `:${entry.port}`}`
      return ['http', 'https', 'ws', 'wss'].map((scheme) => `${scheme}://${host}`)
    })
    .join(' ')

/**
 * The URL a `goto` names when it is written out — no `{{…}}` in it — or
 * `undefined` for a templated one, which can only be checked when the step
 * runs.
 */
export const writtenOutUrl = (url: unknown): string | undefined =>
  typeof url === 'string' && !url.includes('{{') && !url.includes('$env.') ? url : undefined
