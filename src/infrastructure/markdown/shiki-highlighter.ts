/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Shiki SSR syntax highlighter ([internal ref], cluster 2).
 *
 * Splices class-based, token-coloured `<pre><code>` markup into the placeholder
 * fences emitted by the domain markdown renderer (`<pre><code … data-md-code="N">`).
 *
 * **Sanitisation invariant (critical — [internal ref]):** the canonical
 * `sanitizeRichTextHTML` allowlist drops the `style` attribute. Shiki's default
 * output paints token colors via inline `style="color:#xxx"`; if those survived
 * to the sanitiser, every token would render uncoloured (or, worse, an attempt
 * to widen the allowlist would re-open CSS-injection). The transformer here
 * therefore:
 *
 *  1. Strips inline `style` from `<pre>` (background/foreground come from the
 *     code-block CSS generator instead — see `code-block-styles-generator.ts`).
 *  2. Converts every per-token `style="color:#XXXXXX"` to a `tok-XXXXXX` class
 *     and removes the `style` attribute. The matching `.tok-XXXXXX{color:…}`
 *     rules are emitted into the page's compiled stylesheet by the code-block
 *     CSS generator — never inline, so the sanitiser cannot strip them.
 *
 *  Net result: `pre code span[class]` exists, no element carries `style`, and
 *  the active theme name is reflected as a class on the `<pre>` (e.g.
 *  `<pre class="shiki nord …">`) so spec selectors like `[class*="nord"]`
 *  match.
 *
 * **Unknown language → graceful degrade.** Shiki rejects unsupported langs
 * with an exception; the highlighter catches that and returns a plain
 * `<pre><code class="language-X">{escaped}</code></pre>` so the page still
 * renders. The same path handles tagless fences.
 *
 * **Async + lazy.** Shiki loads grammars/themes via dynamic `import()`. To
 * keep the import out of the binary's load graph until first use (issue #19
 * parity), we resolve the highlighter module with a deferred
 * `await import('shiki')`. A process-wide cached `codeToHtml` is built on
 * first call and reused for subsequent renders.
 */

import { logDebug, logWarning } from '@/infrastructure/logging/logger'

/**
 * Default Shiki theme used when `app.theme.codeBlock.theme` is unset. Matches
 * the test fixture default (`'github-dark'`) so [internal ref] and
 * [internal ref] hold without explicit configuration.
 */
const DEFAULT_THEME = 'github-dark'

/**
 * Encode the verbatim source for use inside the un-highlighted fallback
 * placeholder. Identical to the renderer's own escaper, inlined to keep the
 * infrastructure module's external surface to one well-known dependency
 * (shiki) plus internal helpers.
 */
const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

/**
 * Shape of the cached Shiki highlighter — keyed by theme to avoid rebuilding
 * the engine on every render. Re-entry-safe: concurrent calls during the
 * first build await the same in-flight promise.
 *
 * The map intentionally does NOT track loaded languages — Shiki's
 * `getSingletonHighlighter` lazily loads on-demand, and the API surface we
 * use (`codeToHtml` with `lang`/`theme`) accepts dynamic language names so
 * long as the langage is in the bundled set.
 */
const HIGHLIGHTER_CACHE = new Map<string, Promise<ShikiCodeToHtml>>()

/**
 * Minimal shape of the function we need from Shiki — exposing only what the
 * highlighter pipeline uses prevents accidental coupling to the rest of the
 * Shiki surface (the engine state, individual grammar loaders, …).
 */
type ShikiCodeToHtml = (code: string, options: ShikiOptions) => Promise<string>

interface ShikiOptions {
  readonly lang: string
  readonly theme: string
  readonly transformers?: readonly ShikiTransformerLike[]
}

/**
 * Local mirror of Shiki's transformer surface that we actually use. Keeping
 * this here means the rest of the codebase never has to import Shiki types
 * just to read this module.
 *
 * The hast node passed to transformer hooks is mutated by Shiki's pipeline
 * (and by the transformer itself — `addClassToHast` writes `properties.class`,
 * `delete hast.properties.style` writes `properties.style`). The
 * `functional/prefer-immutable-types` rule would force these signatures to
 * `Readonly<…>`, contradicting Shiki's documented hook semantics — so the
 * rule is disabled on the type declarations below rather than at every call
 * site.
 */
/* eslint-disable functional/prefer-immutable-types -- hast nodes are mutated by Shiki's transformer pipeline by design */
interface ShikiTransformerLike {
  readonly name?: string
  readonly pre?: (this: ShikiContextLike, hast: HastElement) => HastElement | void
  readonly span?: (this: ShikiContextLike, hast: HastElement) => HastElement | void
}

interface ShikiContextLike {
  readonly addClassToHast: (hast: HastElement, className: string) => HastElement
}

interface HastElement {
  readonly type: 'element'
  readonly tagName: string
  properties?: Record<string, unknown>
}
/* eslint-enable functional/prefer-immutable-types */

/**
 * Resolve (and lazily build) a Shiki `codeToHtml` bound to the given theme.
 *
 * The first call per theme dynamically `import()`s shiki — keeping the native
 * grammar bundle out of the binary's load graph until a markdown page with a
 * highlighted block actually renders. Subsequent calls re-use the cached
 * promise.
 */
const getShikiForTheme = (theme: string): Promise<ShikiCodeToHtml> => {
  const cached = HIGHLIGHTER_CACHE.get(theme)
  if (cached !== undefined) return cached
  const building = (async () => {
    logDebug(`[shiki] Initialising highlighter (theme=${theme})`)
    const shiki = (await import('shiki')) as { codeToHtml: ShikiCodeToHtml }
    return shiki.codeToHtml
  })()
  // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements -- module-level cache, mutation here is the cache update; thread-safety not a concern (single-threaded JS)
  HIGHLIGHTER_CACHE.set(theme, building)
  return building
}

/**
 * Convert an inline `style="…color:#XXXXXX…"` attribute into a `tok-XXXXXX`
 * class on the same hast node, then drop the `style` attribute entirely. Any
 * other style declarations are also dropped — they would be stripped by the
 * sanitiser anyway and are not part of the highlighted-token contract.
 *
 * `class` already present on the node is preserved (shiki applies `line` to
 * line wrappers; the spec relies on `pre code span[class]` matching both
 * line wrappers and token spans).
 */
const COLOR_RE = /color\s*:\s*#([0-9a-fA-F]{3,8})/
const styleToColorClass = (style: string): string | undefined => {
  const match = COLOR_RE.exec(style)
  if (match === null) return undefined
  const hex = match[1]
  if (hex === undefined) return undefined
  return `tok-${hex.toUpperCase()}`
}

/**
 * Build the class-based transformer described in the module-doc. Pre-built so
 * each highlight call reuses the same shapes (no per-call allocation cost
 * inside the hot path).
 */
/* eslint-disable functional/immutable-data, functional/no-expression-statements -- hast node mutation is the documented Shiki transformer API; these closures ARE side-effect-only */
const CLASS_BASED_TRANSFORMER: ShikiTransformerLike = {
  name: 'sovrium-class-based',
  pre(hast) {
    // Drop background/foreground style — colors come from the code-block CSS
    // generator. Keep the `class="shiki <themeName>"` Shiki already wrote so
    // selectors like `[class*="nord"]` match.
    if (hast.properties !== undefined) {
      delete hast.properties.style
    }
  },
  span(hast) {
    const style = (hast.properties?.style as string | undefined) ?? ''
    const colorClass = styleToColorClass(style)
    if (colorClass !== undefined) {
      this.addClassToHast(hast, colorClass)
    }
    // Drop ALL inline style on token spans regardless of whether we mapped a
    // color — uncolored tokens (whitespace) must not carry residual style.
    if (hast.properties !== undefined && 'style' in hast.properties) {
      delete hast.properties.style
    }
  },
}
/* eslint-enable functional/immutable-data, functional/no-expression-statements */

/**
 * Render a single fenced code-block to highlighted HTML. Returns an
 * un-highlighted (escaped) fallback `<pre><code>` block on any failure so a
 * single missing grammar never crashes the page render.
 */
const highlightOne = async (
  codeToHtml: ShikiCodeToHtml,
  lang: string,
  code: string,
  theme: string
): Promise<string> => {
  if (lang.length === 0) {
    // Tagless fences degrade to plain escaped output — Shiki would reject an
    // empty lang and we want a clean structural pre/code anyway.
    return `<pre><code>${escapeHtml(code)}</code></pre>`
  }
  try {
    return await codeToHtml(code, {
      lang,
      theme,
      transformers: [CLASS_BASED_TRANSFORMER],
    })
  } catch (error) {
    logWarning(
      `[shiki] Failed to highlight ${lang} block (theme=${theme}); falling back to plain pre/code: ${
        error instanceof Error ? error.message : String(error)
      }`
    )
    return `<pre><code class="language-${escapeHtml(lang)}">${escapeHtml(code)}</code></pre>`
  }
}

/**
 * Stamp a fence's ORDINAL onto its highlighted `<pre>` as a class.
 *
 * The presentation layer wraps each fence in code-block chrome (a header naming
 * the file, a copy button) AFTER the canonical sanitiser has run — the sanitiser
 * strips `<button>` and every `data-*` attribute by design (security rule S2), so
 * the chrome cannot be emitted before it. That splice still has to know WHICH
 * fence it is looking at, to pair the `<pre>` with its `{ lang, title }` entry.
 *
 * A class is the only carrier that survives the trip: the allowlist keeps `class`
 * on every tag and drops `data-*`. `sv-md-code-N` is a plain author selector,
 * never a Tailwind utility, so it needs no candidate-corpus entry.
 */
const withFenceIndexClass = (html: string, index: number): string => {
  const marker = `sv-md-code-${index}`
  const stamped = html.replace(/^(<pre\b[^>]*?\bclass=")/, `$1${marker} `)
  if (stamped !== html) return stamped
  return html.replace(/^<pre\b/, `<pre class="${marker}"`)
}

/**
 * Match the renderer's `<pre><code … data-md-code="N">…</code></pre>` block,
 * non-greedily across newlines. The renderer always emits the placeholder
 * on a single logical block so a single back-reference span suffices.
 */
const PLACEHOLDER_RE =
  /<pre><code(?:\s+class="[^"]*")?\s+data-md-code="(\d+)">[\s\S]*?<\/code><\/pre>/g

/**
 * Splice highlighted HTML into every `data-md-code="N"` placeholder in the
 * supplied HTML. Returns the composed HTML — input is returned verbatim when
 * `codeBlocks` is empty (no fenced blocks in the source).
 *
 * The active theme is taken from `theme.codeBlock.theme`; an unset value or a
 * missing `theme.codeBlock` block defaults to `DEFAULT_THEME` so spec fixtures
 * that omit `theme.codeBlock` still get colorisation.
 */
export const highlightCodeBlocks = async (
  html: string,
  codeBlocks: readonly { readonly lang: string; readonly code: string }[],
  theme: string | undefined
): Promise<string> => {
  if (codeBlocks.length === 0) return html
  const activeTheme = theme && theme.length > 0 ? theme : DEFAULT_THEME
  const codeToHtml = await getShikiForTheme(activeTheme)

  // Highlight every block once up-front so the `replace` callback is sync
  // (it is invoked once per placeholder during the regex scan).
  const highlighted = await Promise.all(
    codeBlocks.map(async ({ lang, code }, index) =>
      withFenceIndexClass(await highlightOne(codeToHtml, lang, code, activeTheme), index)
    )
  )

  return html.replace(PLACEHOLDER_RE, (_match, idxStr: string) => {
    const idx = Number(idxStr)
    return highlighted[idx] ?? _match
  })
}

/**
 * Highlight a single `{ lang, code }` block to Shiki class-based markup, reusing
 * the exact same highlighter engine + `CLASS_BASED_TRANSFORMER` as the markdown
 * fence path (`highlightCodeBlocks`).
 *
 * The standalone `code` COMPONENT pre-highlight pass ([internal ref]..033)
 * carries each block's `lang`+source in a self-contained SSR placeholder rather
 * than the side `codeBlocks` array the markdown renderer produces, so it splices
 * per-block instead of by index — but the token contract is identical: no inline
 * `style`, `tok-XXXXXX` colour classes, and the `shiki <themeName>` class on the
 * `<pre>`. An unknown grammar degrades to a plain escaped `<pre><code>` via the
 * shared `highlightOne` fallback (mirrors [internal ref] /
 * [internal ref]). `getShikiForTheme` is cached per theme, so calling
 * this once per block on a page costs a single engine build.
 */
export const highlightCodeToHtml = async (
  lang: string,
  code: string,
  theme: string | undefined
): Promise<string> => {
  const activeTheme = theme && theme.length > 0 ? theme : DEFAULT_THEME
  const codeToHtml = await getShikiForTheme(activeTheme)
  return highlightOne(codeToHtml, lang, code, activeTheme)
}
