/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Content-versioned stylesheet URL.
 *
 * `/assets/output.css` is served with a one-hour shared cache and no content
 * hash, so after a deploy every visitor can keep stale CSS for up to an hour.
 * This module derives a stable 8-hex content hash from exactly the inputs
 * that determine the compiled CSS — the theme and the app's authored class
 * candidates (the same pair `getCSSCacheKey` keys the compile cache on) — so
 * the HTML can link `/assets/output-<hash>.css` and the route can serve it
 * `immutable`: a deploy that changes the CSS changes the URL, and a URL that
 * never changes content never needs revalidation.
 *
 * Lives in its own module (not `compiler.ts`) so the hash can be imported by
 * the route layer and the renderers without pulling the whole compiler, and
 * because `css-cache-service` deliberately avoids importing the native-free
 * candidate resolver (import-cycle note in that file).
 */

import { createHash } from 'node:crypto'
import { getCSSCacheKey } from '@/infrastructure/css/cache/css-cache-service'
import { resolveNativeFreeCandidates } from '@/infrastructure/css/native-free-compiler'
import type { App } from '@/domain/models/app'

/** Per-`App`-instance memo — theme and candidates are fixed per process. */
const hashByApp = new WeakMap<App, string>()

/** Literal prefix of a versioned stylesheet filename. */
const VERSIONED_CSS_PREFIX = 'output-'

/** Hex width of the content hash embedded in the filename. */
const VERSIONED_CSS_HASH_LENGTH = 8

/**
 * Regex source matching a whole versioned stylesheet FILENAME
 * (`output-3fa9c210.css`) — not a path.
 *
 * Exported so the route that serves these files and the renderers that link
 * them agree on one shape. It deliberately describes the ENTIRE segment:
 * Hono's router only binds a param that spans a full path segment, so the
 * route must be `/assets/:file{<this>}` rather than a literal-wrapped
 * `/assets/output-:hash{…}.css`, which compiles but never matches.
 */
export const VERSIONED_CSS_FILE_PATTERN = `${VERSIONED_CSS_PREFIX}[a-f0-9]{${VERSIONED_CSS_HASH_LENGTH}}\\.css`

/**
 * Recover the content hash from a filename matched by
 * {@link VERSIONED_CSS_FILE_PATTERN}.
 *
 * @param fileName - The matched filename, e.g. `output-3fa9c210.css`.
 */
export const parseVersionedCssHash = (fileName: string | undefined): string =>
  (fileName ?? '').slice(
    VERSIONED_CSS_PREFIX.length,
    VERSIONED_CSS_PREFIX.length + VERSIONED_CSS_HASH_LENGTH
  )

/**
 * The 8-hex content hash of the app's compiled-CSS inputs.
 *
 * @param app - The parsed application schema.
 */
export const getVersionedCssHash = (app: App): string => {
  const cached = hashByApp.get(app)
  if (cached !== undefined) return cached
  const key = getCSSCacheKey(app.theme, resolveNativeFreeCandidates(app))
  const hash = createHash('sha256').update(key).digest('hex').slice(0, 8)
  // eslint-disable-next-line functional/no-expression-statements -- memoization of a pure derivation over an immutable input
  hashByApp.set(app, hash)
  return hash
}

/**
 * The versioned stylesheet path the rendered HTML should link, e.g.
 * `/assets/output-3fa9c210.css`.
 *
 * @param app - The parsed application schema.
 */
export const getVersionedCssPath = (app: App): string => `/assets/${getVersionedCssFileName(app)}`

/**
 * The versioned stylesheet FILENAME, e.g. `output-3fa9c210.css` — what the
 * static export writes beside the plain `output.css`.
 *
 * @param app - The parsed application schema.
 */
export const getVersionedCssFileName = (app: App): string =>
  `${VERSIONED_CSS_PREFIX}${getVersionedCssHash(app)}.css`
