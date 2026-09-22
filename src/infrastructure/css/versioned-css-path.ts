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
 * that determine the compiled CSS — the design and the app's authored class
 * candidates (the same pair `getCSSCacheKey` keys the compile cache on) — so
 * the HTML can link `/assets/output-<hash>.css` and the route can serve it
 * `immutable`: a deploy that changes the CSS changes the URL, and a URL that
 * never changes content never needs revalidation.
 *
 * The hash is also the route's only signal of WHICH app is being asked for —
 * this server hosts two, the operator's and Sovrium's own `/_admin` console —
 * so the console gets a SHARED identity rather than a per-surface one
 * ({@link consoleCssHash}); see `OPERATOR_CONSOLE_CSS_KEY` for why.
 *
 * Lives in its own module (not `compiler.ts`) so the hash can be imported by
 * the route layer and the renderers without pulling the whole compiler, and
 * because `css-cache-service` deliberately avoids importing the native-free
 * candidate resolver (import-cycle note in that file).
 */

import { createHash } from 'node:crypto'
import { isOperatorConsoleApp } from '@/domain/models/app/admin/admin-data-nav'
import { designCascadeKey } from '@/domain/models/app/design/console-design-cascade'
import { getCSSCacheKey } from '@/infrastructure/css/cache/css-cache-service'
import { designSystemScopeKey } from '@/infrastructure/css/design-system-scope'
import { mountIdentityKey } from '@/infrastructure/css/mount-identity'
import { resolveNativeFreeCandidates } from '@/infrastructure/css/native-free-compiler'
import type { App } from '@/domain/models/app'

/** Per-`App`-instance memo — design and candidates are fixed per process. */
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
 * The console is not one app but a family. `synthesiseMountSurface`
 * (`application/use-cases/mount/embedded-app-mount.ts`) returns a FRESH `App`
 * for the paths that need one — the preset spread with the operator tables,
 * components or language table that path administers. Hashing each of those the
 * ordinary way mints a per-surface URL, and the CSS route, which sees only a
 * hash, could then never map it back to an app. Every console surface therefore
 * shares ONE stylesheet identity, and the route resolves that single hash to
 * the embedded console config.
 *
 * The synthesis used to be `buildDashboardSurfaceApp`, which built a surface for
 * EVERY console path; it is gone, and the paths needing a fresh app are now the
 * narrow set that use-case names. The collapse is still required, because that
 * set is non-empty.
 *
 * The console's own chrome is drawn from classes the build-time
 * `BUILTIN_CSS_CANDIDATES` scan already covers, so collapsing the family onto
 * one identity costs it nothing: what varies per surface is the OPERATOR data
 * folded into it, which contributes no utility classes.
 *
 * What DOES vary is not per surface but per operator, and {@link consoleCssHash}
 * folds each such input back in: the SCOPED design system the design-system
 * section draws flat in the console document, the mount's own base path, and —
 * since the operator's `design` began cascading onto the console chrome — the
 * cascading design families themselves. Each changes the compiled bytes, so
 * leaving any of them out of the identity would serve one operator's console
 * stylesheet from another's `immutable` cache entry.
 */
const OPERATOR_CONSOLE_CSS_KEY = 'sovrium:operator-console'

/**
 * The stylesheet hash a console surface links, given the design system it
 * scopes.
 *
 * It was a bare `digest(OPERATOR_CONSOLE_CSS_KEY)` constant until 2026-09-02,
 * when the design-system section began drawing the operator's system FLAT in
 * the console document. The console's CSS now carries a scoped copy of the
 * operator's token layer, so a fixed hash would serve one operator's palette
 * from another operator's `immutable` cache entry.
 *
 * The CSS route calls this to RECOGNISE a console request (it holds the
 * operator app and can rebuild the same console app), and every console page
 * links it through {@link getVersionedCssHash}. Both must agree exactly, which
 * is why both derive it from the same {@link designSystemScopeKey}.
 *
 * A SECOND varying input is the mount's own base path
 * ({@link mountIdentityKey}). The base is rewritten into every console link
 * before the class corpus is harvested, so it is a genuine input to the
 * compiled bytes and belongs in the hash that keys them. The console's base is
 * fixed at `/_admin`, which contributes the empty string — so this varies over
 * exactly one value today, and is kept because the DEPENDENCY is real even
 * where the variation is not.
 *
 * A THIRD input joined them when the operator's own `design` began cascading
 * onto the console chrome ([internal ref] A4's runtime; `[internal ref]`). The console's
 * compiled bytes now move with the operator's declared colours, type ladder,
 * density and component classes, so those have to move the URL too — otherwise
 * one operator's `immutable`-cached console stylesheet is served for another's
 * document, which is the exact bug this versioned URL exists to prevent.
 *
 * `designCascadeKey` deliberately keys on ALL SEVEN cascading families rather
 * than only the four that reach a CSS emitter today. Over-keying costs a cache
 * miss; under-keying costs correctness, and a hand-maintained "which keys emit"
 * list is the thing that would rot the first time one of the other three gains
 * a generator. An operator declaring nothing contributes the empty string,
 * which is what keeps an undesigned instance's console hash unchanged from
 * before the cascade existed.
 *
 * @param app - a console surface app, possibly carrying a scope and a mount.
 */
export const consoleCssHash = (app: App): string =>
  digest(
    `${OPERATOR_CONSOLE_CSS_KEY}${designSystemScopeKey(app)}${mountIdentityKey(app)}${designCascadeKey(app)}`
  )

/**
 * The 8-hex content hash of the app's compiled-CSS inputs.
 *
 * Operator-console apps ({@link isOperatorConsoleApp}) collapse onto the fixed
 * {@link consoleCssHash} — see {@link OPERATOR_CONSOLE_CSS_KEY} for
 * why a per-surface hash cannot work there.
 *
 * @param app - The parsed application schema.
 */
export const getVersionedCssHash = (app: App): string => {
  const cached = hashByApp.get(app)
  if (cached !== undefined) return cached
  const hash = isOperatorConsoleApp(app)
    ? consoleCssHash(app)
    : digest(getCSSCacheKey(app.design, resolveNativeFreeCandidates(app)))
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
