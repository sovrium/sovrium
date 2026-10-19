/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Escaping for a config-authored value written VERBATIM into a stylesheet.
 *
 * The design config carries free strings that land in generated CSS as they
 * are written: a font family, a shadow, an easing, a radius, a keyframe value.
 * Several schemas check only their prefix, and a design imported from a
 * third-party token file reaches the same fields. Written raw, a value such as
 *
 *     Inter; } body { display: none } :root { --x: 1
 *
 * closes the declaration and the block it sits in, and every page of the app
 * then carries rules nobody declared.
 *
 * ─── WHAT IS ESCAPED, AND WHY A VALID VALUE IS NOT CHANGED ────────────────
 *
 * Only the characters that END something are escaped, each as a CSS hex
 * escape followed by its one terminating space (`;` → `\3b `):
 *
 *   `;`  `{`  `}`     end a declaration, open or close a block
 *   `<`               starts `</style>` when the sheet is inlined in a page
 *   CR  LF  FF        a string token cannot cross a line, and ending one
 *                     early swallows the declaration after it
 *   `*` after `/`     a comment would swallow every declaration after it
 *   a final `\`       would escape the `;` the generator writes next
 *   an unpaired quote a string with no end runs on into the next declaration
 *   an unclosed `(`   a function with no `)` (`url(x`) runs on to the next
 *   or `[`            `)` anywhere in the sheet, so the missing closers are
 *                     appended instead
 *
 * A CSS value a browser actually applies holds none of these outside a
 * string, and inside a string an escape reads back as the very character it
 * replaced. So every value that renders today renders the same; the only text
 * that changes is text that was breaking out of its declaration. Once escaped,
 * such a value is one inert token the property ignores.
 *
 * `url(`, `@import` and `expression(` need no escape of their own: `@import`
 * means nothing inside a declaration, `expression()` is read by no supported
 * browser, and a `url()` inside a value cannot leave the declaration it is in.
 */

const hexEscape = (character: string): string =>
  `\\${(character.codePointAt(0) ?? 0).toString(16)} `

/**
 * An escape pair, a whole quoted string, or a quote that opens a string the
 * value never closes. Matched left to right, so a quote inside a string of
 * the other kind (`"O'Brien"`) is part of that string, not a bare quote.
 */
const STRING_OR_BARE_QUOTE = /\\[\s\S]|"(?:[^"\\]|\\[\s\S])*"|'(?:[^'\\]|\\[\s\S])*'|["']/g

/** Every quote that opens a string with no end, escaped; whole strings left as they are. */
const escapeUnclosedQuotes = (value: string): string =>
  value.replace(STRING_OR_BARE_QUOTE, (token) =>
    token === '"' || token === "'" ? hexEscape(token) : token
  )

/** How many more `open` than `close` the value holds outside its strings, never below 0. */
const unclosed = (value: string, open: string, close: string): number => {
  const bare = value.replace(STRING_OR_BARE_QUOTE, '')
  return Math.max(0, bare.split(open).length - bare.split(close).length)
}

/** `value`, unable to leave the CSS declaration it is written into. */
export const escapeCssValue = (value: string): string => {
  const structural = value
    .replace(/[;{}<\r\n\f]/g, hexEscape)
    .replace(/\/\*/g, `/${hexEscape('*')}`)
    .replace(/(?<!\\)((?:\\\\)*)\\$/, `$1${hexEscape('\\')}`)
  const quoted = escapeUnclosedQuotes(structural)
  return `${quoted}${')'.repeat(unclosed(quoted, '(', ')'))}${']'.repeat(unclosed(quoted, '[', ']'))}`
}
