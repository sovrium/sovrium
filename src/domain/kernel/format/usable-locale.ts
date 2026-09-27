/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The locale a format actually runs under. The page locale arrives from
 * `<html lang>`, which an author writes, and `Intl` throws a `RangeError` on a
 * malformed tag — a cell must degrade to the platform default rather than take
 * the whole grid down with it.
 *
 * Its own module, rather than a member of the grid's value formatter, because
 * every island that prints a date needs it and most of them need nothing else
 * from that formatter: importing it from there carried the currency and byte
 * arithmetic into islands that format neither.
 */
export function usableLocale(locale: string): string {
  try {
    return Intl.getCanonicalLocales(locale)[0] ?? 'en-US'
  } catch {
    return 'en-US'
  }
}
