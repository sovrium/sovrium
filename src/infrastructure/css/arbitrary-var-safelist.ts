/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Tailwind arbitrary-value safelist generator for the runtime-template-literal
 * classes built via `v('sv-X', T.Y)` in the `*-default-classes.ts` recipes.
 * Read the directory list off `RECIPE_DIRS` below rather than from prose — this
 * paragraph said "TWO directories" for as long as there were three, then named
 * three for as long as there have been two. What each one is there for:
 *   - `src/presentation/islands/` — client-hydrated island recipes
 *   - `src/presentation/design/` — every recipe the SERVER renders, plus every
 *     recipe BOTH sides share, since W6 merged those two directories into one.
 *     It holds the SSR element recipes (button/input/forms/…), which were
 *     silently missed when this generator scanned only the islands dir: the
 *     recipe-only arbitrary classes (e.g. the input error-state
 *     `border-[var(--sv-error-solid,…)]`) were never emitted and fell through
 *     to the `@layer components` base `input{…}` rule, which resolves under
 *     `ECO_DESIGN_LAYER=on` (token layer present) but to `currentColor` under
 *     `off` — breaking the with≡without parity
 *     (contract-without-theme-layer.spec.ts). And it holds the shared recipes,
 *     which can live nowhere else: `eslint-plugin-boundaries` forbids the
 *     islands and the SSR tree from importing each other, so a recipe both need
 *     has exactly one home. Missing this dir drops both sets at once.
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
 * every `(variant?)(prop)-[${v('VAR', T.Y)}]` occurrence, resolve T.Y by
 * regex-parsing the generated `TOKENS` literal, and emit the resulting
 * concrete class strings to the compiler's `@source inline(...)` safelist.
 * Drift-resistant: any new `v(…)` call in a recipe is picked up automatically.
 * `VAR` is captured WHOLE, across namespaces — colour reads name `--sv-*`, the
 * tenant override channel, while shape and depth name `--radius-*` /
 * `--shadow-*` directly. A co-located test pins the expected size and one
 * canonical class per namespace, so regex / TOKENS-extractor drift fails the
 * unit suite rather than silently dropping a family.
 *
 * ## Boundary note
 * Compiler lives in `src/infrastructure/`; the source-of-truth files live
 * under `src/presentation/`. We read them via `node:fs` rather than `import`
 * to avoid the infra → presentation import boundary violation that
 * `eslint-plugin-boundaries` would flag.
 *
 * ## Binary-mode safety
 * In the compiled standalone-binary mode, `src/` isn't on disk (assets are
 * baked in), so the fs.readdir guard returns an empty safelist. That is correct
 * behaviour rather than a fallback — but NOT for the reason this paragraph used
 * to give. It claimed the bundle already carries the resolved literals, so
 * "Tailwind's source scan picks them up natively". The binary compiles through
 * `native-free-compiler.ts`, whose own header records that the native oxide
 * scanner is unavailable there: nothing scans anything at binary runtime.
 *
 * What actually protects the binary is the BUILD-TIME bake.
 * `scripts/build/generate-css-assets.ts` calls this generator while `src/` IS on
 * disk, unions the result into `BUILTIN_CSS_CANDIDATES`, and commits it to
 * `generated-css-assets.ts`; the binary then compiles candidate-driven from that
 * frozen set. So a class this extractor misses is missing from the binary's CSS
 * for good — which is why that script guards fail-closed twice, throwing on an
 * empty safelist and again on one carrying no popup surface sentinel. The
 * `Generated Assets Drift` gate keeps the committed set in sync.
 *
 * Practical consequence: the coverage here is a BUILD-time contract, not a
 * runtime one. Narrowing `RECIPE_DIRS` or `CLASS_USE_PATTERN` silently shrinks
 * what the shipped binary is able to paint.
 */

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Directories holding the `*-default-classes.ts` recipes whose runtime
 * `v('sv-X', T.Y)` template literals must be safelisted. BOTH are scanned, and
 * `walkRecipeDir` recurses, so a recipe in a subdirectory is still found.
 *
 * THREE DIRECTORIES BECAME TWO IN W6, and the count is the only thing that
 * changed. The SSR element recipes (`ui/sections/renderers/element-renderers/`)
 * and the shared recipes (`utils/recipes/`) both landed in the ONE neutral leaf
 * `presentation/design/`, which is what that directory exists for: a recipe
 * reachable by BOTH an island and an SSR renderer cannot live in either tree,
 * because the two may not import each other. Measured across the move: 28
 * `*-default-classes.ts` files in, 28 out, and the emitted candidate corpus
 * identical to the byte — 0 added, 0 removed across 40,087 candidates.
 *
 * THESE ARE ASSEMBLED FROM SEGMENTS AND NO REWRITER CAN SEE THEM. Neither
 * `apply-moves.ts` (which rewrites what the compiler resolves) nor
 * `rewrite-path-literals.ts` (whose corpus is `scripts/`, `[internal ref]`, baselines
 * and prose — never `src/`) touches this file. A wave that moves a recipe
 * directory and misses these three lines produces NO error at all: the scan
 * returns nothing, the arbitrary classes never reach the stylesheet, and the
 * only symptom is an unstyled state somewhere on a page nobody opened.
 */
const RECIPE_DIRS = [
  join(import.meta.dir, '../../presentation/islands'),
  join(import.meta.dir, '../../presentation/design'),
] as const
/**
 * The `TOKENS` literal, read as TEXT (see the boundary note above).
 *
 * It moved out of `css-var.ts` when the default design system became one
 * generated source: `css-var.ts` is now a re-export shim carrying
 * `withVarFallback` and the prose, and the literal this parser needs lives in
 * the generated catalogue beside it. Pointing at the shim would parse a file
 * with no `TOKENS` literal in it and throw the empty-safelist guard — which is
 * exactly what happened, and is the correct failure.
 */
const CSS_VAR_PATH = join(import.meta.dir, '../../presentation/design/tokens.generated.ts')

/**
 * Matches `(variant?)(prop)-[${v('VAR', T.Y)}]`.
 *
 *   - `((?:[a-z][\w-]*:)*)` — optional variant chain (hover:, focus-visible:,
 *     aria-expanded:, dark:, … possibly stacked).
 *   - `([a-z][\w-]*)` — Tailwind property prefix (bg, text, border, ring,
 *     rounded, shadow, duration, ease, …).
 *   - `\$\{v\(\s*'([\w-]+)'\s*,\s*T\.(\w+)\s*\)\}` — captures the FULL variable
 *     name and the TOKENS key.
 *
 * The variable name is captured whole rather than as a suffix after a literal
 * `sv-`, because the recipes no longer all sit on one namespace. Colour reads
 * stay on `--sv-*`, the tenant override channel; shape and depth reads name
 * `--radius-*` / `--shadow-*` directly, which is where `design.radius` and
 * `design.elevation` actually land. A pattern anchored on `sv-` silently
 * skipped every one of the latter, and a skipped class is not a missing
 * safelist ENTRY — it is a missing CSS RULE, so the element paints nothing.
 */
const CLASS_USE_PATTERN =
  /((?:[a-z][\w-]*:)*)([a-z][\w-]*)-\[\$\{v\(\s*'([\w-]+)'\s*,\s*T\.(\w+)\s*\)\}\]/g

/**
 * Matches lines inside the `TOKENS` literal: `  someKey: 'string value',`.
 * Multi-line / non-string entries (none currently — TOKENS is flat) are
 * intentionally ignored.
 */
const TOKEN_ENTRY_PATTERN = /^\s*(\w+):\s*['"]([^'"]+)['"]/gm

/**
 * Mirror of `withVarFallback` from `css-var.ts` (which still owns it).
 * Duplicated INTENTIONALLY to
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
 * Parse the generated catalogue and return its `TOKENS` map as `name → fallback string`.
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
    ([, variant, property, varName, tokenKey]) => {
      if (property === undefined || varName === undefined || tokenKey === undefined) return []
      const fallback = tokens[tokenKey]
      if (fallback === undefined) return []
      const varExpr = withVarFallback(varName, fallback)
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
