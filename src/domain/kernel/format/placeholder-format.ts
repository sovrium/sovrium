/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Substitute `{name}` placeholders in a template with the named values.
 *
 * The interpreter's own interface strings carry their variable parts this way
 * (`Page {page} of {count}`), so a translation can move a value to wherever its
 * language puts it rather than inheriting the English word order. A
 * placeholder with no value is left as written, so a missing value shows up on
 * the page instead of vanishing silently.
 *
 * @example
 * ```typescript
 * fillPlaceholders('Page {page} of {count}', { page: 1, count: 3 }) // 'Page 1 of 3'
 * ```
 */
export function fillPlaceholders(
  template: string,
  values: Readonly<Record<string, string | number>>
): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = values[name]
    return value === undefined ? match : String(value)
  })
}
