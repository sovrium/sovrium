/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Effect, Layer } from 'effect'
import {
  parseDatabaseDialectConfig,
  type DatabaseDialect,
} from '@/domain/models/process-env/database/database-dialect'
import { dialectSqlStrategyFor, type DialectSqlStrategy } from '../sql/dialect-sql-strategy'
import { activeDialectKind } from './active-dialect'
import { closeDatabaseLease, openDatabaseLease } from './database-lease'
import { makeForwardingClient } from './db-bun'
import type { PortableDb, PortableTx } from './db'

/** The engine a `Database` service speaks, and the SQL fragments that differ on it. */
export interface Dialect {
  readonly kind: DatabaseDialect
  readonly sql: DialectSqlStrategy
}

/** What the `Database` service carries: the client, and the dialect resolved once. */
export interface DatabaseService {
  readonly client: PortableDb
  readonly dialect: Dialect
}

/** An open transaction, with the dialect of the connection it runs on. */
export interface TransactionOn {
  readonly tx: Readonly<PortableTx>
  readonly dialect: Dialect
}

/** The {@link Dialect} of one engine. */
export const dialectOf = (kind: DatabaseDialect): Dialect => ({
  kind,
  sql: dialectSqlStrategyFor(kind),
})

/**
 * Database Effect Context
 *
 * The database client and the dialect it speaks, for dependency injection.
 *
 * @example
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const { client } = yield* Database
 *   const users = yield* Effect.tryPromise(() => client.select().from(usersTable))
 *   return users
 * })
 * ```
 */
export class Database extends Context.Service<Database, DatabaseService>()('Database') {}

/**
 * A service written member by member over the `Database` it reads: each member
 * is built from the client and the dialect, and keeps its own contextually
 * typed body. The shape a repository takes when its methods do not fit in one
 * builder function.
 */
export type MembersOverDatabase<Service> = MembersOf<Context.Service.Shape<Service>>

/** {@link MembersOverDatabase}, keyed by the service's shape rather than its key. */
type MembersOf<S> = { readonly [K in keyof S]: (db: PortableDb, dialect: Dialect) => S[K] }

/**
 * The layer of `service`, its members built once over the `Database` service
 * the composition provides — the server runtime's owning `DatabaseLive`, or
 * {@link DatabaseUnownedLive} where no server owns the client.
 */
export const layerOverDatabase = <I, S extends object>(
  service: Context.Key<I, S>,
  members: MembersOf<S>
): Layer.Layer<I, never, Database> =>
  Layer.effect(
    service,
    Effect.map(Database, ({ client, dialect }) => {
      const keys = Object.keys(members).filter(
        (key): key is Extract<keyof S, string> => key in members
      )
      return Object.fromEntries(keys.map((key) => [key, members[key](client, dialect)])) as S
    })
  )

/**
 * The `Database` layer a server's runtime provides, once: acquiring it takes
 * ownership of the client and resolves the dialect; releasing it, when the
 * runtime is disposed, closes the client once no other server holds it
 * (`database-lease.ts`). A client the boot's earlier steps already built is
 * adopted, never duplicated.
 *
 * Provide it at the composition root only. A per-call `Effect.provide` of this
 * layer would close the client at the end of every call.
 */
export const DatabaseLive = Layer.effect(
  Database,
  Effect.gen(function* () {
    const lease = yield* Effect.acquireRelease(Effect.sync(openDatabaseLease), (held) =>
      // effect-promise: total -- `closeDatabaseLease` logs a failed driver close and never rejects.
      Effect.promise(() => closeDatabaseLease(held))
    )
    return Database.of({ client: lease.client, dialect: dialectOf(lease.kind) })
  })
)

/** The client of a composition with no server: it builds on first read and closes nothing. */
const unownedClient: PortableDb = makeForwardingClient(() => undefined)

/**
 * A `Database` that owns nothing, for the work no server's runtime holds: the
 * boot's steps before that runtime exists, a CLI verb with no server, a one-off
 * sweep. Its client is the same memoised one a running {@link DatabaseLive}
 * leases, so no second pool can open beside it, and it answers in that layer's
 * dialect while one is alive. Taking one opens no connection.
 */
export const unownedDatabase = (): DatabaseService =>
  Database.of({
    client: unownedClient,
    // The boot's own read of the environment: nothing has resolved it yet.
    dialect: dialectOf(activeDialectKind() ?? parseDatabaseDialectConfig(process.env).dialect),
  })

/** {@link unownedDatabase} as a layer. */
export const DatabaseUnownedLive = Layer.sync(Database, unownedDatabase)
