/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Native-free CSS compiler.
 *
 * The standard CSS pipeline (`processWithPostCSS` in `./compiler.ts`) uses
 * `@tailwindcss/postcss`, which loads native `.node` addons (`@tailwindcss/oxide`,
 * `lightningcss`). `bun build --compile` cannot embed native addons, so that
 * pipeline crashes inside the standalone binary (issue #19).
 *
 * This module compiles the same theme-aware source CSS using Tailwind v4's
 * pure-JavaScript `compile()` engine instead — no native addons at runtime:
 *
 *   - `@import 'tailwindcss'` / `@import 'tw-animate-css'` are resolved from
 *     stylesheet constants embedded at build time (`generated-css-assets.ts`),
 *     since the binary has no node_modules.
 *   - The engine is *candidate-driven*: it only emits a utility's CSS if that
 *     class is in the candidate list. The native oxide scanner that normally
 *     discovers candidates by scanning the filesystem is unavailable, so the
 *     candidate list is the union of:
 *       1. BUILTIN_CSS_CANDIDATES — scanned from the Sovrium source tree at
 *          build time (covers components and client-side islands).
 *       2. classes authored in the operator's app config (`className` props).
 *   - `Polyfills.All` reproduces lightningcss's `@property` / `color-mix()`
 *     lowering in pure JS.
 *
 * This path is used only inside the compiled binary; from-source / npm-bundled
 * runs keep the native PostCSS pipeline (see `compileCSSRaw` in `./compiler.ts`).
 */

import typography from '@tailwindcss/typography'
import { Effect } from 'effect'
import { compile, type Polyfills } from 'tailwindcss'
import { designComponentClassCandidates } from '@/domain/models/app/design/components'
import {
  BUILTIN_CSS_CANDIDATES,
  TAILWIND_INDEX_CSS,
  TW_ANIMATE_CSS,
} from '@/infrastructure/css/generated-css-assets'
import { CSSCompilationError } from '@/infrastructure/errors/css-compilation-error'
import { logDebug } from '@/infrastructure/logging/logger'
import type { App } from '@/domain/models/app'
import type { CompiledCSS } from '@/infrastructure/css/cache/css-cache-service'

/**
 * Minimal, un-themed CSS served only when native-free compilation unexpectedly
 * fails inside the compiled binary. It is a bare reset — just enough to keep a
 * page legible instead of serving an empty stylesheet (issue #19, fail-fast).
 */
export const MINIMAL_FALLBACK_CSS = `/* Sovrium fallback styles — native-free CSS compilation failed. */
*, ::before, ::after { box-sizing: border-box; }
* { margin: 0; }
html { -webkit-text-size-adjust: 100%; line-height: 1.5; }
body { font-family: ui-sans-serif, system-ui, sans-serif; }
img, picture, video, canvas, svg { display: block; max-width: 100%; }
`

/**
 * Resolve a stylesheet referenced by an `@import` in the source CSS.
 *
 * `buildSourceCSS` only imports `tailwindcss` and `tw-animate-css`, and both
 * upstream stylesheets are self-contained (no nested `@import`s), so this
 * resolver handles exactly those two ids from embedded constants.
 */
const loadStylesheet = (
  id: string
): Promise<{ readonly path: string; readonly base: string; readonly content: string }> => {
  if (id === 'tailwindcss') {
    return Promise.resolve({ path: id, base: '/', content: TAILWIND_INDEX_CSS })
  }
  if (id === 'tw-animate-css') {
    return Promise.resolve({ path: id, base: '/', content: TW_ANIMATE_CSS })
  }
  return Promise.reject(
    new Error(
      `Native-free CSS compiler cannot resolve @import '${id}'. ` +
        'Only tailwindcss and tw-animate-css are embedded in the binary.'
    )
  )
}

/**
 * Resolve a JS plugin referenced by a `@plugin` directive in the source CSS.
 *
 * Inside the compiled binary there is no node_modules, so Tailwind v4's default
 * filesystem `@plugin` resolution fails. `buildSourceCSS` only declares
 * `@plugin "@tailwindcss/typography"`, whose module is statically imported above
 * (and therefore embedded in the binary by `bun build --compile`). This resolver
 * hands that already-loaded module back to the engine. Any other `@plugin` id is
 * rejected with an actionable error so a future plugin addition fails loudly
 * rather than silently emitting no CSS.
 */
const loadModule = (
  id: string
): Promise<{ readonly path: string; readonly base: string; readonly module: unknown }> => {
  if (id === '@tailwindcss/typography') {
    return Promise.resolve({ path: id, base: '/', module: typography })
  }
  return Promise.reject(
    new Error(
      `Native-free CSS compiler cannot resolve @plugin '${id}'. ` +
        'Only @tailwindcss/typography is embedded in the binary.'
    )
  )
}

/**
 * Extract Tailwind utility-class candidate tokens from a raw class string —
 * the value of a `className` / `class` property authored in an app config.
 *
 * A candidate is a whitespace-delimited token that could be a Tailwind utility.
 * Tailwind's `build()` ignores tokens that are not real utilities, so this only
 * needs to split sensibly; it does not need to validate.
 *
 * @param raw - A raw class string, e.g. `"flex items-center gap-2"`.
 * @returns The class tokens worth offering to the Tailwind engine.
 */
export const extractClassTokens = (raw: string): readonly string[] =>
  raw
    .split(/\s+/)
    // Drop empties (from leading/trailing/collapsed whitespace) and tokens that
    // contain `$` — those are render-time interpolation placeholders, not
    // literal utilities. The caller dedups across all strings globally.
    .filter((token) => token.length > 0 && !token.includes('$'))

/**
 * Recursively collect every class token authored in an app config object by
 * inspecting `className` / `class` string properties at any depth.
 *
 * Operators may put arbitrary Tailwind utilities in `className` props, so these
 * must be offered to the engine in addition to the build-time scan.
 */
const collectClassStrings = (node: unknown): readonly string[] => {
  if (Array.isArray(node)) {
    return node.flatMap(collectClassStrings)
  }
  if (node !== null && typeof node === 'object') {
    return Object.entries(node).flatMap(([key, value]) =>
      (key === 'className' || key === 'class') && typeof value === 'string'
        ? extractClassTokens(value)
        : collectClassStrings(value)
    )
  }
  return []
}

/**
 * Every class an app contributes beyond the build-time scan: the `className` /
 * `class` props authored anywhere in the config, PLUS `design.components`.
 *
 * The second half is not reachable by `collectClassStrings`, and that is worth
 * stating rather than implying: it walks for the KEYS `className` and `class`
 * with string values, so any other key holding classes is invisible to it and
 * the failure is silent — the class reaches the element, the stylesheet never
 * emits the utility, and nothing paints. `design.components` holds its classes
 * under `parts` / `variants` / `states`, none of which is that key, and its
 * `states` entries additionally need their variant prefix applied before they
 * are offered to the engine — the prefixed form, not the bare one. Both are
 * handled by `designComponentClassCandidates`, which lives beside the state
 * vocabulary in the domain so the harvest and the renderer cannot drift.
 */
const collectAppCandidates = (app?: App): readonly string[] => [
  ...collectClassStrings(app),
  ...designComponentClassCandidates(app?.design?.components),
]

/**
 * Resolve the full candidate list for native-free compilation: the build-time
 * source-tree scan unioned with the classes authored in the operator's app.
 */
export const resolveNativeFreeCandidates = (app?: App): readonly string[] => [
  ...new Set([...BUILTIN_CSS_CANDIDATES, ...collectAppCandidates(app)]),
]

/**
 * Whether the app authors any utility class NOT already covered by the
 * build-time `BUILTIN_CSS_CANDIDATES` scan.
 *
 * The default-theme pre-compiled CSS (`compileCSSRaw()` with no app) is built
 * from the builtin candidate set ONLY. Serving that file for a themeless app is
 * sound *only* when the app contributes no extra candidates — otherwise classes
 * the app uses but the builtin scan never saw (e.g. `max-w-6xl` or an arbitrary
 * `grid-cols-[…]` authored in a test/operator fixture, which the scan excludes
 * because it only covers `src`+`templates`+`src/admin`) are silently dropped from the served
 * CSS, breaking layout. When this returns `true`, callers MUST compile per-app
 * instead of reusing the pre-compiled file.
 */
export const appAddsCandidatesBeyondBuiltin = (app?: App): boolean => {
  const builtin = new Set<string>(BUILTIN_CSS_CANDIDATES)
  return collectAppCandidates(app).some((token) => !builtin.has(token))
}

/**
 * Compile theme-aware source CSS using Tailwind v4's pure-JS engine, with no
 * native addons. Intended for use inside the compiled standalone binary.
 *
 * @param sourceCSS - The theme-aware source CSS from `buildSourceCSS(theme)`.
 * @param app - The app config; its `className` props widen the candidate set.
 * @returns An Effect yielding the compiled CSS, or a `CSSCompilationError`.
 */
export const compileCSSNativeFree = (
  sourceCSS: string,
  app?: App
): Effect.Effect<CompiledCSS, CSSCompilationError> =>
  Effect.tryPromise({
    try: async () => {
      const candidates = resolveNativeFreeCandidates(app)
      logDebug(`[CSS] Native-free compile — ${candidates.length} candidates`)
      const compiled = await compile(sourceCSS, {
        base: '/',
        // `3` is Polyfills.All (AtProperty | ColorMix lowering, pure JS).
        // Referenced as a literal because verbatimModuleSyntax forbids reading
        // tailwindcss's ambient `const enum` value.
        polyfills: 3 as Polyfills,
        loadStylesheet,
        // Resolves `@plugin "@tailwindcss/typography"` from the statically
        // imported (binary-embedded) module — no filesystem lookup.
        loadModule: loadModule as NonNullable<Parameters<typeof compile>[1]>['loadModule'],
      })
      const css = compiled.build([...candidates])
      logDebug(`[CSS] Native-free compile produced ${css.length} bytes`)
      return { css, timestamp: Date.now() }
    },
    catch: (error) => new CSSCompilationError(error),
  })
