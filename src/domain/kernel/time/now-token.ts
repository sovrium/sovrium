/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The `$now` token: "the moment this value was taken", written the way the
 * column it lands in reads it.
 *
 * One definition for every place the token resolves — a form field's default
 * applied at submit time, and a prefill map resolved while a page renders — so
 * the same token never produces two spellings of the same instant.
 */

/** The literal token authors write. */
export const NOW_TOKEN = '$now'

/** What the resolver needs to know about the column a `$now` value lands in. */
export interface NowTokenColumn {
  readonly type: string
  /** A `date` column that also stores a time reads a full instant. */
  readonly includeTime?: boolean
}

/**
 * The value `$now` stands for at `at`: an ISO-8601 instant (`2026-09-27T10:04:12.000Z`),
 * or just its calendar day (`2026-09-27`) when it lands in a date-only column.
 * With no column, the full instant.
 */
export function resolveNowToken(at: Readonly<Date>, column?: NowTokenColumn): string {
  const instant = at.toISOString()
  const dateOnly = column?.type === 'date' && column.includeTime !== true
  return dateOnly ? instant.slice(0, 10) : instant
}
