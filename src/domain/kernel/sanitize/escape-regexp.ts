/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The canonical regular-expression escaper.
 *
 * Every place that builds a `RegExp` out of a value it did not author needs
 * this, and the repo had grown four independent copies of the same character
 * class. Copies are how the class drifts: a fifth site escaped only `:` before
 * interpolating an attribute name, which is both incomplete and — since `\:` is
 * an identity escape — no escape at all.
 */

/**
 * `value`, safe to interpolate into a regular-expression source string as a
 * LITERAL.
 *
 * The class is the full ECMAScript metacharacter set, and it contains `\`
 * first so the escape character is escaped before it can consume the character
 * after it. `$&` in the replacement is the whole match — the escaped character
 * itself.
 *
 * Note what this does NOT do: it neutralises SYNTAX, not COST. A caller that
 * concatenates escaped fragments into a pattern with its own quantifiers can
 * still write a catastrophically-backtracking regex; escaping the operands does
 * not bound the result. Where the pattern shape itself is caller-controlled,
 * the answer is to not build a regex at all.
 */
export const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
