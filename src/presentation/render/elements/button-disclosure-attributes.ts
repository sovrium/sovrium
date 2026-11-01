/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The disclosure attributes of a `click.toggleElement` trigger.
 *
 * A `#id` target makes its trigger a disclosure: `aria-controls` names the
 * element and `aria-expanded` starts collapsed, kept in step by the page's
 * click runtime from the target's real visibility (it also closes the target
 * on Escape). Any other selector, such as the alert's own dismiss, gets none.
 */
export function disclosureAttributes(selector: string): Record<string, string> {
  return /^#[\w-]+$/.test(selector)
    ? { 'aria-controls': selector.slice(1), 'aria-expanded': 'false' }
    : {}
}
