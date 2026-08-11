/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Relative-date tokens for seed files.
 *
 * A seed data set that hard-codes calendar dates rots. The demo fleet is
 * re-seeded nightly and a CRM whose deals all closed last July looks abandoned
 * by November — every dashboard, calendar and chart in the app renders an empty
 * or stale window. Relative tokens are what make a *regenerated* data set worth
 * more than a snapshot: the data ages with the clock instead of against it.
 *
 * ## Grammar
 *
 * ```
 * token  := '{{' WS? anchor WS? offset? WS? '}}'
 * anchor := 'today' | 'now'
 * offset := ('+' | '-') WS? INT WS? unit
 * unit   := 'd' | 'w' | 'h' | 'm'      // days, weeks, hours, minutes
 * ```
 *
 * `today` renders a date-only `YYYY-MM-DD`; `now` renders a full ISO 8601
 * instant. Both are computed **in UTC**, deliberately: the demo host runs in
 * Europe/Paris and CI runs in UTC, and a local-time `today` would render a
 * different date on each — the seeded data would stop being a pure function of
 * its input, and a "why is this row a day off" bug would only reproduce on one
 * machine.
 *
 * ## Two rules that exist to prevent a silent wrong answer
 *
 * 1. **Whole-value only.** The token must be the entire field value, not
 *    embedded in prose. An embedded token would have to guess whether the
 *    surrounding field wants a date or a sentence, and a `date` column handed
 *    `Due 2026-01-08` fails at the driver — far from the seed file that caused
 *    it.
 * 2. **An unrecognised `{{…}}` is an ERROR, never a pass-through.** A typo like
 *    `{{today +7d}}` (space before the sign) would otherwise be stored
 *    verbatim, and the defect surfaces as literal braces rendered on a live
 *    demo page. Refusing at parse time names the file and the row instead.
 *
 * A literal value that must genuinely start with `{{` is escaped as `\{{`.
 */

/** Time units accepted in a relative-date offset. */
export type RelativeDateUnit = 'd' | 'w' | 'h' | 'm'

/** The anchor instant a token is measured from. */
export type RelativeDateAnchor = 'today' | 'now'

/** A parsed relative-date token. `amount` is signed (negative for `-`). */
export interface RelativeDateToken {
  readonly anchor: RelativeDateAnchor
  /** Signed offset; `0` when the token carries no offset at all. */
  readonly amount: number
  readonly unit: RelativeDateUnit
}

/**
 * Matches a complete relative-date token and nothing else.
 *
 * Anchored at both ends on purpose — see rule 1 above.
 */
const TOKEN_PATTERN = /^\{\{\s*(today|now)\s*(?:([+-])\s*(\d+)\s*([dwhm]))?\s*\}\}$/

/** Any `{{…}}` sequence, used only to detect a malformed token. */
const ANY_TOKEN_PATTERN = /\{\{/

/** Prefix that escapes a literal value which really does start with `{{`. */
const ESCAPE_PREFIX = '\\'

const MS_PER_UNIT: Readonly<Record<RelativeDateUnit, number>> = {
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 604_800_000,
}

/**
 * Parse a relative-date token, or return `undefined` when the string is not a
 * well-formed token. `undefined` does NOT mean "safe to pass through" — the
 * caller must still check {@link looksLikeToken}.
 */
export const parseRelativeDateToken = (raw: string): RelativeDateToken | undefined => {
  const match = TOKEN_PATTERN.exec(raw)
  if (!match) return undefined

  const anchor = match[1] as RelativeDateAnchor
  const sign = match[2]
  const digits = match[3]
  const unit = match[4] as RelativeDateUnit | undefined

  if (sign === undefined || digits === undefined || unit === undefined) {
    return { anchor, amount: 0, unit: 'd' }
  }

  const magnitude = Number.parseInt(digits, 10)
  return { anchor, amount: sign === '-' ? -magnitude : magnitude, unit }
}

/**
 * True when the string contains a `{{` that is not escaped — i.e. the author
 * meant a token. Combined with a failed {@link parseRelativeDateToken} this is
 * how a malformed token is distinguished from ordinary prose.
 */
export const looksLikeToken = (raw: string): boolean =>
  !raw.startsWith(ESCAPE_PREFIX) && ANY_TOKEN_PATTERN.test(raw)

/**
 * Render a parsed token against a fixed anchor instant.
 *
 * `runAt` is supplied by the caller rather than read from the clock so that
 * every row of every table in one `sovrium seed` run shares one instant. Two
 * tables seeded either side of midnight would otherwise disagree about what
 * `{{today}}` means, and the resulting off-by-one-day link between a deal and
 * its task is precisely the kind of defect nobody reproduces.
 */
export const expandRelativeDate = (token: RelativeDateToken, runAt: Readonly<Date>): string => {
  const shifted = new Date(runAt.getTime() + token.amount * MS_PER_UNIT[token.unit])
  const iso = shifted.toISOString()
  return token.anchor === 'today' ? iso.slice(0, 10) : iso
}

/** Outcome of expanding one string-valued seed field. */
export type ExpandOutcome =
  { readonly ok: true; readonly value: string } | { readonly ok: false; readonly reason: string }

/**
 * Expand a single seed field value.
 *
 * - A well-formed token renders.
 * - A `\`-escaped value has the escape stripped and is stored literally.
 * - A malformed token is REFUSED, naming what was accepted.
 * - Anything else passes through untouched.
 */
export const expandSeedStringValue = (raw: string, runAt: Readonly<Date>): ExpandOutcome => {
  const token = parseRelativeDateToken(raw)
  if (token) return { ok: true, value: expandRelativeDate(token, runAt) }

  if (raw.startsWith(ESCAPE_PREFIX)) return { ok: true, value: raw.slice(ESCAPE_PREFIX.length) }

  if (looksLikeToken(raw)) {
    return {
      ok: false,
      reason:
        `Unrecognised template token in "${raw}". ` +
        `Expected {{today}}, {{now}}, or an offset like {{today+7d}} / {{now-2h}} ` +
        `(units: d, w, h, m) as the entire value. ` +
        `To store this text literally, escape it as "\\${raw}".`,
    }
  }

  return { ok: true, value: raw }
}
