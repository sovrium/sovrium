/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/** `''` for no path or the root; otherwise one leading slash and no trailing one. */
const normalizePath = (path: string): string => {
  const trimmed = path.trim().replace(/^\/+|\/+$/g, '')
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
  const origin = baseUrl.replace(/\/+$/, '')
  const path = normalizePath(basePath ?? '')
  if (path === '') return origin
  return normalizePath(pathnameOf(origin)).endsWith(path) ? origin : `${origin}${path}`
}
