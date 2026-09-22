/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The design-system fixture, reachable under a reserved TABLE name.
 *
 * ─── WHY A SECOND TRANSPORT AT ALL ─────────────────────────────────────────
 *
 * Two component types can only bind a table. `record-picker` takes
 * `dataSource: { table }` and has no system arm at all; `comments` binds
 * `table` plus `recordId`. Neither can be pointed at a read endpoint, so
 * without an address in that vocabulary the catalogue documents them over an
 * empty shell — and widening either schema to accept an endpoint is an
 * `AppSchema` change this phase does not make.
 *
 * So the fixture gains an address rather than the schema gaining an option.
 * `SPECIMEN_TABLE_NAME` is feature-prefixed, so an operator cannot make the
 * console reachable by declaring a table that happens to be called the right
 * thing.
 *
 * ─── AND WHY IT DOES NOT REPLACE THE ENDPOINT ──────────────────────────────
 *
 * The EMPTY state does not survive the move. `paginationSchema` floors a page's
 * `limit` at one row and the request guard beside it answers `limit=0` with a
 * 400 rather than inventing an intent the request does not carry, so a bound
 * table can serve rows but never NO rows above a tally that agrees with them.
 * `?rows=` on the sibling endpoint can, which is why neither transport is
 * redundant — and why this one deliberately implements no cap.
 *
 * The two consumers do not need the empty state from here: a picker's empty
 * state is "no matches for this search", and an unbound comments section
 * already draws its own.
 *
 * ─── READ ONLY, BY OMISSION RATHER THAN BY REFUSAL ─────────────────────────
 *
 * There is exactly one route here and it is a GET. A write to this table name
 * falls through to the ordinary record routes, where `validateTable` answers
 * 404 because no such table is declared — the same answer any undeclared table
 * gives, and the S1 anti-enumeration contract the rest of the family speaks.
 *
 * That omission is load-bearing twice over: [internal ref] defines this console as
 * read-only, and a fixture an operator could edit would change what every other
 * instance's catalogue documents — destroying the determinism a specimen is
 * compared against an ordinary page with.
 *
 * ─── THE GATE IS THE NAMESPACE'S, NOT THE ADMIN TIER'S ─────────────────────
 *
 * `/api/tables/*` attaches a session and requires one (`api-routes.ts`), and
 * this route inherits exactly that. It is a wider audience than the
 * admin-tier-gated sibling endpoint, and deliberately so: the payload is a
 * platform constant identical on every instance, and holding a route inside
 * `/api/tables/*` to a stricter contract than the namespace declares is how a
 * caller ends up with a 404 nothing explains.
 */

import { decodeSafe } from '@/domain/models/api/combinators/decode'
import { listRecordsResponseSchema } from '@/domain/models/api/tables/tables'
import { windowSpecimenRows } from '@/domain/models/app/design/specimen-fixture'
import { parseOptionalPositive } from '@/presentation/api/runtime/query-cap-parsers'
import type { SpecimenRow } from '@/domain/models/app/design/specimen-fixture'
import type { Context } from 'hono'

/**
 * The page a caller that named no size gets.
 *
 * The records API's own default (`paginationQuerySchema`), restated rather than
 * imported because that schema carries it as a decoding default on a shape this
 * handler does not decode — and a bound picker that asked for nothing must get
 * the same page size here as it would from a real table.
 */
const DEFAULT_PAGE_SIZE = 20

/**
 * Project a fixture row into the record envelope the records API returns.
 *
 * `id` is lifted to the root and everything else becomes a `fields` entry,
 * which is the shape a bound component reads — a picker looks in `fields`, and
 * a row that carried its id there would be a record with no identity.
 *
 * Both timestamps are the row's own `scheduledAt`. The fixture has no edit
 * history to describe, and inventing two different instants would document a
 * revision that never happened.
 */
function toRecord(row: SpecimenRow): Readonly<Record<string, unknown>> {
  const { id, ...fields } = row
  const at = String(row['scheduledAt'])
  return { id: String(id), fields, createdAt: at, updatedAt: at }
}

/** `GET /api/tables/design_system_specimens/records` — the fixture, as records. */
export function handleListSpecimenTableRecords(c: Context): Response {
  const limit = parseOptionalPositive(c.req.query('limit')) ?? DEFAULT_PAGE_SIZE
  const page = parseOptionalPositive(c.req.query('page')) ?? 1
  const { items, total } = windowSpecimenRows({ page, limit }, new Date())
  const totalPages = Math.ceil(total / limit)

  const body = decodeSafe(listRecordsResponseSchema)({
    records: items.map(toRecord),
    pagination: {
      page,
      limit,
      offset: (page - 1) * limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
    // `appliedQuery` is OMITTED, not null. The key's presence is the route's
    // declaration that IT did the filtering, and this one ignores `?q=` — so
    // claiming otherwise would stop a bound grid narrowing a page nobody
    // narrowed.
  })

  if (!body.success) {
    return c.json(
      { success: false, message: 'Failed to build specimen records', code: 'INTERNAL_ERROR' },
      500
    )
  }

  // Identical on every instance, but anchored on the current month — so a
  // shared cache would pin the calendar specimens to the month it first saw.
  c.header('Cache-Control', 'no-store')
  return c.json(body.data, 200)
}
