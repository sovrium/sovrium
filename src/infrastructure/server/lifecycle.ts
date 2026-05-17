/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Console, Runtime } from 'effect'
import type { ServerInstance } from '@/application/models/server'

/**
 * Sets up graceful server shutdown on SIGINT (Ctrl+C) and SIGTERM
 *
 * This utility registers signal handlers that gracefully stop the server
 * and close database connections before process termination. Both SIGINT
 * (interactive Ctrl+C) and SIGTERM (sent by CI, Docker, process managers)
 * are handled identically to prevent connection leaks.
 *
 * @param server - Server instance with stop capability
 * @returns Effect that never completes (keeps process alive until signal)
 *
 * @example
 * ```typescript
 * import { Effect } from 'effect'
 * import { startServer } from '@/application/use-cases/server/start-server'
 * import { withGracefulShutdown } from '@/infrastructure/server/lifecycle'
 *
 * const program = Effect.gen(function* () {
 *   const server = yield* startServer(appConfig, options)
 *   yield* withGracefulShutdown(server)
 * })
 *
 * Effect.runPromise(program)
 * ```
 */
export const withGracefulShutdown = (server: ServerInstance): Effect.Effect<never> =>
  Effect.gen(function* () {
    // Extract runtime to use in signal handler (avoids Effect.runPromise inside Effect)
    const runtime = yield* Effect.runtime<never>()

    const handleShutdown = (signal: string) => () => {
      Runtime.runPromise(runtime)(
        Effect.gen(function* () {
          yield* Console.log(`\nReceived ${signal}, stopping server...`)
          yield* server.stop
          // Terminate process - imperative statement required for graceful shutdown
          // eslint-disable-next-line functional/no-expression-statements
          process.exit(0)
        })
      ).catch((error) => {
        Runtime.runSync(runtime)(Console.error('Failed to stop server:', error))
        // Terminate process - imperative statement required for error handling
        // eslint-disable-next-line functional/no-expression-statements
        process.exit(1)
      })
    }

    // Setup signal handlers for graceful shutdown
    // Both SIGINT (Ctrl+C) and SIGTERM (kill, CI, Docker) must close DB connections
    // Wrap process.on() side effects in Effect.sync for testability
    yield* Effect.sync(() => {
      // eslint-disable-next-line functional/no-expression-statements
      process.on('SIGINT', handleShutdown('SIGINT'))
      // eslint-disable-next-line functional/no-expression-statements
      process.on('SIGTERM', handleShutdown('SIGTERM'))
    })

    // Keep the process alive indefinitely
    return yield* Effect.never
  })
