/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { Layer } from 'effect'
import {
  McpInternalsDatabaseError,
  McpInternalsRepository,
} from '@/application/ports/repositories/mcp/mcp-internals-repository'
import { db } from '@/infrastructure/database'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'
import { executeRaw } from '@/infrastructure/database/sql/dialect-execute'
import { authTableRef, systemTableRef } from '@/infrastructure/database/sql/dialect-sql'
import type { InternalTableEntry } from '@/domain/models/app/tables/internal-tables'

/** Wrap a DB promise, adapting failures to `McpInternalsDatabaseError`. */
const wrap = makeDbWrap((cause) => new McpInternalsDatabaseError({ cause }))

/**
 * A dialect-aware, safely-quoted table reference for an internal registry entry.
 *
 * Delegates to the same `authTableRef` / `systemTableRef` helpers the GDPR
 * erasure sweep uses, so the reference is correct on BOTH dialects:
 * `auth.session` / `system."links"` on Postgres, `auth_session` /
 * `system_links` on SQLite. A hand-spliced `${entry.schema}.${entry.name}` form
 * is Postgres-only and raises "no such table" on the zero-config SQLite default.
 */
const internalTableRef = (entry: Readonly<InternalTableEntry>) =>
  entry.schema === 'auth' ? authTableRef(entry.name) : systemTableRef(entry.name)

export const McpInternalsRepositoryLive = Layer.succeed(McpInternalsRepository, {
  listRows: (entry: Readonly<InternalTableEntry>, limit: number) =>
    wrap(() => {
      // `LIMIT` stays an inlined SQL literal (the caller clamps it to an
      // integer in `[1, 1000]`) because `LIMIT $1` round-trips poorly through
      // bun:sql's param-binding path; the value can never be anything but a
      // small integer.
      //
      // No `ORDER BY` because not every internal table has a stable ordering
      // column (e.g. `auth.organization` lacks `created_at`). The MCP spec does
      // not promise list-ordering for internal tools, so leaving this unsorted
      // is honest.
      const safeLimit = Math.floor(limit)
      return executeRaw(
        db,
        sql`SELECT * FROM ${internalTableRef(entry)} LIMIT ${sql.raw(String(safeLimit))}`
      )
    }),

  readRow: (entry: Readonly<InternalTableEntry>, id: string) =>
    wrap(async () => {
      // `id` is first-order user input (`args.id` off the JSON-RPC envelope),
      // so it is bound as a VALUE through the `sql` template tag — never
      // spliced as text. Quote doubling is not an escaping strategy; it is a
      // coincidence that holds until the first backslash or dollar-quote (S3).
      const rows = await executeRaw(
        db,
        sql`SELECT * FROM ${internalTableRef(entry)} WHERE id = ${id} LIMIT 1`
      )
      return rows[0]
    }),
})
