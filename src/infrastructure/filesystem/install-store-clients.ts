/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The short-lived handles the CLI's install commands (`usage`, `backup`,
 * `restore`) open on an install from outside a running server: a missing-file
 * test, a read-only SQLite handle and a one-connection PostgreSQL client, each
 * closed before the call returns.
 */

import { Database } from 'bun:sqlite'

/** Whether a filesystem failure only says nothing is there. */
export const isMissing = (cause: unknown): boolean =>
  (cause as { readonly code?: string } | null)?.code === 'ENOENT'

/**
 * Open the SQLite file at `path` read-only, run `read` on it, and close it
 * whatever happens. Read-only never takes a write lock on a live database.
 */
export const withReadOnlySqlite = <A>(path: string, read: (database: Database) => A): A => {
  const database = new Database(path, { readonly: true })
  try {
    return read(database)
  } finally {
    database.close()
  }
}

/** How long to wait, and when to give up, on a {@link withShortLivedPostgres} client. */
export interface ShortLivedPostgresOptions {
  /** Seconds to wait for the connection; unset keeps Bun's default (and `PGCONNECT_TIMEOUT`). */
  readonly connectionTimeout?: number
  /** Closes the client at once when it aborts. */
  readonly signal?: AbortSignal
}

/**
 * A one-connection PostgreSQL client for `run`, closed when it settles — and
 * closed at once when `signal` aborts, so a server that accepts the connection
 * and never answers does not keep the process alive.
 */
export const withShortLivedPostgres = async <A>(
  url: string,
  run: (sql: Bun.SQL) => Promise<A>,
  options: ShortLivedPostgresOptions = {}
): Promise<A> => {
  const { connectionTimeout, signal } = options
  const sql = new Bun.SQL(url, {
    max: 1,
    ...(connectionTimeout === undefined ? {} : { connectionTimeout }),
  })
  const abandon = (): void => {
    void sql.close({ timeout: 0 })
  }
  signal?.addEventListener('abort', abandon, { once: true })
  try {
    return await run(sql)
  } finally {
    signal?.removeEventListener('abort', abandon)
    await sql.close({ timeout: 0 })
  }
}
