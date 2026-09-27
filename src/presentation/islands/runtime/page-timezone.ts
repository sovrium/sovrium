/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The operator timezone for date display formats, as the server stamped it.
 *
 * The server writes the operator timezone (`SOVRIUM_TIMEZONE`, UTC when unset)
 * onto `<html data-timezone>`, beside the `lang` that `resolvePageLocale` reads,
 * so a grid cell rendered in the browser shows the same wall clock as the
 * records API's `?format=display`. The island never reads the environment
 * itself: the value travels in the page it was served with.
 *
 * Returns `undefined` outside a DOM or on a page that carries no stamp, which
 * leaves the formatter on the runtime's own zone — the pre-existing behaviour.
 */
export function resolvePageTimezone(): string | undefined {
  if (typeof document === 'undefined') return undefined
  const zone = document.documentElement.dataset['timezone']
  return zone !== undefined && zone.length > 0 ? zone : undefined
}
