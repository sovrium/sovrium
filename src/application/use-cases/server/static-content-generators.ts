/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { withLanguagePrefix, type PageAddress } from '@/domain/kernel/matching/localized-path'
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
 * Build the full URL for a page in a specific language: `baseUrl` joined to the
 * domain's {@link withLanguagePrefix}, so a `:lang` segment is substituted
 * rather than prefixed and the result carries exactly one language prefix
 * (never `/en/en/...` or `/en/:lang/...`).
 */
export const buildLanguageUrl = (baseUrl: string, lang: string, pagePath: string): string =>
  `${baseUrl}${withLanguagePrefix(lang, pagePath)}`

/**
 * Render a sitemap entry's hreflang `<xhtml:link>` elements from the page's
 * {@link languageAlternates} — the pairs the page's HTML alternates name too —
 * plus `x-default` → the default language's address when the page exists in
 * it. No alternate yields no link: a page in a single language has none.
 */
export const renderSitemapHreflangLinks = (
  baseUrl: string,
  alternates: ReadonlyArray<PageAddress>,
  hreflangConfig: HreflangConfig
): readonly string[] => {
  const languageLinks = alternates.map((alternate) => {
    const locale = hreflangConfig.localeMap[alternate.language] ?? alternate.language
    return `<xhtml:link rel="alternate" hreflang="${locale}" href="${baseUrl}${alternate.path}" />`
  })
  const xDefault = alternates.find(
    (alternate) => alternate.language === hreflangConfig.defaultLanguage
  )
  return xDefault === undefined
    ? languageLinks
    : [
        ...languageLinks,
        `<xhtml:link rel="alternate" hreflang="x-default" href="${baseUrl}${xDefault.path}" />`,
      ]
}
