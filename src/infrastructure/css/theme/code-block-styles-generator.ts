/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Code-block chrome stylesheet generator (the pages layout markdown pages requirement,
 * cluster 2).
 *
 * The Shiki highlighter (`infrastructure/markdown/shiki-highlighter.ts`)
 * emits `<pre class="shiki shiki-themes github-light github-dark"><code>…<span
 * class="tok-XXXXXX tok-dark-XXXXXX">…</span>…</code></pre>` markup with NO
 * inline `style` attribute (the canonical sanitiser strips `style`, so colors
 * are delivered via classes only). Every app draws shadcn/ui's default pair,
 * `github-light` and `github-dark`; `design.codeBlock` is deprecated and
 * ignored, so every app gets this same stylesheet. It emits:
 *
 *  - Container chrome on `pre.shiki` (background, padding, radius, font): a
 *    LIGHT chrome (the `--color-muted` token) for `github-light`, and under the
 *    dark scheme a DARK chrome (near-black `#0d0d0d`, light `#e1e4e8` text) so
 *    `github-dark`'s light token colours stay legible. The chrome is the same on
 *    every surface — config `code` components AND generic markdown fences. The
 *    docs layout draws its fences with this same chrome: Typeset leaves a
 *    `data-slot` frame alone.
 *  - A curated set of `.tok-XXXXXX { color: #XXXXXX }` rules for the light
 *    half; an uncovered token renders in the chrome's ink, legible if
 *    monochrome (the unknown-language fallback's contract).
 *
 * The CSS is injected into `buildSourceCSS` in `infrastructure/css/compiler.ts`
 * so it flows through BOTH compile paths:
 *  1. the native PostCSS pipeline (from-source / npm-bundled), and
 *  2. the pure-JS native-free engine (compiled-binary path, issue #19).
 *
 *  - A dark-scheme arm repeating both of the above for `github-dark`.
 *
 * Its selectors (`pre.shiki`, `.tok-XXXXXX`, `.tok-dark-XXXXXX`) are plain CSS,
 * not utilities, so they need no `BUILTIN_CSS_CANDIDATES` entry.
 */

import {
  DEFAULT_CODE_BLOCK_DARK_THEME,
  DEFAULT_CODE_BLOCK_THEME,
} from '@/domain/models/app/design/code-block-service'
import { flooredPalette } from './code-block-theme-palette'

/**
 * The curated token colours of each theme, keyed by the hex the highlighter
 * writes into its class: `tok-XXXXXX` for the light half, `tok-dark-XXXXXX`
 * for the dark half. Each list holds only colours its own theme declares, so
 * every rule can match a span; a hex the other theme owns would never be
 * written into that half's class. The light list covers every colour
 * `github-light` declares, so no light token falls back to the chrome's ink;
 * the dark arm adds every other colour `github-dark` declares on top
 * (`loadCodeBlockDarkPalette`).
 *
 * Keys are uppercased hex (with no `#`) to match the highlighter's class output.
 */
const LIGHT_TOKEN_COLORS: Readonly<Record<string, string>> = {
  '6A737D': '#6A737D', // comments
  D73A49: '#D73A49', // keywords
  '6F42C1': '#6F42C1', // functions
  '24292E': '#24292E', // text
  '032F62': '#032F62', // strings
  '005CC5': '#005CC5', // constants
  '22863A': '#22863A', // tags
  E36209: '#E36209', // variables, parameters, list bullets, diff changes
  B31D28: '#B31D28', // invalid code, diff deletions
  '586069': '#586069', // bracket highlights
  FAFBFC: '#FAFBFC', // carriage return (`^M`), floored below
  F6F8FA: '#F6F8FA', // ignored and untracked diff lines, floored below
}

const DARK_TOKEN_COLORS: Readonly<Record<string, string>> = {
  F97583: '#F97583', // keywords
  '79B8FF': '#79B8FF', // identifiers
  '9ECBFF': '#9ECBFF', // strings
  B392F0: '#B392F0', // functions
  '85E89D': '#85E89D', // types
  E1E4E8: '#E1E4E8', // text
  '6A737D': '#6A737D', // comments
  '24292E': '#24292E', // carriage return (`^M`), floored below
}

/**
 * Where a theme's own token colour falls under 4.5:1 on the block it is drawn
 * on, the colour it is drawn in instead — the nearest tone of the same hue that
 * reaches it. Keyed by the token's `tok-XXXXXX` hex, one table per scheme.
 *
 * The same hex can need opposite fixes in the two themes: `#6A737D`, the
 * comment of both, reads 4.04:1 on `github-dark`'s near-black chrome and 4.35:1
 * on `github-light`'s light one, so it is lightened in the first and darkened in
 * the second.
 */
const LIGHT_CONTRAST_FLOORS: Readonly<Record<string, string>> = {
  '6A737D': '#59636E', // comments: 4.35 → 5.52 on the light chrome
  D73A49: '#CF222E', // keywords and operators: 4.13 → 4.84
  '22863A': '#197532', // tags and keys: 4.18 → 5.22
  E36209: '#B74F07', // variables and parameters: 3.15 → 4.58
  // the theme draws these two over a fill the block does not carry: a
  // carriage return over red, an ignored diff line over blue — 1.03 and 1.01
  // on the light chrome, so they take the text tone
  FAFBFC: '#24292E',
  F6F8FA: '#24292E',
}

const DARK_CONTRAST_FLOORS: Readonly<Record<string, string>> = {
  '6A737D': '#7D8590', // comments: 4.04 → 5.21 on #0d0d0d
  // a carriage return (`^M`) and the light theme's text share this hex; the
  // theme draws it over a fill the block does not carry: 1.32 → the text tone
  '24292E': '#E1E4E8',
}

/**
 * The light theme's contrast-floor rules, scoped to its own
 * `pre.shiki.github-light` so they outrank the scheme-agnostic `.tok-XXXXXX`
 * rules. The theme class sits in `:where()` so the rules stay BELOW the dark
 * arm's span reset, which must still win in the dark scheme.
 */
const generateContrastFloorRules = (): string =>
  Object.entries(LIGHT_CONTRAST_FLOORS)
    .map(
      ([hex, color]) =>
        `  pre.shiki:where(.${DEFAULT_CODE_BLOCK_THEME}) .tok-${hex} { color: ${color}; }`
    )
    .join('\n')

/** The chrome background + foreground colours for a code block. */
interface ChromeColors {
  readonly background: string
  readonly foreground: string
}

/**
 * The light scheme's chrome: the `--color-muted` / `--color-foreground` tokens,
 * so the block stays light and integrates with the surrounding page.
 */
const LIGHT_CHROME: ChromeColors = {
  background: 'var(--color-muted, #f6f8fa)',
  foreground: 'var(--color-foreground, #1f2328)',
}

/**
 * The dark scheme's chrome: a near-black `#0d0d0d` with light `#e1e4e8` text —
 * the same dark chrome the docs code fence uses — so `github-dark`'s light
 * tokens stay legible everywhere.
 */
const DARK_CHROME: ChromeColors = { background: '#0d0d0d', foreground: '#e1e4e8' }

/**
 * Build the chrome rule for `pre.shiki` (container styling), on the light
 * scheme's chrome; the dark arm repaints it under the dark scheme.
 */
const generateContainerChrome = (chrome: ChromeColors): string =>
  `pre.shiki {
    background-color: ${chrome.background};
    color: ${chrome.foreground};
    padding: 1rem;
    border-radius: 0.5rem;
    overflow-x: auto;
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
    font-size: 0.875rem;
    line-height: 1.5;
  }
  pre.shiki code {
    background: transparent;
    padding: 0;
    font-family: inherit;
    font-size: inherit;
  }
  pre.shiki .line {
    display: inline-block;
    width: 100%;
  }`

/**
 * Chrome for the code FRAME — the `<figure>` that wraps every block's header,
 * command and (optional) output. Four things have to be true and none of them
 * can be expressed as a utility class on the element itself:
 *
 *  1. **No radius at a seam.** `pre.shiki` carries the standalone block's own
 *     `border-radius`; inside a frame that cuts two light notches out from under
 *     the header bar and two more above the output — the double-rounded seam a
 *     reader sees as a rendering glitch. An UNFRAMED block must keep its radius,
 *     so the reset is scoped to the frame rather than applied globally.
 *  2. **No prose sheet reaches inside it.** Typeset leaves a `data-slot` frame
 *     to its own styles, and these rules are UNLAYERED, so they beat any layered
 *     sheet whichever compile path built it: the padding and the lines' bleed
 *     stay in step on a docs page as anywhere else.
 *  3. **A bare `figcaption` is styled as a caption** (muted, centred, spaced);
 *     left so, the header's title would float detached from its bar.
 *  4. **`size: sm` shrinks what `pre.shiki` declares**, unlayered, out of a utility's reach.
 *
 * The glyph swap lives here for the same reason: the icon-only copy button ships
 * BOTH glyphs in its SSR markup and the delegated handler only flips a
 * `data-copied` flag, so the copy→check exchange is pure CSS and behaves
 * identically on the config and docs surfaces.
 */
const FRAME_CHROME = `figure[data-code-frame] pre.shiki,
  figure[data-code-frame] pre[data-code-command],
  figure[data-code-frame] pre[data-code-output] {
    border-radius: 0;
    border-width: 0;
    margin: 0;
  }
  figure[data-code-frame] figcaption {
    margin: 0;
    font-size: 0.75rem;
    line-height: 1rem;
    font-style: normal;
    color: var(--color-muted-foreground);
  }
  figure[data-size="sm"] pre[data-slot="code-block-content"],
  figure[data-size="sm"] pre[data-code-output] { padding: 0.625rem; font-size: 0.75rem; line-height: 1rem; }
  [data-copy-code] [data-copy-glyph="copied"] { display: none; }
  [data-copy-code][data-copied="true"] [data-copy-glyph="copied"] { display: inline; }
  [data-copy-code][data-copied="true"] [data-copy-glyph="copy"] { display: none; }`

/**
 * Chrome for the LINE-NUMBER GUTTER a block draws under `lineNumbers: true`.
 *
 * It lives here, as plain CSS, for the same reason the frame chrome above does:
 * it has to reach markup the author never writes a class onto, and it has to
 * agree with `pre.shiki`'s own `line-height` — which is declared six lines up
 * and would be a magic number anywhere else. The gutter is emitted by
 * `code-block-component.tsx`; its numbers are real elements rather than a CSS
 * counter, for the reason that file gives at length.
 *
 * Three things have to be true:
 *
 *  1. **The numbers must not scroll away.** A long line makes the code surface
 *     scroll horizontally; a gutter sharing that scroller slides out of view
 *     exactly when a reader needs it to follow a wrapped example. So the `<pre>`
 *     becomes a flex row and the OVERFLOW moves to the code side — the gutter is
 *     `flex: none` and stays put.
 *  2. **A number must sit on its own line, at the code's line-height.** Each
 *     `[data-line-number]` is a block, and `pre.shiki .line` above is an
 *     inline-block at full width, so both sides advance one line box per line
 *     and the columns cannot drift apart.
 *  3. **The numbers must not be selectable.** `user-select: none` keeps a manual
 *     drag-select over the block from sweeping the digits into the reader's
 *     paste — the same exclusion the copy BUTTON gets structurally by reading
 *     only the `<code>`, extended to the selection a reader makes by hand.
 *
 * `opacity` rather than a colour token: the gutter must recede against BOTH the
 * dark and light chrome above, and a single muted token that works on
 * one reads as an error on the other.
 */
const LINE_NUMBER_GUTTER = `pre[data-line-numbers] {
    display: flex;
    gap: 1rem;
  }
  pre[data-line-numbers] > [data-line-numbers-gutter] {
    flex: none;
    text-align: right;
    user-select: none;
    -webkit-user-select: none;
    opacity: 0.4;
  }
  pre[data-line-numbers] > [data-line-numbers-gutter] > [data-line-number] {
    display: block;
  }
  pre[data-line-numbers] > [data-code-lines] {
    flex: 1 1 auto;
    min-width: 0;
    overflow-x: auto;
  }`

/**
 * Build the per-color token rules (`.tok-XXXXXX { color: #XXXXXX }`). Returns
 * one declaration per entry in `LIGHT_TOKEN_COLORS`.
 */
const generateTokenColorRules = (): string =>
  Object.entries(LIGHT_TOKEN_COLORS)
    .map(([hex, color]) => `  .tok-${hex} { color: ${color}; }`)
    .join('\n')

/**
 * The `pre.shiki.github-light` selector hook. Shiki writes the theme names as
 * classes on the `<pre>`, so this rule repeats the unscoped light chrome at a
 * higher specificity: it names the light theme in the served CSS, and it gives
 * authors a real selector hook for overrides.
 */
const generateThemeScopedHook = (chrome: ChromeColors): string =>
  `/* Sovrium code-block design: ${DEFAULT_CODE_BLOCK_THEME} */
  pre.shiki.${DEFAULT_CODE_BLOCK_THEME} {
    /* Same theme-tracked chrome as pre.shiki; declared at higher specificity
       so it never re-lightens a dark design's chrome, and so the design name is
       observable in the compiled stylesheet (used by the theme-token regression). */
    background-color: ${chrome.background};
    color: ${chrome.foreground};
  }`

/**
 * The selector the platform's own dark cascade is written under —
 * `theme-generators.ts` uses the identical form, so the code block flips on the
 * same signal as every colour token around it rather than on a second one of
 * its own. `:is()` is worth exactly one class here — it carries the specificity
 * of its most specific argument, and both arms are one class — so the three
 * rules below stack in the order they are written, each outranking the last by
 * a single step rather than by an accident of nesting depth.
 */
const DARK_SCHEME_ROOT = "html:is(.dark, [data-theme='dark'])"

/**
 * The dark-scheme arm: the second half of a declared light/dark pair.
 *
 * Three rules, and each one is load-bearing:
 *
 *  1. **The chrome is pinned to the DARK theme's own chrome**, not merely
 *     darkened. The light arm defers to `--color-muted`, which in
 *     the dark scheme resolves to a mid grey — measured `oklch(0.272 0 0)`,
 *     about `rgb(76,76,76)` — and a dark theme's brightest identifier colour
 *     sits at **4.14:1** against that. Against the theme's own near-black it is
 *     7.3:1. The chrome has to come from the same place the ink does.
 *  2. **Every token span is reset to the chrome's own foreground first.** The
 *     `.tok-XXXXXX` rules painted by the light half are still matching in the
 *     dark scheme, and they are the actual defect: a light theme's body ink on a
 *     darkened ground measured **1.27:1**. The reset is what stops a token the
 *     dark palette has no curated rule for from keeping the LIGHT palette's
 *     colour — it falls to `#e1e4e8`-class chrome ink instead, monochrome but
 *     legible, which is the same graceful degrade an uncovered token already
 *     gets in the light scheme.
 *  3. **Then the dark palette paints back over it**: the curated hexes plus
 *     every foreground `github-dark` declares (`loadCodeBlockDarkPalette`),
 *     each held to 4.5:1, matching the highlighter's `tok-dark-XXXXXX` classes. It outranks the reset by one class, which is why the reset can
 *     be written as broadly as it is.
 *
 * Scoped to `pre.shiki code span` rather than to `span`: the line-number gutter
 * is a sibling of the code, and nothing here has any business touching it.
 */
const generateDarkSchemeArm = (palette: readonly string[]): string => {
  const chrome = DARK_CHROME
  const curated = Object.entries(DARK_TOKEN_COLORS).map(
    ([hex, color]) => [hex, DARK_CONTRAST_FLOORS[hex] ?? color] as const
  )
  const ownPalette = flooredPalette(palette, DARK_TOKEN_COLORS, chrome)
  const tokenRules = [...curated, ...ownPalette]
    .map(
      ([hex, color]) =>
        `  ${DARK_SCHEME_ROOT} pre.shiki code span.tok-dark-${hex} { color: ${color}; }`
    )
    .join('\n')
  return `/* Sovrium code-block dark design: ${DEFAULT_CODE_BLOCK_DARK_THEME} */
  ${DARK_SCHEME_ROOT} pre.shiki {
    background-color: ${chrome.background};
    color: ${chrome.foreground};
  }
  ${DARK_SCHEME_ROOT} pre.shiki code span {
    color: inherit;
  }
${tokenRules}`
}

/**
 * Generate the complete code-block stylesheet.
 *
 * Every app draws shadcn/ui's default pair (the same two names the Shiki
 * highlighter is called with, so the stylesheet and the markup agree):
 * `github-light` names the comment header and the `pre.shiki.github-light`
 * selector hook, and the `github-dark` arm is appended after everything above,
 * so its rules win by source order as well as by specificity.
 *
 * `darkPalette` is every foreground `github-dark` declares
 * (`loadCodeBlockDarkPalette`), each held to the 4.5:1 floor.
 */
export const generateCodeBlockStyles = (darkPalette: readonly string[] = []): string =>
  [
    generateContainerChrome(LIGHT_CHROME),
    FRAME_CHROME,
    LINE_NUMBER_GUTTER,
    generateTokenColorRules(),
    generateThemeScopedHook(LIGHT_CHROME),
    generateContrastFloorRules(),
    generateDarkSchemeArm(darkPalette),
  ].join('\n')
