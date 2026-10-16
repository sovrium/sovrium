/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * THE byte formatter. One function, one module, one tiny import.
 *
 * It is deliberately NOT co-located with the rest of `cell-value-format.ts`.
 * A KPI tile needs only this arithmetic, while `formatCellValue` reaches
 * `currency-format` and the whole `ColumnFormat` ladder behind it — folding the
 * two together cost the KPI island 1.9 KB of mount weight for code it never
 * calls, which the island payload budget caught on the commit that did it.
 *
 * Both consumers land here, so a KPI tile (`kpiFormat: { type: 'bytes' }`) and
 * a column or `record-field` declaring `format: 'bytes'` cannot print the same
 * number two ways on the same page.
 *
 * Below 1024 bytes the raw count is suffixed with `B` and never carries a
 * fraction. Larger values move into the next binary unit and keep ONE decimal
 * while they are below 10 in that unit — `1.5 MB`, `9.8 KB` — because rounding
 * `1.5 MB` to `2 MB` misstates it by a third; at 10 and above the integer is
 * precise enough (`12 MB`). A trailing `.0` is dropped (`1 KB`, not `1.0 KB`).
 * A non-finite input renders `0 B` rather than `NaN B`.
 *
 * ## The page locale
 *
 * The NUMBER is written by `Intl.NumberFormat` in the page locale, so a French
 * page reads `1,5 ko` where an English one reads `1.5 KB`. Digit grouping is
 * off: the count never reaches four digits past the first unit, and `1023 B`
 * is clearer than `1,023 B` beside `1 KB`.
 *
 * The UNIT symbols come from {@link UNIT_SYMBOLS} rather than from `Intl`'s own
 * `style: 'unit'`. CLDR spells the English short units `byte` and `kB`, so
 * routing English through it would have rewritten every size this engine
 * prints today (`512 byte`, `11 kB`); and two ICU builds (Bun's, the
 * browser's) are not guaranteed to agree on a unit label, while a size must
 * read the same in a server-rendered row and in the grid island beside it.
 * French takes CLDR's octet symbols (`o`, `ko`, `Mo`, `Go`); a language with no
 * entry keeps the English symbols, which are also the no-locale default.
 */
import { usableLocale } from './usable-locale'

/** `[byte, kilo, mega, giga]`, by primary language subtag. */
const UNIT_SYMBOLS: Readonly<Record<string, readonly string[]>> = {
  fr: ['o', 'ko', 'Mo', 'Go'],
}
const ENGLISH_SYMBOLS = ['B', 'KB', 'MB', 'GB'] as const

/**
 * A byte count in binary units, written in `locale` (the page locale; English
 * when omitted).
 */
export function formatByteCount(bytes: number, locale = 'en-US'): string {
  const tag = usableLocale(locale)
  const symbols = UNIT_SYMBOLS[tag.split('-')[0] ?? ''] ?? ENGLISH_SYMBOLS
  // The unit's power of 1024: 0 for bytes, up to 3 for gigabytes.
  const power = Number.isFinite(bytes)
    ? Math.min(3, Math.floor(Math.log2(Math.max(bytes, 1)) / 10))
    : 0
  const scaled = Number.isFinite(bytes) ? bytes / 1024 ** power : 0
  // One decimal below 10 in the unit, the integer from 10 up; never a fractional byte.
  const digits = power > 0 && Math.round(scaled * 10) < 100 ? 1 : 0
  const figure = new Intl.NumberFormat(tag, {
    maximumFractionDigits: digits,
    useGrouping: false,
  }).format(digits === 1 ? Math.round(scaled * 10) / 10 : Math.round(scaled))
  return `${figure} ${String(symbols[power])}`
}
