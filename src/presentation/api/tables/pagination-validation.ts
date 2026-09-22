/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { MAX_PAGE_SIZE } from '@/domain/models/api/combinators/common'
import type { Context } from 'hono'

/**
 * Request-side guard for `?limit=` and `?offset=` on the record-list routes.
 *
 * ## The defect this closes
 *
 * `paginationSchema` (`domain/models/api/combinators/common.ts`) constrains the
 * pagination block of the RESPONSE — `limit` an integer in `[1, 100]`,
 * `offset` a non-negative integer — while `parseListRecordsParams` handed the
 * client's value straight through as `Number(raw)`. Anything the response
 * schema refused therefore failed on the way OUT, inside `runEffect`, and the
 * caller was told `500 Internal Server Error`. Measured on both dialects
 * (2026-09-01): `limit` of `0`, `-5`, `1.5`, `101`, `500`, `1e3` or `abc`, and
 * `offset` of `-5` or `abc`, every one a 500. A value the client supplied and
 * the contract rejects is a bad REQUEST; 500 tells the caller the server
 * broke, which sends them to look in the wrong place entirely.
 *
 * ## Why 400 and not a silent clamp
 *
 * Both shapes have precedent in this repo. `GET /api/analytics/events`
 * rejects an out-of-range `limit` with a 400 (`validatePagination`,
 * `routes/analytics.ts`); `/api/recent`, `/api/users/directory` and the
 * webhook-delivery list clamp to their ceiling. The record-list route follows
 * analytics, for two reasons:
 *
 *   - **Analytics is the structural twin.** It is the other authenticated list
 *     endpoint taking `limit` + `offset` and answering with a pagination block
 *     its own response schema validates. The clamping endpoints are cursor- or
 *     ceiling-shaped and never promise the caller a page arithmetic they could
 *     get wrong. Consistency across the two comparable surfaces beats
 *     consistency with a differently-shaped one.
 *   - **A clamp is a silent wrong answer for a paging client.** A caller
 *     walking the table with `offset += limit` at `limit=500`, served 100 rows
 *     per page, skips 400 rows on every step and is never told. And `limit=0`,
 *     `limit=-5` and `limit=abc` cannot be clamped at all without INVENTING an
 *     intent the request does not carry. This route already refuses to guess
 *     elsewhere for the same reason — see the `offset`-beats-`page` note on
 *     `resolveOffset` in `parsers/param-parsers.ts`.
 *
 * ## Ordering (standing rule S1)
 *
 * This runs from `validateListRecordsParams`, i.e. AFTER `checkListReadGate`
 * and after the row-level read predicate has had its say. A caller who may not
 * read the table still gets the anti-enumeration `404`, and one whose guard
 * resolves to "no rows" still gets the empty `200` — neither is converted into
 * a `400` that would confirm the table exists. Same placement, and same
 * reasoning, as the timezone / sort / fields validators beside it.
 *
 * ## What is deliberately NOT validated here
 *
 * `?page=` — `resolveOffset` documents that a `page` which is not a positive
 * finite number is IGNORED rather than rejected, because it cannot name a
 * window and rejecting it would fail requests the query schema advertises as
 * valid. That decision stands; this guard reads the raw `offset` the client
 * sent, never the one derived from `page`, which `resolveOffset` has already
 * proved finite and non-negative.
 */

/** A `?limit=`/`?offset=` value the response contract can actually carry. */
const isBoundedInteger = (raw: string, min: number, max: number): boolean => {
  const parsed = Number(raw)
  return Number.isInteger(parsed) && parsed >= min && parsed <= max
}

/** The 400 envelope this route family uses for every query-parameter refusal. */
const invalidParam = (c: Context, message: string) =>
  c.json({ success: false, message, code: 'VALIDATION_ERROR' }, 400)

/**
 * Return a `400` response when `?limit=` or `?offset=` names a page the
 * response contract cannot describe, or `undefined` when both are acceptable.
 *
 * An absent parameter is always acceptable — the defaults are applied
 * downstream (`DEFAULT_PAGE_SIZE`, offset `0`).
 */
export function validatePaginationParams(c: Context) {
  const limit = c.req.query('limit')
  if (limit !== undefined && limit !== '' && !isBoundedInteger(limit, 1, MAX_PAGE_SIZE)) {
    return invalidParam(
      c,
      `Invalid limit: ${limit}. Must be an integer between 1 and ${MAX_PAGE_SIZE}.`
    )
  }

  const offset = c.req.query('offset')
  if (
    offset !== undefined &&
    offset !== '' &&
    !isBoundedInteger(offset, 0, Number.MAX_SAFE_INTEGER)
  )
    return invalidParam(c, `Invalid offset: ${offset}. Must be an integer of 0 or greater.`)

  return undefined
}
