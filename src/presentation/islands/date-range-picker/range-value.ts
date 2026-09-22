/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { formatDate, parseIso } from '../date-picker/date-format-helpers'
import type { DateRange } from '../date-picker/date-format-helpers'

/**
 * The period as ONE value: the ISO 8601 interval `<from>/<to>`.
 *
 * Two form fields (`periodFrom`, `periodTo`) was the alternative and was
 * refused. It invents a naming convention every consumer then has to know, and
 * it lets a HALF-submitted period exist — which a period is not. One field means
 * one value, and the slash is where a reader and a parser both split it.
 *
 * The same rule governs the incomplete state: while a reader has clicked one end
 * and not the other, the submitted value is EMPTY rather than a lone date. A
 * consumer reading `2026-09-10` out of a period field would have to guess
 * whether it was a start with no end or an end with no start.
 */

/** `<from>/<to>`, or `''` while the period is incomplete. */
export function formatInterval(range: DateRange | undefined): string {
  if (!range?.from || !range.to) return ''
  return `${formatDate(range.from, undefined)}/${formatDate(range.to, undefined)}`
}

/**
 * Parse an authored `value` into a range.
 *
 * Anything that is not two ISO days around a slash yields `undefined` — which
 * covers a `$record.`/`$param.` reference that reached the browser unresolved.
 * Rendering an unresolved reference as a period would put a literal
 * `$record.period` on the trigger; an empty picker shows the placeholder, which
 * is at least true.
 */
export function parseInterval(value: string | undefined): DateRange | undefined {
  if (!value) return undefined
  const [rawFrom, rawTo, ...rest] = value.split('/')
  if (rest.length > 0) return undefined
  const from = parseIso(rawFrom)
  const to = parseIso(rawTo)
  return from && to ? { from, to } : undefined
}

/**
 * Order the two ends a reader clicked.
 *
 * A period picked backwards — the later day first — is a period, not a mistake
 * to refuse: the reader named both ends and the order they happened to click
 * them in is not information anyone wants preserved.
 */
export function orderedRange(first: Date, second: Date): DateRange {
  return first <= second ? { from: first, to: second } : { from: second, to: first }
}
