/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer } from 'effect'
import { ConnectionRepository } from '@/application/ports/repositories/connections/connection-repository'
import { ConnectionTokenRepository } from '@/application/ports/repositories/connections/connection-token-repository'
import { DatabaseUnownedLive } from '@/infrastructure/database/drizzle/layer'
import { ConnectionRepositoryLive } from '@/infrastructure/database/repositories/connections/connection-repository-live'
import { ConnectionTokenRepositoryLive } from '@/infrastructure/database/repositories/connections/connection-token-repository-live'
import { logError } from '@/infrastructure/logging/logger'

/**
 * Startup registration of the app's connection definitions.
 *
 * Seeds one `system.connections` row per entry of `app.connections[]` (apiKey,
 * basic, bearer, oauth2) when the server starts, so the auth-header injection
 * path can verify a connection still exists before building an outbound
 * header. It stores the connection's name, provider and type only, never a
 * credential and never a token.
 */

interface ConnectionDefinitionShape {
  readonly name: string
  readonly type: string
  readonly props: Record<string, unknown>
}

/**
 * Is this connection `app`-scoped — i.e. does it share ONE credential across
 * the whole installation? The default when `scope` is omitted is `app`, per
 * the published contract and `effectiveScope` on the connection routes.
 */
const isAppScoped = (conn: ConnectionDefinitionShape): boolean =>
  conn.type === 'oauth2' && (conn.props as Record<string, unknown>)['scope'] !== 'user'

export const seedAllConnectionDefinitionsProgram = (input: {
  readonly connections: readonly ConnectionDefinitionShape[] | undefined
}) =>
  Effect.gen(function* () {
    if (input.connections === undefined || input.connections.length === 0) return
    const connRepo = yield* ConnectionRepository
    const tokenRepo = yield* ConnectionTokenRepository
    yield* Effect.forEach(
      input.connections,
      (conn) =>
        Effect.gen(function* () {
          const provider = String((conn.props as Record<string, unknown>)['provider'] ?? conn.name)
          const row = yield* connRepo.upsertByName({
            name: conn.name,
            provider,
            type: conn.type,
            credentials: {},
          })
          // Upgrade repair (see `adoptLegacyUserTokenAsApp`). An installation
          // that authorized this connection before the shared store existed
          // has its credential filed under the operator who clicked Connect;
          // post-upgrade the dashboard reads that row and renders "connected"
          // while the runtime reads an empty shared store and every unattended
          // automation fails. Nothing in the UI reports the disagreement.
          //
          // This has to happen HERE and not in a SQL migration: `scope` lives
          // in app config, not in the database, so a migration cannot tell an
          // app-scoped connection's rows from genuine per-user ones it must
          // not touch. This seeder already iterates `app.connections[]` and so
          // already has the config in scope.
          //
          // Idempotent and non-destructive — a no-op once adopted, and the
          // injection path repeats the attempt for databases that reach the
          // pre-upgrade shape after boot (an older backup restored, a `scope`
          // flipped while the process is running).
          if (!isAppScoped(conn)) return
          const connectionId = String(row['id'] ?? '')
          if (connectionId === '') return
          yield* tokenRepo.adoptLegacyUserTokenAsApp({ connectionId }).pipe(
            // effect-swallow: stated above — the adoption is idempotent and non-destructive, and the injection path retries it per request, so a failure here costs one boot-time attempt out of many.
            Effect.orElseSucceed(() => false)
          )
        }),
      { concurrency: 1 }
    )
  })

/**
 * Convenience runner for the startup seeder: provides the live repository
 * layer, converts to a Promise, and swallows errors (logging them)
 * because a seeder failure should never block server startup.
 */
export const runSeedAllConnectionDefinitions = async (input: {
  readonly connections: readonly ConnectionDefinitionShape[] | undefined
}): Promise<void> => {
  if (input.connections === undefined || input.connections.length === 0) return
  const program = seedAllConnectionDefinitionsProgram(input).pipe(
    Effect.provide(
      Layer.mergeAll(ConnectionRepositoryLive, ConnectionTokenRepositoryLive).pipe(
        // A boot step: it runs before the server runtime that owns the client exists.
        Layer.provide(DatabaseUnownedLive)
      )
    )
  )
  const result = await Effect.runPromise(Effect.result(program))
  if (result._tag === 'Failure') {
    logError('[connections] startup connection-definition seed failed', result.failure)
  }
}
