/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Content-hashed names for the stable-named client entries.
 *
 * The four entries a page loads by a fixed URL (`client.js`,
 * `language-switcher.js`, `scroll-animation.js`, `islands/island-entry.js`)
 * change content on every release while their URL stays put. The island
 * chunks they import are content-hashed and REPLACED by each release, so a
 * browser still holding the previous release's entry imports chunks that no
 * longer exist. Publishing each entry under a name derived from its bytes makes
 * a deploy change the URL the page asks for, exactly as it already does for the
 * chunks and the stylesheet.
 *
 * The hash is computed from the bytes the server actually serves, so it is the
 * same for every process running the same release and changes exactly when the
 * entry does. Its shape — eight characters out of `[a-f0-9]` — is a subset of
 * the `-[a-z0-9]{8}.js` form the asset routes already treat as content-hashed.
 */

import { createHash } from 'node:crypto'

/** Width of the hash segment in a hashed entry name. */
const ENTRY_HASH_LENGTH = 8

/** The 8-hex digest of an entry's bytes. */
export const entryContentHash = (source: string): string =>
  createHash('sha256').update(source).digest('hex').slice(0, ENTRY_HASH_LENGTH)

/**
 * The hashed counterpart of a stable entry path or file name:
 * `/assets/client.js` → `/assets/client-3fa9c210.js`.
 */
export const hashedEntryName = (stableName: string, source: string): string =>
  stableName.replace(/\.js$/, `-${entryContentHash(source)}.js`)

/**
 * Recover the stable name a hashed entry name stands for, or `undefined` when
 * `name` is not one: `island-entry-3fa9c210.js` → `island-entry.js`.
 */
export const stableEntryName = (name: string): string | undefined => {
  const match = /^(.+)-[a-f0-9]{8}\.js$/.exec(name)
  return match === null ? undefined : `${match[1]}.js`
}

/**
 * The strong validator for an entry's bytes, for the unhashed aliases that are
 * served `no-cache` and must answer a conditional request with a 304.
 */
export const entryETag = (source: string): string =>
  `"${createHash('sha256').update(source).digest('hex').slice(0, 32)}"`

/**
 * Whether an `If-None-Match` header names `etag` (or is the `*` wildcard).
 * Weak-validator prefixes are ignored, per the weak comparison RFC 9110 asks
 * of `If-None-Match`.
 */
export const ifNoneMatchHits = (header: string | undefined, etag: string): boolean => {
  if (header === undefined) return false
  return header
    .split(',')
    .map((candidate) => candidate.trim().replace(/^W\//, ''))
    .some((candidate) => candidate === '*' || candidate === etag)
}

/** The Cache-Control values an entry is answered with, under each kind of name. */
export interface EntryCacheControl {
  /** A content-hashed name: its bytes can never change under it. */
  readonly hashed: string
  /** A stable name (an alias): its bytes change from one release to the next. */
  readonly stable: string
}

/**
 * Answer an entry requested by a stable name: the stable Cache-Control plus an
 * `ETag`, and a bodiless 304 when the browser already holds these bytes.
 */
export function stableEntryResponse(
  request: Readonly<Request>,
  content: string,
  cacheControl: string
): Response {
  const etag = entryETag(content)
  const headers = { 'Cache-Control': cacheControl, ETag: etag }
  if (ifNoneMatchHits(request.headers.get('If-None-Match') ?? undefined, etag)) {
    return new Response(undefined, { status: 304, headers })
  }
  return new Response(content, {
    headers: { ...headers, 'Content-Type': 'application/javascript' },
  })
}

/**
 * Answer an entry requested as `requested` — its stable name, or a hashed one.
 *
 * Only the CURRENT hash gets the hashed (pinned) Cache-Control. The stable name,
 * and any other hash — HTML cached from a previous release — get the current
 * bytes under the revalidating alias headers, never a 404: a 404 there would
 * leave a returning visitor with no entry, and so with no recovery either.
 */
export async function serveEntry(input: {
  readonly request: Readonly<Request>
  readonly requested: string
  readonly stable: string
  readonly read: () => Promise<string>
  readonly cacheControl: EntryCacheControl
}): Promise<Response> {
  const content = await input.read()
  return input.requested === hashedEntryName(input.stable, content)
    ? new Response(content, {
        headers: {
          'Content-Type': 'application/javascript',
          'Cache-Control': input.cacheControl.hashed,
        },
      })
    : stableEntryResponse(input.request, content, input.cacheControl.stable)
}

/**
 * Stable path → hashed path for each entry (`/assets/client.js` →
 * `/assets/client-3fa9c210.js`), reading every entry's bytes once.
 */
export async function hashedEntryPaths(
  entries: Readonly<Record<string, () => Promise<string>>>,
  prefix: string
): Promise<Readonly<Record<string, string>>> {
  const pairs = await Promise.all(
    Object.entries(entries).map(
      async ([name, read]) =>
        [`${prefix}${name}`, `${prefix}${hashedEntryName(name, await read())}`] as const
    )
  )
  return Object.fromEntries(pairs)
}

/**
 * Regex source matching a whole hashed file name of any of `stableNames`
 * (`client-3fa9c210.js`). It spans the ENTIRE path segment because Hono only
 * binds a param that does — see `VERSIONED_CSS_FILE_PATTERN`.
 */
export const hashedEntryPattern = (stableNames: readonly string[]): string =>
  `(?:${stableNames.map((name) => name.replace(/\.js$/, '')).join('|')})-[a-f0-9]{8}\\.js`
