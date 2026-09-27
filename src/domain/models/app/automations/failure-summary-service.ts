/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { redactConnectionUrl } from '@/domain/kernel/sanitize/redact-connection-url'

/**
 * How a run's error reads in an email — pure, no I/O.
 *
 * A run's stored error is whatever the failing step threw, and a database
 * driver throws a lot: a multi-line message, a `DETAIL:` block, and the ROW
 * values that collided (`Key (email)=(someone@example.com) already exists`).
 * An email leaves the instance, so the line it carries is summarised first:
 *
 *   1. only the first line;
 *   2. every `Key (col)=(value)` payload replaced by `Key (col)=(…)` — the
 *      column stays, it says what collided; the value goes;
 *   3. everything from `DETAIL:` or `Failing row contains` onward (any case)
 *      dropped, except those redacted `Key (col)=(…)` references, kept as
 *      `DETAIL: Key (col)=(…)`. A detail block can quote a whole row, so
 *      nothing else of it survives;
 *   4. a password inside a connection URL masked;
 *   5. at most `max` characters, a trailing `…` marking the cut.
 */

/** The default length of a summarised error line. */
const DEFAULT_MAX_LENGTH = 200

/**
 * A driver's `Key (col)=(value)` fragment — the column shape PostgreSQL uses in
 * its detail line (see `NULL_COLUMN_PATTERNS` in `domain/errors/driver-failure`),
 * read in any case: an exclusion violation adds `existing key (col)=(value)`.
 * The value runs GREEDILY to the last `)` that ends a word before the next
 * `Key (` — a value is arbitrary data and may itself hold `) ` or an unbalanced
 * parenthesis (`Key (span)=([1,5))`), so stopping at the first plausible close
 * would print the rest of it. Over-redacting prose is the accepted cost.
 */
const KEY_PAYLOAD = /Key \(([^)]+)\)=\((?:(?!Key \().)*\)(?=\s|$|[.,;:])/gi

/**
 * A `Key (col)=(` whose value never closes on this line (the first-line cut can
 * land inside a multi-line value): everything after it, up to the next `Key (`,
 * is value and goes. Already-redacted payloads are skipped.
 */
const OPEN_KEY_PAYLOAD = /Key \(([^)]+)\)=\((?!…\))(?:(?!Key \().)*/gi

/** A `Key (col)=(value)` match, its value replaced. */
const redactKey = (match: ArrayLike<string>): string => `Key (${match[1] ?? ''})=(…)`

/** Where a driver's detail block starts — its own marker, or the row it quotes. */
const DETAIL_MARKER = /\bdetail:|\bfailing row contains\b/i

/** A token carrying a URL with an authority, the only shape the redactor reads. */
const hasAuthority = (token: string): boolean => token.includes('://')

/** Mask connection-URL passwords token by token, so a sentence around one survives. */
const redactUrls = (line: string): string =>
  line
    .split(' ')
    .map((token) => (hasAuthority(token) ? redactConnectionUrl(token) : token))
    .join(' ')

/** Cut `line` to `max` characters, ending on `…` when anything was removed. */
const truncate = (line: string, max: number): string =>
  line.length <= max ? line : `${line.slice(0, Math.max(0, max - 1)).trimEnd()}…`

/**
 * The one line an email may print for a run's error.
 *
 * @param error - The run's stored error, as thrown.
 * @param max - The longest line to return, the `…` included.
 * @returns The summarised line; `''` for an empty or blank error.
 */
export const summariseRunError = (error: string, max: number = DEFAULT_MAX_LENGTH): string => {
  const firstLine = error.split(/\r?\n/, 1)[0] ?? ''
  const detail = DETAIL_MARKER.exec(firstLine)
  const head = detail === null ? firstLine : firstLine.slice(0, detail.index)
  const keptKeys =
    detail === null
      ? []
      : Array.from(firstLine.slice(detail.index).matchAll(KEY_PAYLOAD), redactKey)
  const redacted = head
    .replace(KEY_PAYLOAD, (...match: readonly string[]) => redactKey(match))
    .replace(OPEN_KEY_PAYLOAD, (...match: readonly string[]) => `${redactKey(match)} `)
  const line =
    keptKeys.length === 0 ? redacted : `${redacted.trimEnd()} DETAIL: ${keptKeys.join(', ')}`
  return truncate(redactUrls(line).trim(), max)
}
