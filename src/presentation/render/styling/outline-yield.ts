/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/** The utility a token names, past its variants and an important mark. */
const utilityOf = (token: string): string =>
  token.slice(token.lastIndexOf(':') + 1).replace(/!/g, '')

/**
 * An outline utility that DRAWS one: a width (other than zero) or a line style.
 * The removing utility, the hidden one, an offset and a colour draw nothing.
 */
const DRAWS_OUTLINE =
  /^outline(?:-(?:[1-9]\d*(?:\.\d+)?|solid|dashed|dotted|double|\[.+\]|\(.+\)))?$/

/** The utility that removes an outline, and with it the style every outline utility reads. */
const REMOVES_OUTLINE = 'outline-none'

/**
 * An outline drawn on the element wins over the engine's outline removal.
 *
 * The removing utility does not only set the element's outline style: it sets
 * the custom property every outline utility reads its style from. A recipe
 * that removes the browser outline (a button's, a link's keyboard underline)
 * therefore cancelled an author's own outline whatever its variant and
 * whichever layer drew it, because the two never conflict in the merge: they
 * name different properties. When the list draws an outline, every removal
 * leaves it; the base layer still cancels the browser's own outline on the
 * elements that draw none.
 *
 * Applied where the server merges a component's recipe with its author and
 * design classes, never in an island: the class list reaches the browser
 * already settled.
 */
export const yieldOutlineToAuthor = (classes: string): string => {
  const tokens = classes.split(' ')
  if (!tokens.some((token) => DRAWS_OUTLINE.test(utilityOf(token)))) return classes
  return tokens.filter((token) => utilityOf(token) !== REMOVES_OUTLINE).join(' ')
}
