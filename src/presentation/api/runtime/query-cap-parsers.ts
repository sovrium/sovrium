/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A `?limit=`-style cap, converted from the string a query param always is into
 * the number a handler can `slice` with.
 *
 * The conversion is kept beside the handlers rather than pushed into the query
 * schema, where a decode failure would become a **400**: how much of an answer
 * a caller wants is not a question about whether the request is well formed,
 * and an operator following a hand-edited URL deserves the whole list rather
 * than a validation error. So an unusable value is IGNORED — read as "no cap"
 * and answered in full.
 *
 * What it must never do is reach `slice` as `NaN`. `slice(0, NaN)` returns
 * NOTHING, so a typo would silently answer an empty list — which reads as a
 * real cap rather than as the ignored typo it is, and is the failure this
 * function exists to make impossible.
 *
 * Two edges, both deliberate and both easy to get backwards:
 *
 * - **Zero IS a cap and is honoured.** "Tell me how many without listing them"
 *   is a question these endpoints answer, and the EMPTY state is the whole
 *   reason some of them carry a cap at all.
 * - **An empty param is NOT.** `?rows=` numbers to `0` in JavaScript while
 *   meaning "unset" to whoever typed it, so it is read as absent.
 *
 * ─── WHY THIS IS SHARED AND WHAT IS DELIBERATELY NOT ──────────────────────
 *
 * `?rows=` on the design-system specimen rows and `?routesLimit=` on a
 * component-type detail had a private copy of this each, written months apart
 * and byte-identical down to the `>= 0`. They agreed only because nobody had
 * yet changed one; the next change to what a malformed cap means would have had
 * to find both for the family to keep one answer.
 *
 * `parseLimit` in `developer-reads.ts` is NOT one of them and must not be
 * folded in. It requires `> 0` — zero is not a cap there, it is a typo — and
 * that difference is the endpoint's contract, not drift.
 */
export function parseOptionalCap(raw: string | undefined): number | undefined {
  if (raw === undefined || raw.trim() === '') return undefined
  const cap = Number(raw)
  return Number.isInteger(cap) && cap >= 0 ? cap : undefined
}

/**
 * A `?page=` / `?limit=` value, converted the same way and floored at ONE.
 *
 * Same ignore-rather-than-400 contract as {@link parseOptionalCap} above, and
 * the same refusal to reach `slice` as `NaN`. It differs on exactly one edge,
 * and the difference is the point: **zero is not a page**. `?rows=0` is the
 * documented empty state and means something; `?limit=0` is a typo, and reading
 * it as a cap would serve no rows above a total that says there are thirty —
 * the self-contradicting page `parseOptionalCap` exists to make reachable
 * deliberately and this one must never produce by accident.
 *
 * `parseLimit` in `developer-reads.ts` applies the same floor and is still NOT
 * folded in: that endpoint decides its own contract, and a shared parser two
 * callers happen to agree with today is not the same thing as a shared
 * contract.
 */
export function parseOptionalPositive(raw: string | undefined): number | undefined {
  if (raw === undefined || raw.trim() === '') return undefined
  const value = Number(raw)
  return Number.isInteger(value) && value >= 1 ? value : undefined
}
