/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The words the server's `Intl` writes between a date and its time in the page
 * language, as it stamped them on `<html data-datetime-glue>` — `' à '` on a
 * French page — so a datetime the browser formats reads exactly as one the
 * server drew. `undefined` outside a DOM or on a page that carries none.
 *
 * A module of its own, beside `page-timezone`, so only the islands that read it
 * carry it.
 */
export function resolvePageDateTimeGlue(): string | undefined {
  if (typeof document === 'undefined') return undefined
  return document.documentElement.dataset['datetimeGlue']
}
