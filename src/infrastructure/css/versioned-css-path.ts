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
 * The hash is also the route's only signal of WHICH app is being asked for —
 * this server hosts two, the operator's and Sovrium's own `/_admin` console —
 * so the console gets a FIXED identity rather than a derived one
 * ({@link OPERATOR_CONSOLE_CSS_HASH}); see that constant for why.
 *
 * Lives in its own module (not `compiler.ts`) so the hash can be imported by
 * the route layer and the renderers without pulling the whole compiler, and
 * because `css-cache-service` deliberately avoids importing the native-free
 * candidate resolver (import-cycle note in that file).
 */

import { createHash } from 'node:crypto'
import { isOperatorConsoleApp } from '@/domain/utils/admin-data-nav'
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

/** The 8-hex digest of a compiled-CSS cache key. */
const digest = (key: string): string =>
  createHash('sha256').update(key).digest('hex').slice(0, VERSIONED_CSS_HASH_LENGTH)

/**
 * The cache key standing in for EVERY `/_admin` operator-console surface.
 *
 * The console is not one app but a family: `buildDashboardSurfaceApp`
 * synthesizes a FRESH `App` per request, carrying that path's page and the
 * operator tables the surface administers. Hashing each of those the ordinary
 * way mints a per-surface URL — and the CSS route, which sees only a hash,
 * could then never map it back to an app. Every console surface therefore
 * shares ONE stylesheet identity, and the route resolves that single hash to
 * the embedded console config.
 *
 * The console declares no theme and its own chrome is drawn from classes the
 * build-time `BUILTIN_CSS_CANDIDATES` scan already covers, so collapsing the
 * family onto one identity costs it nothing: what varies per surface is the
 * OPERATOR data folded into it, which contributes no utility classes.
 */
const OPERATOR_CONSOLE_CSS_KEY = 'sovrium:operator-console'

/**
 * The single stylesheet hash every `/_admin` surface links.
 *
 * Exported so the CSS route can recognise it and answer with the CONSOLE's
 * stylesheet rather than the operator's — the tenant-theme isolation the
 * versioned URL always described but the route did not honour.
 */
export const OPERATOR_CONSOLE_CSS_HASH = digest(OPERATOR_CONSOLE_CSS_KEY)

/**
 * The 8-hex content hash of the app's compiled-CSS inputs.
 *
 * Operator-console apps ({@link isOperatorConsoleApp}) collapse onto the fixed
 * {@link OPERATOR_CONSOLE_CSS_HASH} — see {@link OPERATOR_CONSOLE_CSS_KEY} for
 * why a per-surface hash cannot work there.
 *
 * @param app - The parsed application schema.
 */
export const getVersionedCssHash = (app: App): string => {
  const cached = hashByApp.get(app)
  if (cached !== undefined) return cached
  const hash = isOperatorConsoleApp(app)
    ? OPERATOR_CONSOLE_CSS_HASH
    : digest(getCSSCacheKey(app.theme, resolveNativeFreeCandidates(app)))
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
