/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

const SCRIPT_ESCAPES: Readonly<Record<string, string>> = {
  '<': String.raw`\u003C`,
  '>': String.raw`\u003E`,
  '/': String.raw`\u002F`,
  '\u2028': String.raw`\u2028`,
  '\u2029': String.raw`\u2029`,
}

/**
 * A value as an inert script literal: its JSON text, with the characters that
 * could close a string or a surrounding script written as `\uXXXX` escapes.
 * JSON text holds those characters only inside string literals, where each
 * escape reads back as the same character, so the value is unchanged.
 * `undefined` becomes `null`, as JSON has no `undefined`.
 */
export const toScriptLiteral = (value: unknown): string =>
  JSON.stringify(value ?? null).replaceAll(
    /[<>/\u2028\u2029]/g,
    (char) => SCRIPT_ESCAPES[char] ?? char
  )
