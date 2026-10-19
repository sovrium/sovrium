/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Recursively apply a transform to every string in a config- or JSON-shaped
 * value (strings, arrays, plain objects). Non-string leaves pass through
 * untouched.
 *
 * The one deep walk for "rewrite each string of a value": the app-level token
 * replacer, the page `$record` / `$query` / `$window` substitutions and the
 * browser's fetch-body fill all map strings over arbitrary config shapes, and
 * a private copy per caller is how one of them comes to skip a list the others
 * walk. It lives here, with no imports, because the browser runtime ships it
 * on every page: a module that carries anything else ships that too.
 *
 * A transform may return a non-string — a whole-value reference can stand for
 * a list — and that value replaces the string leaf as-is.
 */
export function mapStringsDeep(value: unknown, transform: (str: string) => unknown): unknown {
  if (typeof value === 'string') return transform(value)
  if (Array.isArray(value)) return value.map((item) => mapStringsDeep(item, transform))
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, val]) => [key, mapStringsDeep(val, transform)])
    )
  }
  return value
}
