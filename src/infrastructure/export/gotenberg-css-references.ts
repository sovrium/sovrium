/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The CSS half of the Gotenberg sandbox: a stylesheet or a `style` attribute
 * with every reference that could load something removed — each `@import`
 * rule, and each `url()`, `image()`, `image-set()` or `src()` whose target is
 * not a `data:` URL. The Content-Security-Policy refuses those loads too; this
 * keeps them out of the document Gotenberg receives at all.
 *
 * A reference hidden behind a CSS escape (`\75 rl(…)`) is not rewritten piece
 * by piece: once the escapes are decoded, any reference still left drops the
 * whole stylesheet, which costs the layout and nothing else.
 */

/** A `@import` rule, up to its `;` or the end of the text. */
const IMPORT_RULE = /@import\b[^;]*(?:;|$)/gi

/** A loading function and its first argument, quoted or bare. */
const LOADING_FUNCTION =
  /\b(?:url|image|image-set|src)\s*\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]*))[^)]*\)/gi

const isInline = (target: string): boolean => /^\s*data:/i.test(target)

/** `\XX ` hex escapes and `\c` escapes, decoded. */
const decodeEscapes = (css: string): string =>
  css
    .replace(/\\([0-9a-fA-F]{1,6})\s?/g, (_, hex: string) => {
      const code = Number.parseInt(hex, 16)
      return code > 0 && code <= 0x10_ff_ff ? String.fromCodePoint(code) : ''
    })
    .replace(/\\(.)/g, '$1')
    // A comment can split a function name from its parenthesis.
    .replace(/\/\*[\s\S]*?\*\//g, '')

/** Whether any loading reference is left in `css`. */
const hasRemoteReference = (css: string): boolean =>
  /@import/i.test(css) ||
  [...css.matchAll(LOADING_FUNCTION)].some(
    (match) => !isInline(match[1] ?? match[2] ?? match[3] ?? '')
  )

/**
 * `css` with its `@import` rules and its non-`data:` loading references
 * removed (a removed reference becomes `none`), or `''` when a reference
 * survives only behind an escape. `</` is broken so the text can never close
 * the `<style>` element it is written back into.
 */
export const stripCssReferences = (css: string): string => {
  const stripped = css
    .replace(IMPORT_RULE, '')
    .replace(LOADING_FUNCTION, (whole, double?: string, single?: string, bare?: string) =>
      isInline(double ?? single ?? bare ?? '') ? whole : 'none'
    )
  const safe = hasRemoteReference(decodeEscapes(stripped)) ? '' : stripped
  return safe.replace(/<\//g, '<\\/')
}
