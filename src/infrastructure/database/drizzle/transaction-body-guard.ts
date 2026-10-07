/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Fiber } from 'effect'

/**
 * Whether the running fiber is the body of an open `withTransaction`.
 *
 * `withTransaction` provides `true` to its body, and every fiber the body forks
 * inherits it. Read by the shared `db` facade, which refuses to serve a body on
 * SQLite (see {@link refuseSharedDbInTransactionBody}).
 */
export const InTransactionBody = Context.Reference<boolean>('sovrium/database/InTransactionBody', {
  defaultValue: () => false,
})

/** The message a body that reached the shared `db` fails with. */
export const SHARED_DB_IN_TRANSACTION_BODY =
  'A transaction body used the shared database client instead of its transaction handle. ' +
  'On SQLite that statement would wait for the very transaction it is part of and never run: ' +
  'issue it through the `tx` the body was given.'

/**
 * Fail fast when a transaction body reaches the shared `db` on SQLite.
 *
 * The SQLite client serialises statements behind an open transaction, so a
 * statement a body issues through the shared `db` (instead of its `tx`) waits
 * for the transaction it belongs to: the request hangs, and so does every other
 * request queued behind it. Lint refuses the direct form (`db` named inside a
 * body); this catches the indirect one — a helper the body calls that reaches
 * `db` on its own — at the first property read, with a message naming the rule.
 *
 * Keyed on the RUNNING fiber's own context, not on async-context propagation:
 * Effect's scheduler runs many fibers' continuations in one batch, so ambient
 * async state would leak between requests, while a fiber's context is its own.
 * The cost of that choice is coverage: a statement issued after an `await`
 * inside a promise thunk runs with no fiber current and is not seen.
 *
 * PostgreSQL is left alone: there a shared-`db` statement runs on another pooled
 * connection, outside the transaction — wrong, but it completes, and turning it
 * into an error is a behaviour change this guard does not make.
 *
 * @param isSqlite - whether the active runtime is SQLite, read only when the
 *   running fiber is a transaction body
 * @throws {Error} when a transaction body reaches the shared `db` on SQLite
 */
export const refuseSharedDbInTransactionBody = (isSqlite: () => boolean): void => {
  const fiber = Fiber.getCurrent()
  if (fiber === undefined || !fiber.getRef(InTransactionBody) || !isSqlite()) return
  throw new Error(SHARED_DB_IN_TRANSACTION_BODY)
}
