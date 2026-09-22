/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { Layer } from 'effect'
import {
  McpAuditDatabaseError,
  McpAuditRepository,
  type McpToolCallAuditEntry,
  type McpToolCallAuditRow,
} from '@/application/ports/repositories/mcp/mcp-audit-repository'
import { db } from '@/infrastructure/database'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'
import { executeRaw, executeRawTyped } from '@/infrastructure/database/sql/dialect-execute'
import { systemTableRef } from '@/infrastructure/database/sql/dialect-sql'
import { jsonbLiteral } from '@/infrastructure/database/sql/sql-utils'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'

/** Wrap a DB promise, adapting failures to `McpAuditDatabaseError`. */
const wrap = makeDbWrap((cause) => new McpAuditDatabaseError({ cause }))

/**
 * The `created_at` value the hand-written audit INSERT must supply.
 *
 * `id` and `created_at` are `NOT NULL` on both dialects, but only Postgres
 * backs them with a SQL-level `DEFAULT` (`gen_random_uuid()` / `now()`). The
 * SQLite mirror declares them as Drizzle `$defaultFn`s — application-level
 * generators the ORM runs while *building* an insert — and a raw `INSERT` like
 * this one never goes through that path. Left out, SQLite rejects the row with
 * `NOT NULL constraint failed`. Supplying both keeps ONE column list correct on
 * both engines.
 *
 * `created_at` is the half that cannot be shared, because the two dialects do
 * not merely format it differently — they store different types:
 * `timestamptz` on Postgres, an INTEGER of epoch **milliseconds** on SQLite
 * (`integer('created_at', { mode: 'timestamp_ms' })` in `schema-sqlite/ai.ts`).
 *
 * Deliberately NOT `nowExpr()` from `sql/dialect-sql.ts`, which is the
 * obvious-looking helper and the wrong one here: its SQLite arm emits an
 * ISO-8601 **TEXT** value, the right choice for the dynamic-table `TEXT`
 * timestamp family and the wrong one for this INTEGER column. SQLite's loose
 * typing would store that string without complaint, after which it sorts after
 * every genuine integer under the `ORDER BY created_at DESC` this table is read
 * with, and decodes to garbage through `timestamp_ms`. That failure is silent,
 * which is why it is called out rather than left to be rediscovered.
 */
const auditCreatedAt = () => (isSqliteRuntime() ? sql`${Date.now()}` : sql.raw('now()'))

export const McpAuditRepositoryLive = Layer.succeed(McpAuditRepository, {
  recordToolCall: (entry: McpToolCallAuditEntry) =>
    wrap(async () => {
      // Latency is wall-clock; round to the nearest integer ms because the
      // database column is INTEGER and `Date.now()` returns integer ms but a
      // future caller switching to `performance.now()` might pass a sub-ms
      // float. The min(1) clamp guarantees a positive integer,
      // which says `latency_ms` must be a positive integer (sub-ms calls
      // round to 0 on cold paths in CI).
      const roundedLatency = Math.max(1, Math.round(entry.latencyMs))

      // drizzle-orm + bun-sql binds parameter values as TEXT, which produces
      // "column is of type jsonb but expression is of type text" errors when
      // sent into a JSONB column. `jsonbLiteral` inlines the value as a
      // typed `'…'::jsonb` literal — see `sql-utils.ts` for the full rationale.
      const inputLiteral = jsonbLiteral(entry.inputArgs)
      const outputLiteral =
        entry.result === undefined ? sql.raw('NULL') : jsonbLiteral(entry.result)
      const errorMessageFragment =
        entry.errorMessage === undefined ? sql.raw('NULL') : sql`${entry.errorMessage}`
      const errorCodeFragment =
        entry.errorCode === undefined ? sql.raw('NULL') : sql`${entry.errorCode}`

      // `executeRaw` picks the dialect's execution method: `.execute()` on the
      // Postgres client, `.all()` on SQLite. `db.execute` does not exist on
      // `bun-sqlite` at all, so a direct call throws
      // `TypeError: db.execute is not a function` — and because the DISPATCHER
      // swallows an audit failure to keep the live request alive, that threw
      // silently and left the trail empty on the zero-config default engine.
      // eslint-disable-next-line functional/no-expression-statements -- side-effecting INSERT into the audit log
      await executeRaw(
        db,
        sql`INSERT INTO ${systemTableRef('ai_tool_calls')}
            (id, created_at, tool_name, caller_type, caller_id, caller_role, input, output, error_message, error_code, latency_ms, transport)
            VALUES (
              ${crypto.randomUUID()},
              ${auditCreatedAt()},
              ${entry.toolName},
              ${entry.callerType},
              ${entry.callerId},
              ${entry.callerRole},
              ${inputLiteral},
              ${outputLiteral},
              ${errorMessageFragment},
              ${errorCodeFragment},
              ${roundedLatency},
              'streamable-http'
            )`
      )
    }),

  listToolCalls: (limit: number) =>
    wrap(() => {
      // Inline `limit` as a SQL literal (the caller has already type-checked and
      // clamped it to `[1, 1000]`) so the bun-sql driver does not try to bind
      // it — `LIMIT $1` round-trips poorly through bun:sql's param-binding
      // path. `Math.floor` here is belt-and-braces against a non-integer
      // reaching the literal.
      const safeLimit = Math.floor(limit)

      // The 12-column projection is load-bearing and must stay explicit: it is
      // the only thing that distinguishes this tier-1 read from the generic
      // internals dispatcher, which answers `SELECT *` and — because
      // `ai_tool_calls` declares `denylistFields: []` — would put `session_id`
      // and `request_id` on the wire. [internal ref] pins that difference.
      //
      // `executeRawTyped` selects the dialect's execution method AND normalizes
      // both driver result shapes, which is why no `.rows` unwrap follows.
      return executeRawTyped<McpToolCallAuditRow>(
        db,
        sql`SELECT id, created_at, caller_role, caller_id, caller_type, tool_name, input, output, error_message, error_code, latency_ms, transport
            FROM ${systemTableRef('ai_tool_calls')}
            ORDER BY created_at DESC
            LIMIT ${sql.raw(String(safeLimit))}`
      )
    }),
})
