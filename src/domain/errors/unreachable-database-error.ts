/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { collectCauseChain, readSqlState } from './driver-failure'

/**
 * Driver/runtime codes that mean "the database could not be REACHED at all" —
 * as opposed to reached and then refusing the statement.
 *
 * Code-based, never message-based, for the same reason as everything else in
 * this module — and here the message route is measurably broken in BOTH
 * directions. Matching lower-cased message fragments fails like this
 * (measured against `bun:sql`):
 *
 *  - a refused connection AND an unresolvable host both surface as
 *    `PostgresError { code: 'ERR_POSTGRES_CONNECTION_REFUSED' }` whose whole
 *    message is `Failed to connect` — containing none of the `econnrefused` /
 *    `enotfound` / `getaddrinfo` fragments that were meant to catch them, so
 *    the friendly diagnostic never fired for Postgres at all;
 *  - `permission denied` matched `42501` (`permission denied for table "user"`),
 *    which is a GRANT problem on a perfectly reachable database. It was latent
 *    only because drizzle kept the driver's message on `.cause`; folding that
 *    message back in (see `auth/better-auth/adapter-errors.ts`) made it live.
 *
 * SQLSTATE class `08` and `57P03` are listed for driver-independence: `pg` and
 * `postgres.js` report connection failures that way, and swapping a driver
 * should not silently take this diagnostic away again.
 */
const UNREACHABLE_DRIVER_CODES: ReadonlySet<string> = new Set([
  // bun:sql — covers refused, unresolvable and timed-out alike.
  'ERR_POSTGRES_CONNECTION_REFUSED',
  'ERR_POSTGRES_CONNECTION_CLOSED',
  // bun:sqlite — the file cannot be opened, or is locked beyond the busy timeout.
  'SQLITE_CANTOPEN',
  'SQLITE_BUSY',
  // Node/libuv socket + filesystem failures reaching the database.
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'ETIMEDOUT',
  'EAI_AGAIN',
  'EACCES',
  'EPERM',
  'ENOENT',
])

/** PostgreSQL SQLSTATE class for `connection_exception`. */
const POSTGRES_CONNECTION_EXCEPTION_CLASS = '08'

/** `cannot_connect_now` — the server is up but refusing connections (e.g. starting up). */
const POSTGRES_CANNOT_CONNECT_NOW = '57P03'

/**
 * True when `error` — or anything in its `cause` chain — means the database was
 * unreachable, rather than reached and unhappy.
 *
 * Deliberately NOT a member of {@link DriverFailure}'s `origin` union: for HTTP
 * purposes an unreachable database is exactly what `operator` already says (an
 * alertable 500), and widening that closed union would force every consumer to
 * give this a distinct status it does not want. This is a separate question
 * asked by the one caller that needs it — the CLI, which turns it into an
 * actionable "set DATABASE_URL" diagnostic instead of a raw driver dump.
 */
export function isDatabaseUnreachable(error: unknown): boolean {
  return collectCauseChain(error).some((node) => {
    const code = typeof node.code === 'string' ? node.code : undefined
    if (code !== undefined && UNREACHABLE_DRIVER_CODES.has(code)) return true

    const sqlState = readSqlState(node)
    return (
      sqlState !== undefined &&
      (sqlState.startsWith(POSTGRES_CONNECTION_EXCEPTION_CLASS) ||
        sqlState === POSTGRES_CANNOT_CONNECT_NOW)
    )
  })
}
