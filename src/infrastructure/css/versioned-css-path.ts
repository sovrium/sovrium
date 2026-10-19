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
 * that determine the compiled CSS — the app's design and authored class
 * candidates (the same pair `getCSSCacheKey` keys the compile cache on), AND
 * the engine that compiles them ({@link engineCssFingerprint}) — so the HTML
 * can link `/assets/output-<hash>.css` and the route can serve it `immutable`:
 * a deploy that changes the CSS changes the URL, and a URL that never changes
 * content never needs revalidation.
 *
 * The engine half is not optional. Keyed on the app alone, upgrading Sovrium
 * under an unchanged config kept the URL while the bytes behind it changed (new
 * token layer, new font URLs, a new Tailwind), and a returning browser held the
 * previous release's stylesheet for a year under `immutable`.
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
import { buildSourceCSS } from '@/infrastructure/css/source-css'
import { appSetsTypeset } from '@/infrastructure/css/typeset-gate'
import { isCompiled } from '@/infrastructure/process/package-paths'
import { getSovriumVersionSync } from '@/infrastructure/process/version'
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
 * The stylesheet hash for one app's CSS inputs as compiled by one engine.
 *
 * Exported as the pure seam the unit test drives: two engines, or two sets of
 * app inputs, must never share a URL.
 *
 * @param appInputs - what the app contributes (design, candidates, scope).
 * @param engine - {@link engineCssFingerprint} of the compiling engine.
 */
export const versionedCssHashOf = (appInputs: string, engine: string): string =>
  digest(`${engine}\n${appInputs}`)

/**
 * The two compile paths, which emit different bytes for the same inputs: the
 * native PostCSS pipeline a source checkout runs, and the pure-JS native-free
 * engine the compiled binary runs (and a source run forced onto it).
 */
export type CssCompilePath = 'native-free' | 'postcss'

/**
 * Whether this process compiles with the pure-JS native-free engine (inside
 * the compiled binary, or forced from source with
 * `SOVRIUM_FORCE_NATIVE_FREE_CSS=1`) rather than the native PostCSS pipeline.
 */
export const usesNativeFreeCompiler = (): boolean =>
  isCompiled || process.env.SOVRIUM_FORCE_NATIVE_FREE_CSS === '1'

/** This process's {@link CssCompilePath}. */
export const cssCompilePath = (): CssCompilePath =>
  usesNativeFreeCompiler() ? 'native-free' : 'postcss'

/**
 * What the ENGINE contributes to every stylesheet, as one string: its version,
 * the compile path, and the app-free source CSS it feeds the compiler (the
 * default token layer, the component and utility layers, and the `@font-face`
 * rules — whose URLs carry each font file's own content hash).
 *
 * The version covers everything that is not source text: the Tailwind release,
 * the native-free compiler, an emitter that only fires under a declared design.
 * The source text covers two builds that share a version number, so a font or
 * token change made between releases still moves the URL. The compile path
 * covers one version and one source text compiled two ways: a source run
 * forced onto the native-free engine emits the binary's bytes, not PostCSS's,
 * and a stamp blind to that would let a file from one path pass as the
 * other's. Exported for the test.
 *
 * @param version - the engine version.
 * @param sourceCss - the app-free source CSS (`buildSourceCSS()`).
 * @param compilePath - the compiling process's {@link cssCompilePath}.
 */
export const engineCssFingerprintOf = (
  version: string,
  sourceCss: string,
  compilePath: CssCompilePath
): string => `${version}:${compilePath}:${createHash('sha256').update(sourceCss).digest('hex')}`

/** Computed once per process: none of its inputs changes while it runs. */
let engineFingerprint: string | undefined

/** The running engine's {@link engineCssFingerprintOf}. */
export const engineCssFingerprint = (): string =>
  (engineFingerprint ??= engineCssFingerprintOf(
    getSovriumVersionSync(),
    buildSourceCSS(),
    cssCompilePath()
  ))

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
 * The paths needing a fresh app are the narrow set that use-case names. The
 * collapse is required because that set is non-empty.
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
 * It cannot be a bare `digest(OPERATOR_CONSOLE_CSS_KEY)` constant: the
 * design-system section draws the operator's system FLAT in the console
 * document, so the console's CSS carries a scoped copy of the
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
 * onto the console chrome ([internal ref] A4's runtime; the console design-cascade rule). The console's
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
  versionedCssHashOf(
    `${OPERATOR_CONSOLE_CSS_KEY}${designSystemScopeKey(app)}${mountIdentityKey(app)}${designCascadeKey(app)}`,
    engineCssFingerprint()
  )

/**
 * The 8-hex content hash of the app's compiled-CSS inputs and the engine
 * compiling them.
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
  const hash = isOperatorConsoleApp(app) ? consoleCssHash(app) : appCssInputsHash(app)
  hashByApp.set(app, hash)
  return hash
}

/**
 * Everything ONE compile of this engine depends on that the app contributes:
 * its design, its candidate set (the core utilities plus the component types
 * it declares and the classes it authors), and the scoped design system a
 * console surface carries. `compileCSS` keys its in-memory cache on this, and
 * the pre-compiled stamp is its digest under the engine fingerprint — ONE
 * expression for both, so a stamp can never claim a compile the cache would
 * not have reused. No app means the generic, app-free compile `compileCSSRaw()`
 * produces with no app.
 *
 * The scope segment is the empty string for every operator app, so it moves
 * no operator URL; it is there so a console surface, whose stylesheet carries
 * a token layer the operator's compile never does, can never key as the
 * operator's file.
 *
 * The Typeset segment is the empty string for every app whose stylesheet
 * carries Typeset (the generic compile included), and marks the apps whose
 * stylesheet leaves it out (`appSetsTypeset`): two configs alike in design and
 * candidates, one with a markdown page and one without, compile different bytes.
 *
 * `ECO_DESIGN_LAYER` is deliberately absent: it changes the engine's own
 * default layer, which the engine fingerprint already hashes.
 */
export const cssCompileKey = (app?: App): string =>
  getCSSCacheKey(app?.design, resolveNativeFreeCandidates(app)) +
  designSystemScopeKey(app) +
  (appSetsTypeset(app) ? '' : ':no-typeset')

/** The 8-hex digest of {@link cssCompileKey} under this engine. */
const appCssInputsHash = (app?: App): string =>
  versionedCssHashOf(cssCompileKey(app), engineCssFingerprint())

/** Per-`App`-instance memo of {@link precompiledStampOf}. */
const stampByApp = new WeakMap<App, string>()

/** {@link precompiledStampOf} with no app, computed once per process. */
let genericStamp: string | undefined

/**
 * The stamp `sovrium build` writes as the first line of a pre-compiled
 * stylesheet, and a later `start` compares against its own before serving it.
 *
 * It is {@link appCssInputsHash} — engine version, engine source CSS, design,
 * candidates, scoped design system — for every app alike, console included:
 * the stamp answers "would this engine compile these bytes for this config?",
 * which is a question about the compile and not about the URL, so the
 * console's shared URL identity ({@link consoleCssHash}) has no place in it.
 * A console surface scoped onto an operator app stamps differently from that
 * app — its compile carries the scoped token layer the operator's does not —
 * so the operator's file can never pass as the console's.
 *
 * Without the stamp a file left by an earlier engine or an earlier design was
 * served byte for byte after an upgrade, old tokens and all (issue #200).
 *
 * @param app - The parsed application schema; absent for the generic compile.
 */
export const precompiledStampOf = (app?: App): string => {
  if (app === undefined) return (genericStamp ??= appCssInputsHash())
  const cached = stampByApp.get(app)
  if (cached !== undefined) return cached
  const stamp = appCssInputsHash(app)
  stampByApp.set(app, stamp)
  return stamp
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
