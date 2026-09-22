/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * U+2028 LINE SEPARATOR and U+2029 PARAGRAPH SEPARATOR, derived from their code
 * points rather than written as literals.
 *
 * Deliberate: both characters are INVISIBLE in an editor and in a diff. Pasting
 * them into a source literal here would make this file's own correctness depend
 * on an unreadable byte surviving every future copy, reformat and merge — and a
 * literal U+2028 inside a string or regex literal is itself the pre-ES2019 parse
 * hazard these escapes exist to neutralise.
 */
const LINE_SEPARATOR = String.fromCharCode(0x20_28)
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x20_29)

/**
 * The characters that must not survive verbatim into a `<script>` body, and the
 * JSON escape each is rewritten to.
 *
 * Every replacement is a `\uXXXX` escape, which is why this is safe to apply to
 * the FINISHED `JSON.stringify` output rather than to the input values: a
 * `\uXXXX` sequence is only meaningful inside a JSON string literal, and none of
 * these five characters is JSON structural syntax, so each one can only ever
 * appear inside a string literal to begin with. The rewrite therefore cannot
 * corrupt the document's shape, and `JSON.parse` decodes every escape back to
 * the original character — the value round-trips EXACTLY.
 */
const SCRIPT_BODY_ESCAPES: Readonly<Record<string, string>> = {
  '<': '\\u003c',
  '>': '\\u003e',
  '&': '\\u0026',
  [LINE_SEPARATOR]: '\\u2028',
  [PARAGRAPH_SEPARATOR]: '\\u2029',
}

const SCRIPT_BODY_UNSAFE = new RegExp(`[<>&${LINE_SEPARATOR}${PARAGRAPH_SEPARATOR}]`, 'g')

/**
 * The single serializer for JSON destined to be emitted INSIDE a `<script>`
 * element body — JSON-LD (`type="application/ld+json"`), inline JSON config
 * blocks (`type="application/json"`), and any bootstrap payload handed to
 * `dangerouslySetInnerHTML`.
 *
 * WHY A BARE `JSON.stringify` IS NOT SAFE HERE. `JSON.stringify` escapes for
 * JSON, and JSON has nothing whatsoever to say about `<`: the two-character
 * sequence `</` survives verbatim. The HTML parser does not parse a script body
 * as JSON — per the HTML spec it scans the raw text for the literal `</script`
 * and ends the element there, then resumes parsing HTML *mid-value*. So a
 * single stored or authored string containing `</script>` closes the tag early
 * and everything after it becomes live markup, hoisted out of `<head>` and
 * executed on every render.
 *
 * THE FIX. Rewrite each dangerous character as its JSON `\uXXXX` escape. Inside
 * a JSON string literal those decode back to the original character, so the
 * value round-trips EXACTLY — nothing is stripped, truncated or lost, which
 * matters because structured data that silently drops content is a different
 * defect wearing the same green tick. `JSON.parse` and every consumer (Google's
 * Rich Results, a client `JSON.parse` of a config block) sees the original
 * string.
 *
 * WHAT IS ESCAPED, AND WHY EACH ONE EARNS ITS PLACE:
 *
 *  - `<` — LOAD-BEARING. `</script`, `<!--` and `<script` all require it, and it
 *    is the only character the HTML tokenizer treats as special inside a
 *    raw-text element. On its own it closes the breakout.
 *  - `>` and `&` — DEFENCE IN DEPTH, and honestly labelled as such: inside a
 *    raw-text element `&` is NOT an entity introducer and a bare `>` cannot
 *    close anything, so neither is required for the `</script>` breakout. They
 *    are escaped so this serializer stays correct if a payload is ever emitted
 *    into a context that IS entity-decoding — an inline attribute, an `<svg>`
 *    foreign-content subtree, a template that is re-parsed. The cost is zero:
 *    both still round-trip through `JSON.parse` unchanged.
 *  - U+2028 / U+2029 — A REAL PARSE HAZARD, not decoration. Both are legal,
 *    unescaped, inside a JSON string, and `JSON.stringify` emits them raw.
 *    Before ES2019 both were ILLEGAL inside a JavaScript string literal, so a
 *    payload carrying one becomes a `SyntaxError` the moment it is read by
 *    something that evaluates it as JS rather than parsing it as JSON — a
 *    JSONP-style consumer, an older engine, a bundler inlining the block.
 *    Escaping them makes the output a valid JavaScript expression as well as
 *    valid JSON.
 *
 * `/` is deliberately NOT escaped. Escaping `<` already makes `</script>`
 * unrepresentable, whereas `\/` would rewrite every URL in the document
 * (`https:\/\/schema.org`) for no security gain.
 */
export const serializeJsonForScript = (value: unknown, space?: number): string => {
  // `JSON.stringify` answers `undefined` (not a string) for `undefined` and for
  // a function. An empty script body is the only sane emission for those —
  // emitting the STRING "undefined" would be a syntax error for every consumer.
  const json = JSON.stringify(value, undefined, space) as string | undefined
  if (json === undefined) return ''
  return json.replace(SCRIPT_BODY_UNSAFE, (char) => SCRIPT_BODY_ESCAPES[char] ?? char)
}
