/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Whether a parsed JSON value nests deeper than a bound.
 *
 * `JSON.parse` reads nesting far deeper than any recursive walk over its
 * result can follow: a document of a few thousand nested arrays parses, then
 * overflows the stack of the first reader that recurses into it. A reader of a
 * file someone else wrote asks this first and refuses the file, rather than
 * fail halfway through with an error that names nothing.
 *
 * The walk stops at the bound, so it never recurses deeper than `max` itself.
 */

/** The deepest nesting a design file read back may hold: far above any drawn page. */
export const MAX_JSON_NESTING = 1024

/**
 * Whether `value` holds arrays or objects nested more than `max` levels deep.
 *
 * @param value - a value `JSON.parse` returned.
 * @param max - the deepest nesting allowed; a scalar is depth 0, `[]` is 1.
 */
export const nestsDeeperThan = (value: unknown, max: number = MAX_JSON_NESTING): boolean => {
  if (typeof value !== 'object' || value === null) return false
  if (max <= 0) return true
  const children: readonly unknown[] = Array.isArray(value) ? value : Object.values(value)
  return children.some((child) => nestsDeeperThan(child, max - 1))
}
