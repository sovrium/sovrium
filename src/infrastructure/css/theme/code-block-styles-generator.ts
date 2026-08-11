/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Code-block chrome stylesheet generator ([internal ref],
 * cluster 2).
 *
 * The Shiki highlighter (`infrastructure/markdown/shiki-highlighter.ts`)
 * emits `<pre class="shiki <themeName>"><code>…<span class="tok-XXXXXX">…
 * </span>…</code></pre>` markup with NO inline `style` attribute (the
 * canonical sanitiser strips `style`, so colors are delivered via classes
 * only). This generator emits the matching CSS:
 *
 *  - Container chrome on `pre.shiki` (background, padding, radius, font).
 *    The chrome background + foreground TRACK the active Shiki theme: a DARK
 *    chrome (near-black `#0d0d0d`, light `#e1e4e8` text) for dark themes
 *    (`github-dark` — the default — `nord`, `dracula`, …) so their light token
 *    colours stay legible, and a LIGHT chrome (the `--color-background-subtle`
 *    token) for light themes (`github-light`, …). This unifies the code-block
 *    chrome across every surface — config `code` components AND generic
 *    markdown fences — so a fence outside the docs zone no longer washes out
 *    under `github-dark` (the founder-review defect). The docs three-column
 *    layout keeps its own higher-specificity `.prose pre.shiki` chrome
 *    (`MarkdownArticleEnhancements.ts`) for its bordered docs styling.
 *  - A small set of `.tok-XXXXXX { color: #XXXXXX }` rules — one per hex
 *    color expected from the configured theme. These are not exhaustive
 *    (Shiki themes carry hundreds of TextMate scopes); the rules below
 *    cover the most common token colors for the two themes the spec
 *    fixture exercises (`github-dark` and `nord`). Uncovered tokens render
 *    as plain text against the chrome — legible, just monochrome — which
 *    is the same graceful-degrade contract the unknown-language fallback
 *    uses.
 *
 * The CSS is injected into `buildSourceCSS` in `infrastructure/css/compiler.ts`
 * so it flows through BOTH compile paths:
 *  1. the native PostCSS pipeline (from-source / npm-bundled), and
 *  2. the pure-JS native-free engine (compiled-binary path, issue #19).
 *
 * Selectors used here (`pre.shiki`, `.tok-XXXXXX`) are plain CSS, not
 * Tailwind utilities, so they do NOT need to appear in
 * `BUILTIN_CSS_CANDIDATES` — Tailwind's candidate-driven engine only gates
 * utility classes, not arbitrary author selectors emitted via raw CSS.
 */

import type { Theme } from '@/domain/models/app/theme'

/**
 * Default Shiki theme applied when `theme.codeBlock.theme` is unset. Mirrors
 * the runtime default in `infrastructure/markdown/shiki-highlighter.ts` so the
 * CSS layer agrees with the highlighter output on the unconfigured-app path.
 */
const DEFAULT_SHIKI_THEME = 'github-dark'

/**
 * Common token colors per supported theme. The list intentionally stays small
 * — full Shiki token coverage would balloon the stylesheet and most pages
 * only reference a handful of colors per fence. Extend when a spec demands
 * a token currently rendering monochrome.
 *
 * Keys are uppercased hex (with no `#`) to match the highlighter's
 * `tok-XXXXXX` class output.
 */
const COMMON_TOKEN_COLORS: Readonly<Record<string, string>> = {
  // github-dark
  F97583: '#F97583', // keywords
  '79B8FF': '#79B8FF', // identifiers
  '9ECBFF': '#9ECBFF', // strings
  B392F0: '#B392F0', // functions
  '85E89D': '#85E89D', // types
  E1E4E8: '#E1E4E8', // text
  '6A737D': '#6A737D', // comments
  // nord
  '81A1C1': '#81A1C1', // keywords
  '88C0D0': '#88C0D0', // types
  D8DEE9: '#D8DEE9', // text
  A3BE8C: '#A3BE8C', // strings
  EBCB8B: '#EBCB8B', // numbers
  '5E81AC': '#5E81AC', // operators
  B48EAD: '#B48EAD', // constants
  // github-light common
  D73A49: '#D73A49',
  '6F42C1': '#6F42C1',
  '24292E': '#24292E',
  '032F62': '#032F62',
  '005CC5': '#005CC5',
  '22863A': '#22863A',
}

/**
 * The chrome background + foreground colours for a code block, resolved from
 * the active Shiki theme. Dark themes get a fixed near-black chrome with light
 * text (so their light token colours stay legible); light themes defer to the
 * `--color-background-subtle` / `--color-foreground` tokens so the chrome stays
 * light and integrates with the surrounding page.
 */
interface ChromeColors {
  readonly background: string
  readonly foreground: string
}

/**
 * Shiki theme names that ship a LIGHT background. The chrome for any theme NOT
 * in this set (nor matched by the substring heuristic below) defaults to the
 * dark chrome — most Shiki themes are dark, and the Sovrium default
 * (`github-dark`) is dark. Kept small and explicit; extend when a spec needs a
 * light theme the heuristic misses.
 */
const LIGHT_SHIKI_THEMES: ReadonlySet<string> = new Set([
  'github-light',
  'github-light-default',
  'github-light-high-contrast',
  'light-plus',
  'solarized-light',
  'min-light',
  'catppuccin-latte',
  'everforest-light',
  'one-light',
  'vitesse-light',
  'snazzy-light',
  'material-theme-lighter',
  'rose-pine-dawn',
  'slack-ochin',
])

/**
 * Classify a Shiki theme name as light-backgrounded. Combines the explicit
 * `LIGHT_SHIKI_THEMES` set with a name-substring heuristic (`light` / `dawn` /
 * `latte` / `-day`) so common light-theme variants are covered without an
 * exhaustive list.
 */
const isLightShikiTheme = (themeName: string): boolean => {
  const name = themeName.toLowerCase()
  if (LIGHT_SHIKI_THEMES.has(name)) return true
  return (
    name.includes('light') ||
    name.includes('dawn') ||
    name.includes('latte') ||
    name.includes('-day')
  )
}

/**
 * Resolve the chrome colours for the active code-block theme. A dark theme
 * pins a near-black chrome (`#0d0d0d`) with light text (`#e1e4e8`) — the same
 * dark chrome the docs code fence uses — so `github-dark`'s light tokens stay
 * legible everywhere. A light theme keeps the `--color-background-subtle` token
 * chrome so it stays light and adapts to the operator's palette.
 */
const resolveChromeColors = (themeName: string): ChromeColors =>
  isLightShikiTheme(themeName)
    ? {
        background: 'var(--color-background-subtle, #f6f8fa)',
        foreground: 'var(--color-foreground, #1f2328)',
      }
    : { background: '#0d0d0d', foreground: '#e1e4e8' }

/**
 * Build the chrome rule for `pre.shiki` (container styling). The
 * background/foreground come from {@link resolveChromeColors} so the chrome
 * tracks the active Shiki theme (dark for dark themes, light for light themes).
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
 * command and (optional) output. Three things have to be true and none of them
 * can be expressed as a utility class on the element itself:
 *
 *  1. **No radius at a seam.** `pre.shiki` carries the standalone block's own
 *     `border-radius`; inside a frame that cuts two light notches out from under
 *     the header bar and two more above the output — the double-rounded seam a
 *     reader sees as a rendering glitch. An UNFRAMED block must keep its radius,
 *     so the reset is scoped to the frame rather than applied globally
 *.
 *  2. **It has to outrank `.prose`.** The docs article patches `.prose pre.shiki`
 *     (0,2,1) with its own border + radius; these rules are emitted UNLAYERED at
 *     (0,2,2), so they win regardless of source order and regardless of which of
 *     the two CSS compile paths built the sheet.
 *  3. **`@tailwindcss/typography` styles `figcaption`.** Left alone, prose's
 *     caption margin, size and italic caption colour make every docs header
 *     float detached above the block it labels.
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
    color: var(--sv-fg-muted, oklch(0.445 0 0));
  }
  [data-copy-code] [data-copy-glyph="copied"] { display: none; }
  [data-copy-code][data-copied="true"] [data-copy-glyph="copied"] { display: inline; }
  [data-copy-code][data-copied="true"] [data-copy-glyph="copy"] { display: none; }`

/**
 * Build the per-color token rules (`.tok-XXXXXX { color: #XXXXXX }`). Returns
 * one declaration per entry in `COMMON_TOKEN_COLORS`.
 */
const generateTokenColorRules = (): string =>
  Object.entries(COMMON_TOKEN_COLORS)
    .map(([hex, color]) => `  .tok-${hex} { color: ${color}; }`)
    .join('\n')

/**
 * Resolve the active Shiki theme name. Falls back to `DEFAULT_SHIKI_THEME`
 * when the operator did not declare `theme.codeBlock.theme` — matching the
 * runtime default the Shiki highlighter applies to fenced code blocks.
 */
const resolveCodeBlockThemeName = (theme?: Theme): string =>
  theme?.codeBlock?.theme ?? DEFAULT_SHIKI_THEME

/**
 * Build a theme-name-scoped selector hook. Shiki emits `<pre class="shiki
 * <themeName>">`, so authors can target theme-specific tweaks via
 * `pre.shiki.<themeName>`. The rule itself reuses the same chrome as the
 * unscoped `pre.shiki` block — its purpose is to (1) expose the active
 * theme name in the served CSS (so the configured token is observable as a
 * stylesheet property, not just a Shiki-rendered DOM class) and (2) give
 * authors a real selector hook for overrides.
 */
const generateThemeScopedHook = (themeName: string, chrome: ChromeColors): string =>
  `/* Sovrium code-block theme: ${themeName} */
  pre.shiki.${themeName} {
    /* Same theme-tracked chrome as pre.shiki; declared at higher specificity
       so it never re-lightens a dark theme's chrome, and so the theme name is
       observable in the compiled stylesheet (used by the theme-token regression). */
    background-color: ${chrome.background};
    color: ${chrome.foreground};
  }`

/**
 * Generate the complete code-block stylesheet for the configured theme.
 *
 * The `theme` parameter selects the Shiki theme name emitted in the stylesheet
 * (via a comment header and a `pre.shiki.<themeName>` selector hook). When
 * `theme.codeBlock.theme` is unset, the default Shiki theme name
 * (`'github-dark'`) is used — matching the highlighter runtime default — so
 * the served CSS always carries a theme name regardless of whether the
 * operator declared code-block config.
 *
 * The base `pre.shiki` chrome and `.tok-XXX` token-color rules remain
 * theme-name-agnostic (colors come from the highlighted markup's `tok-XXX`
 * class). The theme-name emission is purely additive — it does not change
 * the rendered DOM, only the CSS surface.
 */
export const generateCodeBlockStyles = (theme?: Theme): string => {
  const themeName = resolveCodeBlockThemeName(theme)
  const chromeColors = resolveChromeColors(themeName)
  const chrome = generateContainerChrome(chromeColors)
  const tokenRules = generateTokenColorRules()
  const themeHook = generateThemeScopedHook(themeName, chromeColors)
  return `${chrome}\n${FRAME_CHROME}\n${tokenRules}\n${themeHook}`
}
