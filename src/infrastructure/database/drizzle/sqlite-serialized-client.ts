/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import {
  SQLiteAsyncDatabase,
  SQLiteAsyncPreparedQuery,
  SQLiteAsyncSession,
  SQLiteAsyncTransaction,
  SQLiteDialect,
} from 'drizzle-orm/sqlite-core'
import type { Changes, Database as BunSqlite, Statement } from 'bun:sqlite'
import type { Logger, Query } from 'drizzle-orm'
import type {
  SQLiteAsyncPreparedQueryConfig,
  SQLiteExecuteMethod,
  SQLiteQueryExecutors,
  SQLiteTransactionConfig,
} from 'drizzle-orm/sqlite-core'

/**
 * The SQLite runtime client: one `bun:sqlite` connection, shared by the whole
 * process, whose explicit transactions are SERIALISED against every other
 * statement issued on it.
 *
 * ## Why the stock `drizzle-orm/bun-sqlite` client is not enough
 *
 * Its `transaction()` is synchronous (`client.transaction(() => …)`): an async
 * callback returns a pending promise at its first `await`, the native wrapper
 * commits right then, and every later statement runs in autocommit. A batch
 * whose last record failed kept every record before it.
 *
 * Opening the transaction by hand (`BEGIN … COMMIT`) fixes atomicity but not
 * isolation. There is ONE connection, and an open `BEGIN` on it captures every
 * statement any other request issues while the body is awaiting — a single
 * record create, a session write by Better Auth, an activity-log row. A
 * rollback then destroys writes that were already reported as successful, and
 * a second request opening its own transaction gets "cannot start a transaction
 * within a transaction".
 *
 * ## Why not a second connection for transactions
 *
 * Under WAL a second connection would give readers a committed snapshot, but
 * SQLite admits one writer at a time across connections, and `bun:sqlite` is
 * synchronous: a write on the shared connection that meets the transaction's
 * lock waits in the busy handler ON THE EVENT LOOP THREAD. The transaction
 * cannot reach its `COMMIT` while the loop is blocked, so the write spins for
 * the whole busy timeout and then fails with `SQLITE_BUSY`. Every concurrent
 * write would either stall the process or fail.
 *
 * ## What this client does instead
 *
 * Every statement issued through the client is admitted by a gate:
 *
 *   - while no transaction is open, a statement runs at once, exactly as before;
 *   - while one is open, a statement issued OUTSIDE it waits until it ends;
 *   - transactions take the gate one at a time, in arrival order, and a waiting
 *     statement queued ahead of a waiting transaction runs before it.
 *
 * The transaction body receives a handle on the same connection whose
 * statements bypass the gate (they are the transaction). So the body is atomic,
 * and nothing anyone else does lands inside it.
 *
 * To make waiting possible at all, the client runs in drizzle's ASYNC result
 * mode: each statement still executes synchronously on `bun:sqlite`, but is
 * handed back as a promise. Every caller is written against the PostgreSQL
 * facade type (`await`, never `.sync()` or a bare `.all()`), so nothing
 * observes the difference.
 *
 * ## The rule that keeps this deadlock-free
 *
 * A transaction body must issue its statements through the `tx` it is given,
 * never through the shared `db`: a shared-`db` statement issued from inside a
 * body waits for the very transaction it is part of. Every body in the codebase
 * already follows that rule, because on PostgreSQL a shared-`db` statement
 * inside a body runs on another pooled connection, outside the transaction —
 * which is never what the body meant.
 *
 * Connections opened separately (schema DDL, migrations, the sqlite-vec reader)
 * are not covered: they are other connections, and SQLite's own locking applies
 * to them.
 */

/** Admits one synchronous statement, now or once the connection is free. */
type Admit = <A>(run: () => A) => Promise<A>

/** The serialisation point of one SQLite connection. */
export interface SqliteConnectionGate {
  /** Run a statement issued outside any transaction. */
  readonly admit: Admit
  /** Run `body` while holding the connection alone. */
  readonly exclusive: <A>(body: () => Promise<A>) => Promise<A>
}

/** Run a synchronous thunk, reporting a throw as a rejection rather than a throw. */
const settle = <A>(run: () => A): Promise<A> => new Promise<A>((resolve) => resolve(run()))

/**
 * Build the gate for one connection.
 *
 * The queue holds wake-up callbacks in arrival order. Releasing the gate drains
 * it: a waiting statement runs on the spot (it does not hold the gate), and the
 * first waiting transaction takes the gate and stops the drain.
 */
export const makeSqliteConnectionGate = (): SqliteConnectionGate => {
  let state: { readonly held: boolean; readonly waiters: readonly (() => void)[] } = {
    held: false,
    waiters: [],
  }

  const enqueue = (waiter: () => void): void => {
    state = { ...state, waiters: [...state.waiters, waiter] }
  }

  const drain = (): void => {
    const [next, ...rest] = state.waiters
    if (state.held || next === undefined) return
    state = { ...state, waiters: rest }

    next()

    drain()
  }

  const take = (): void => {
    state = { ...state, held: true }
  }

  const admit: Admit = (run) =>
    state.held
      ? new Promise((resolve, reject) => enqueue(() => void settle(run).then(resolve, reject)))
      : settle(run)

  const acquire = (): Promise<void> => {
    if (!state.held) {
      take()
      return Promise.resolve()
    }
    // The gate is taken INSIDE the wake-up, so the drain stops behind it.
    return new Promise<void>((resolve) =>
      enqueue(() => {
        take()
        resolve()
      })
    )
  }

  const release = (): void => {
    state = { ...state, held: false }
    drain()
  }

  return {
    admit,
    exclusive: async (body) => {
      await acquire()
      try {
        return await body()
      } finally {
        release()
      }
    },
  }
}

/** Statements inside the transaction ARE the transaction: they run at once. */
const direct: Admit = settle

type PreparedConfig = SQLiteAsyncPreparedQueryConfig & { readonly type: 'async' }

/** bun:sqlite's binders take a mutable rest list; drizzle hands one over. */
const bind = (params: readonly unknown[]): never[] => params as never[]

/** What a {@link GatedSqliteSession} runs on. */
interface GatedSessionOptions {
  readonly client: BunSqlite
  readonly dialect: SQLiteDialect
  readonly logger: Logger
  /** How a statement issued through this session is admitted. */
  readonly admit: Admit
  /** The connection's gate; absent on the session of an open transaction. */
  readonly gate?: SqliteConnectionGate
}

/**
 * A drizzle session over `bun:sqlite` in async result mode, whose statements go
 * through `admit` and whose transactions take the gate.
 */
class GatedSqliteSession extends SQLiteAsyncSession<'async', Changes> {
  constructor(private readonly options: GatedSessionOptions) {
    super(options.dialect, 'async')
  }

  // eslint-disable-next-line max-params -- drizzle's abstract signature, not ours to shape
  override prepareQuery(
    query: Query,
    mode: 'arrays' | 'objects' | 'raw',
    _prepare: boolean,
    executeMethod?: SQLiteExecuteMethod,
    mapper?: (rows: unknown[]) => unknown,
    queryMetadata?: { type: 'select' | 'update' | 'delete' | 'insert'; tables: string[] }
  ): SQLiteAsyncPreparedQuery<PreparedConfig> {
    const { client, admit, logger } = this.options
    const statement: Statement = client.query(query.sql)
    const executors: SQLiteQueryExecutors<'async'> = {
      all: (params) =>
        admit(() =>
          mode === 'arrays' ? statement.values(...bind(params)) : statement.all(...bind(params))
        ),
      get: (params) =>
        admit(() =>
          mode === 'arrays' ? statement.values(...bind(params))[0] : statement.get(...bind(params))
        ),
      run: (params) => admit(() => statement.run(...bind(params))),
      values: (params) => admit(() => statement.values(...bind(params))),
    }
    return new SQLiteAsyncPreparedQuery<PreparedConfig>(
      'async',
      executeMethod,
      executors,
      query,
      mapper,
      mode,
      logger,
      undefined,
      queryMetadata,
      undefined
    )
  }

  override async transaction<T>(
    transaction: (tx: SQLiteAsyncTransaction<'async', Changes>) => Promise<T>,
    config: SQLiteTransactionConfig = {}
  ): Promise<T> {
    const { gate, client, dialect, logger } = this.options
    if (gate === undefined) {
      throw new Error('A transaction cannot be opened on the session of an open transaction')
    }
    return gate.exclusive(async () => {
      const inner = new GatedSqliteSession({ client, dialect, logger, admit: direct })
      const tx = new GatedSqliteTransaction(dialect, inner, 0)
      client.run(`BEGIN ${(config.behavior ?? 'immediate').toUpperCase()}`)
      try {
        const result = await transaction(tx)
        client.run('COMMIT')
        return result
      } catch (error) {
        // SQLite rolls some failures back on its own (and a failed COMMIT may
        // have ended the transaction), so only roll back what is still open.
        if (client.inTransaction) client.run('ROLLBACK')
        throw error
      }
    })
  }
}

/** The handle a transaction body receives; nesting is a savepoint. */
class GatedSqliteTransaction extends SQLiteAsyncTransaction<'async', Changes> {
  constructor(
    private readonly sqliteDialect: SQLiteDialect,
    private readonly innerSession: GatedSqliteSession,
    nestedIndex: number
  ) {
    super('async', sqliteDialect, innerSession, {}, nestedIndex)
  }

  override async transaction<T>(
    transaction: (tx: SQLiteAsyncTransaction<'async', Changes>) => Promise<T>
  ): Promise<T> {
    const savepoint = `sp${this.nestedIndex}`
    const tx = new GatedSqliteTransaction(
      this.sqliteDialect,
      this.innerSession,
      this.nestedIndex + 1
    )
    // sql-literal: identifier -- the savepoint name is built from an integer nesting counter
    await this.innerSession.run(sql.raw(`savepoint ${savepoint}`))
    try {
      const result = await transaction(tx)
      // sql-literal: identifier -- the savepoint name is built from an integer nesting counter
      await this.innerSession.run(sql.raw(`release savepoint ${savepoint}`))
      return result
    } catch (error) {
      // sql-literal: identifier -- the savepoint name is built from an integer nesting counter
      await this.innerSession.run(sql.raw(`rollback to savepoint ${savepoint}`))
      throw error
    }
  }
}

/** The drizzle client {@link makeSerializedSqliteClient} returns. */
export type SerializedSqliteClient = SQLiteAsyncDatabase<'async', Changes> & {
  readonly $client: BunSqlite
}

/**
 * Wrap an open `bun:sqlite` connection in a drizzle client whose transactions
 * are atomic and serialised against every other statement on the connection.
 *
 * @param client - the open connection, PRAGMAs already applied
 * @param logger - drizzle's per-statement logger (the query-count tap)
 */
export const makeSerializedSqliteClient = (
  client: BunSqlite,
  logger: Logger
): SerializedSqliteClient => {
  const dialect = new SQLiteDialect()
  const gate = makeSqliteConnectionGate()
  const session = new GatedSqliteSession({ client, dialect, logger, admit: gate.admit, gate })
  return Object.assign(new SQLiteAsyncDatabase('async', dialect, session, {}), { $client: client })
}
