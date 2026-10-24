/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { computeCurrencyDisplayClasses } from '../../../design/field-affordances-default-classes'
import type { ColumnFormat } from '@/domain/models/app/pages/components/component-types/data/table/schema'

/**
 * The formats that render as a FIXED-ADVANCE readout.
 *
 * The numeric formats are, because each produces a value a reader scans DOWN a
 * column rather than reads across a line: a price against the price above it,
 * a byte count against a byte count. Proportional digits defeat that — `1,111`
 * is narrower than `9,999` — so the column stops being comparable at a glance
 * and the decimal points wander.
 *
 * `truncate` is deliberately absent: it shortens PROSE, and prose in a fixed
 * face is harder to read, not easier. So are `yes-no` and `check-cross`, which
 * produce a word and a glyph.
 */
const MONO_DISPLAY_FORMATS = new Set<ColumnFormat>([
  'currency',
  'percentage',
  'compact',
  'bytes',
  'time-ms',
])

/**
 * The date formats: TABULAR digits in the text face, never the fixed one.
 *
 * A date is read as words as much as figures ("Oct 16, 2026, 2:24 PM"), and a
 * whole column of them in a monospace face reads as code. `tabular-nums` keeps
 * what the fixed face was there for — digits of one width, so a column of
 * dates still lines up — without the month names and the separators taking a
 * code font's width.
 *
 * `duration` reads the same way (`1.2 s`, `2 min 5 s`): words around figures,
 * set beside a Started column of dates, so it takes their face rather than a
 * code font's.
 */
const DATE_DISPLAY_FORMATS = new Set<ColumnFormat>([
  'relative-date',
  'relative-time',
  'day-relative-time',
  'day-relative-time-seconds',
  'short-date',
  'long-date',
  'datetime',
  'duration',
])

/**
 * `check-cross` renders a 14px `✓` / `✗` and NO colour.
 *
 * A green tick and a red cross would be the platform choosing a vocabulary the
 * column never declared, and would put the whole meaning in a hue for a reader
 * who cannot separate the two. The glyphs already differ in shape, which is
 * what carries it; the extra step of size is there because a 12px tick in a
 * column of 12px words disappears into them.
 */
const GLYPH_DISPLAY_FORMATS = new Set<ColumnFormat>(['check-cross'])

/** The class a value drawn in an explicit `format` wears, before its `cellStyle`. */
export function formatClassOf(format: ColumnFormat): string {
  if (MONO_DISPLAY_FORMATS.has(format)) return `${computeCurrencyDisplayClasses()} font-mono`
  if (DATE_DISPLAY_FORMATS.has(format)) return computeCurrencyDisplayClasses()
  return GLYPH_DISPLAY_FORMATS.has(format) ? 'inline-block text-md leading-none' : ''
}
