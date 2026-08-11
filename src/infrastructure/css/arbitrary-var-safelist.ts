/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Tailwind arbitrary-value safelist generator for the runtime-template-literal
 * classes built via `v('sv-X', T.Y)` in the `*-default-classes.ts` recipes.
 * These recipes live in TWO directories — both must be scanned:
 *   - `src/presentation/islands/` — client-hydrated island recipes
 *   - `src/presentation/ui/sections/renderers/element-renderers/` — the SSR
 *     element recipes (button/input/forms/…). These were silently missed when
 *     this generator scanned only the islands dir, so recipe-only arbitrary
 *     classes (e.g. the input error-state `border-[var(--sv-error-solid,…)]`)
 *     were never emitted and fell through to the `@layer components` base
 *     `input{…}` rule. That base rule resolves under `ECO_DESIGN_LAYER=on`
 *     (token layer present) but to `currentColor` under `off` — breaking the
 *     with≡without parity (contract-without-theme-layer.spec.ts).
 *
 * ## Why this exists
 * Recipes compose classes like:
 *   `` `bg-[${v('sv-primary', T.primary)}]` ``
 *
 * At module-load these resolve to deterministic literal strings such as
 *   `bg-[var(--sv-primary,oklch(0.205_0.008_40))]`
 *
 * but Tailwind's content scanner only sees the template SOURCE (the
 * `${…}` placeholder), not the resolved value — so it never generates a
 * matching CSS rule. The element then paints with no background on
 * platforms where the @theme tokens haven't supplied a default, which is
 * exactly what fired on `[internal ref]` for the design-system
 * @regression suite (transparent select trigger, context-menu popup,
 * comments thread surface, ai-chat send button, etc.).
 *
 * ## The fix
 * Scan every `*-default-classes.ts` source file at compile time, regex-extract
 * every `(variant?)(prop)-[${v('sv-X', T.Y)}]` occurrence, resolve T.Y by
 * regex-parsing `css-var.ts`'s `TOKENS` literal, and emit the resulting
 * concrete class strings to the compiler's `@source inline(...)` safelist.
 * Drift-resistant: any new `v('sv-X', T.Y)` call in an island is picked up
 * automatically. A co-located test pins the expected size and a few canonical
 * classes so regex / TOKENS-extractor drift fails the unit suite.
 *
 * ## Boundary note
 * Compiler lives in `src/infrastructure/`; the source-of-truth files live
 * under `src/presentation/`. We read them via `node:fs` rather than `import`
 * to avoid the infra → presentation import boundary violation that
 * `eslint-plugin-boundaries` would flag.
 *
 * ## Binary-mode safety
 * In the compiled standalone-binary mode, `src/` isn't on disk (assets are
 * baked in). In that mode the JS bundle ALREADY contains the resolved class
 * strings as literals (because `withVarFallback` runs at module load before
 * bundling), so Tailwind's source scan picks them up natively. The
 * fs.readdir guard returns an empty safelist when the source tree is
 * absent — correct behaviour, not a fallback.
 */

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Directories holding the `*-default-classes.ts` recipes whose runtime
 * `v('sv-X', T.Y)` template literals must be safelisted. BOTH are scanned —
 * the SSR element recipes under `element-renderers/` were originally omitted
 * (see the file header), which dropped recipe-only arbitrary classes such as
 * the input error-state border from the compiled CSS.
 */
const RECIPE_DIRS = [
  join(import.meta.dir, '../../presentation/islands'),
  join(import.meta.dir, '../../presentation/ui/sections/renderers/element-renderers'),
  // Shared recipes reachable by BOTH islands and ui/sections (the navbar badge +
  // nav-menu trigger recipe lives here because neither presentation side can
  // import the other — see navbar-default-classes.ts). Same `*-default-classes.ts`
  // scan contract.
  join(import.meta.dir, '../../presentation/utils/recipes'),
] as const
const CSS_VAR_PATH = join(import.meta.dir, '../../presentation/utils/design/css-var.ts')

/**
 * Matches `(variant?)(prop)-[${v('sv-X', T.Y)}]`.
 *
 *   - `((?:[a-z][\w-]*:)*)` — optional variant chain (hover:, focus-visible:,
 *     aria-expanded:, dark:, … possibly stacked).
 *   - `([a-z][\w-]*)` — Tailwind property prefix (bg, text, border, ring,
 *     rounded, shadow, duration, ease, …).
 *   - `\$\{v\(\s*'sv-([\w-]+)'\s*,\s*T\.(\w+)\s*\)\}` — captures the var
 *     name (without `sv-` prefix) and the TOKENS key.
 */
const CLASS_USE_PATTERN =
  /((?:[a-z][\w-]*:)*)([a-z][\w-]*)-\[\$\{v\(\s*'sv-([\w-]+)'\s*,\s*T\.(\w+)\s*\)\}\]/g

/**
 * Matches lines inside the `TOKENS` literal: `  someKey: 'string value',`.
 * Multi-line / non-string entries (none currently — TOKENS is flat) are
 * intentionally ignored.
 */
const TOKEN_ENTRY_PATTERN = /^\s*(\w+):\s*['"]([^'"]+)['"]/gm

/**
 * Mirror of `withVarFallback` from `css-var.ts`. Duplicated INTENTIONALLY to
 * keep `src/infrastructure/` free of presentation-layer imports. The
 * co-located test pins both sides to the same output for the canonical
 * tokens, so any future divergence in `css-var.ts` fails loudly.
 */
function withVarFallback(varName: string, fallback: string): string {
  return `var(--${varName},${fallback.replace(/ /g, '_')})`
}

/** Read a file as UTF-8, returning `undefined` if it isn't on disk (binary mode). */
function readFileOrUndefined(path: string): string | undefined {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return undefined
  }
}

/**
 * Parse `css-var.ts` and return its `TOKENS` map as `name → fallback string`.
 * Empty record if the file isn't readable (binary mode).
 */
function loadTokens(): Readonly<Record<string, string>> {
  const src = readFileOrUndefined(CSS_VAR_PATH)
  if (src === undefined) return {}
  const declStart = src.indexOf('export const TOKENS')
  if (declStart === -1) return {}
  const declEnd = src.indexOf('\n} as const', declStart)
  const body = declEnd === -1 ? src.slice(declStart) : src.slice(declStart, declEnd)
  return Array.from(body.matchAll(TOKEN_ENTRY_PATTERN)).reduce<Readonly<Record<string, string>>>(
    (map, [, key, value]) => {
      if (key === undefined || value === undefined) return map
      if (key === 'export' || key === 'const') return map
      return { ...map, [key]: value }
    },
    {}
  )
}

/**
 * Generate the literal Tailwind arbitrary-value class strings that the
 * runtime `v()` template literals produce in islands. The returned array is
 * de-duplicated and stable across calls (so callers can compose deterministic
 * `@source inline(...)` directives).
 */
function readRecipeFiles(): readonly string[] {
  return RECIPE_DIRS.flatMap((dir) => walkRecipeDir(dir))
}

/**
 * Recursively collect every `*-default-classes.ts` file under `dir`.
 *
 * Recursive (rather than a single non-recursive `readdirSync`) because island
 * recipes are now grouped into feature subdirectories (overlays/, form-controls/,
 * recipes/, …) — a flat scan would silently drop the moved recipes from the
 * compiled CSS safelist (the exact failure this generator exists to prevent).
 *
 * Binary-mode safe: the `try/catch` returns an empty list when the source tree
 * isn't on disk (compiled standalone binary), matching the original behaviour.
 */
function walkRecipeDir(dir: string): readonly string[] {
  try {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) return walkRecipeDir(path)
      return entry.name.endsWith('-default-classes.ts') ? [path] : []
    })
  } catch {
    return []
  }
}

/** Extract the resolved arbitrary-value classes a single island source contributes. */
function classesForSource(
  src: string,
  tokens: Readonly<Record<string, string>>
): readonly string[] {
  return Array.from(src.matchAll(CLASS_USE_PATTERN)).flatMap(
    ([, variant, property, svSuffix, tokenKey]) => {
      if (property === undefined || svSuffix === undefined || tokenKey === undefined) return []
      const fallback = tokens[tokenKey]
      if (fallback === undefined) return []
      const varExpr = withVarFallback(`sv-${svSuffix}`, fallback)
      return [`${variant ?? ''}${property}-[${varExpr}]`]
    }
  )
}

export function generateArbitraryVarSafelist(): readonly string[] {
  const files = readRecipeFiles()
  if (files.length === 0) return []
  const tokens = loadTokens()
  if (Object.keys(tokens).length === 0) return []
  const classes = files.flatMap((path) => classesForSource(readFileSync(path, 'utf8'), tokens))
  return [...new Set(classes)].toSorted()
}
