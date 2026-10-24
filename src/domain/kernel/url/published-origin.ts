/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The value with every leading and/or trailing `/` removed.
 *
 * Scanned by index instead of a `/\/+$/` regex: a repetition anchored to the end is
 * retried from every slash of a run that is not at the end, so a long run of
 * slashes in the middle of the value made the regex quadratic. This is linear.
 */
const trimSlashes = (value: string, ends: 'both' | 'end'): string => {
  const units = value.split('')
  const start = ends === 'both' ? units.findIndex((unit) => unit !== '/') : 0
  if (start === -1) return ''
  const end = units.findLastIndex((unit) => unit !== '/') + 1
  return value.slice(start, end)
}

/** `''` for no path or the root; otherwise one leading slash and no trailing one. */
const normalizePath = (path: string): string => {
  const trimmed = trimSlashes(path.trim(), 'both')
  return trimmed === '' ? '' : `/${trimmed}`
}

/** The pathname of an absolute URL, `''` when it does not parse. */
const pathnameOf = (url: string): string => {
  try {
    return new URL(url).pathname
  } catch {
    return ''
  }
}

/**
 * The address a static build is published at: its base URL followed by its
 * base path, the prefix every absolute address it prints is built from (the
 * canonical links, the sitemap, `robots.txt`, `llms.txt`).
 *
 * A base URL may name only the host (`https://acme.example` with a base path of
 * `/docs`) or already carry the path (`https://example.com/myapp` with
 * `/myapp`). Both describe the same deployment, so the path is appended only
 * when the URL does not already end with it — never doubled. The result has no
 * trailing slash, which makes the function idempotent.
 */
export const composePublishedOrigin = (baseUrl: string, basePath?: string): string => {
  const origin = trimSlashes(baseUrl, 'end')
  const path = normalizePath(basePath ?? '')
  if (path === '') return origin
  return normalizePath(pathnameOf(origin)).endsWith(path) ? origin : `${origin}${path}`
}
