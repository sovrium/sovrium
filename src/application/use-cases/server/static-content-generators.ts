/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Options } from 'prettier'

/**
 * Hreflang configuration for multilingual sitemaps
 */
export interface HreflangConfig {
  /** Maps language codes to full locales (e.g., { en: 'en-US', fr: 'fr-FR' }) */
  readonly localeMap: Readonly<Record<string, string>>
  /** Default language code for x-default hreflang (e.g., 'en') */
  readonly defaultLanguage: string
}

/**
 * Repair whitespace inside <pre> tags that Prettier's HTML formatter damages.
 *
 * Prettier adds a newline + indentation after the opening `>` of `<pre>` tags.
 * Because `<pre>` renders whitespace literally (CSS `white-space: pre`), this
 * introduces a visible blank first line in code blocks.
 *
 * This function strips the newline and any spaces immediately after `<pre ...>`.
 */
const repairPreWhitespace = (html: string): string => html.replace(/(<pre[^>]*>)\n[ ]*/g, '$1')

/**
 * The formatting options every generated page is laid out with.
 *
 * PINNED IN CODE, and deliberately NOT discovered from the filesystem. A
 * generated site is a pure function of the app config and its content (the
 * Build Output Determinism contract in
 * `[internal ref]`), so a `.prettierrc`,
 * an `.editorconfig` or a `package.json#prettier` that a self-hoster happens to
 * have lying around near their build directory must not change a byte of the
 * output. `prettier.format` reads nothing from disk on its own — only
 * `prettier.resolveConfig` does, and this module does not call it.
 *
 * Beyond being ambient, `resolveConfig(process.cwd())` treats its argument as a
 * FILE path and starts its upward search at that argument's PARENT, so it is
 * off by one directory: a config in the PARENT of the build directory changes
 * the output while the one in the build directory itself is silently ignored.
 * The answer is no lookup at all — not a corrected lookup. Pinned by a CLI build generation spec, whose cwd-config case is a
 * regression guard against "repairing" the off-by-one.
 *
 * Every value below is Prettier 3.x's own default, written out rather than
 * inherited so a future change to those defaults cannot silently re-lay-out
 * every shipped page. The JavaScript-side options are load-bearing despite the
 * `html` parser: Prettier formats the contents of embedded `<script>` blocks
 * (the command-palette bootstrap, island hydration, JSON-LD), so `printWidth`,
 * `semi`, `singleQuote` and `trailingComma` all shape the emitted bytes.
 *
 * Two things this repo's OWN `.prettierrc.json` carries are pointedly absent,
 * and both absences are decisions rather than oversights:
 *  - `singleAttributePerLine` — a source-readability preference for this
 *    repo's TypeScript. It has no business exploding shipped product markup
 *    one attribute per line.
 *  - `prettier-plugin-tailwindcss` — it REORDERS `class` attributes.
 *    Reordering classes in product HTML is a behaviour change, not
 *    formatting. `plugins: []` states that no plugin runs here.
 */
const HTML_FORMAT_OPTIONS: Readonly<Options> = {
  parser: 'html',
  plugins: [],
  printWidth: 80,
  tabWidth: 2,
  useTabs: false,
  endOfLine: 'lf',
  htmlWhitespaceSensitivity: 'css',
  bracketSameLine: false,
  bracketSpacing: true,
  semi: true,
  singleQuote: false,
  quoteProps: 'as-needed',
  trailingComma: 'all',
  arrowParens: 'always',
}

/**
 * Format HTML with Prettier for professional formatting.
 *
 * Uses {@link HTML_FORMAT_OPTIONS} verbatim — no config is resolved from the
 * filesystem, so the result depends on the input HTML alone.
 *
 * After formatting, repairs `<pre>` whitespace that Prettier damages
 * (leading newline + indentation, trailing whitespace).
 */
export const formatHtmlWithPrettier = async (html: string): Promise<string> => {
  const prettier = await import('prettier')
  const formatted = await prettier.format(html, HTML_FORMAT_OPTIONS)

  return repairPreWhitespace(formatted)
}

/**
 * Build the full URL for a page in a specific language.
 *
 * Two shapes are handled so a language prefix never duplicates:
 *  - The path already carries a `:lang` template segment (e.g. `/:lang/about`):
 *    the `:lang` token is SUBSTITUTED with the language code, never prefixed.
 *  - The path is language-agnostic (e.g. `/about`): the language code is
 *    prefixed once (`/en/about`).
 *
 * In both cases the result carries exactly one language prefix (never
 * `/en/en/...` or `/en/:lang/...`).
 */
export const buildLanguageUrl = (baseUrl: string, lang: string, pagePath: string): string => {
  if (/(^|\/):lang(\/|$)/.test(pagePath)) {
    const substituted = pagePath.replace(
      /(^|\/):lang(\/|$)/,
      (_match, pre: string, post: string) => (post === '' ? `${pre}${lang}` : `${pre}${lang}/`)
    )
    return `${baseUrl}${substituted}`
  }
  const normalizedPath = pagePath === '/' ? '' : pagePath
  return `${baseUrl}/${lang}${normalizedPath}${normalizedPath === '' ? '/' : ''}`
}

/**
 * If `pagePath`'s FIRST segment is one of the configured language codes (e.g.
 * `/en/introduction` when `en` is supported), return that code. This identifies
 * a "hardcoded-language" path — a page whose language prefix is baked into its
 * declared `path` (because `contentDir.directory` is per-locale and takes no
 * `:lang` interpolation, so a bilingual docs site declares `/en/:slug` +
 * `/fr/:slug` rather than a single `/:lang/:slug`). Returns `undefined` for
 * language-agnostic paths (`/about`) and `:lang`-template paths.
 */
export const leadingLanguageSegment = (
  pagePath: string,
  languages: readonly string[]
): string | undefined => {
  const firstSegment = pagePath.split('/').filter((segment) => segment.length > 0)[0]
  return firstSegment !== undefined && languages.includes(firstSegment) ? firstSegment : undefined
}

/**
 * Swap the leading language segment of a hardcoded-language path with `lang`,
 * yielding the sibling locale's URL: `/en/introduction` + `fr` → `/fr/introduction`,
 * `/en/` + `fr` → `/fr/`. The caller guarantees the first segment is a language
 * code (see {@link leadingLanguageSegment}).
 */
const swapLeadingLanguage = (pagePath: string, lang: string): string =>
  pagePath.replace(/^\/[^/]+/, `/${lang}`)

/**
 * Generate hreflang <xhtml:link> elements for a single URL entry
 */
export const generateHreflangLinks = (
  baseUrl: string,
  pagePath: string,
  languages: readonly string[],
  hreflangConfig: HreflangConfig
): readonly string[] => {
  const languageLinks = languages.map((lang) => {
    const locale = hreflangConfig.localeMap[lang] ?? lang
    const url = buildLanguageUrl(baseUrl, lang, pagePath)
    return `<xhtml:link rel="alternate" hreflang="${locale}" href="${url}" />`
  })

  const defaultUrl = buildLanguageUrl(baseUrl, hreflangConfig.defaultLanguage, pagePath)
  const xDefaultLink = `<xhtml:link rel="alternate" hreflang="x-default" href="${defaultUrl}" />`

  return [...languageLinks, xDefaultLink]
}

/**
 * Generate hreflang <xhtml:link> elements for a hardcoded-language URL entry by
 * swapping the leading language segment across the configured locales. Pairs
 * `/en/introduction` with its `/fr/introduction` sibling (plus `x-default` →
 * the default language) — distinct from {@link generateHreflangLinks}, which
 * PREFIXES a language-agnostic path.
 */
export const generateHardcodedLangHreflangLinks = (
  baseUrl: string,
  pagePath: string,
  languages: readonly string[],
  hreflangConfig: HreflangConfig
): readonly string[] => {
  const languageLinks = languages.map((lang) => {
    const locale = hreflangConfig.localeMap[lang] ?? lang
    const url = `${baseUrl}${swapLeadingLanguage(pagePath, lang)}`
    return `<xhtml:link rel="alternate" hreflang="${locale}" href="${url}" />`
  })

  const defaultUrl = `${baseUrl}${swapLeadingLanguage(pagePath, hreflangConfig.defaultLanguage)}`
  const xDefaultLink = `<xhtml:link rel="alternate" hreflang="x-default" href="${defaultUrl}" />`

  return [...languageLinks, xDefaultLink]
}
