/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Console } from 'effect'
import type { ServerInstance } from '@/application/models/server'

/**
 * Sets up graceful server shutdown on SIGINT (Ctrl+C)
 *
 * This utility registers a SIGINT handler that gracefully stops the server
 * when the user presses Ctrl+C. The server's stop Effect is executed before
 * process termination.
 *
 * @param server - Server instance with stop capability
 * @returns Effect that never completes (keeps process alive until SIGINT)
 *
 * @example
 * ```typescript
 * import { Effect } from 'effect'
 * import { start } from '@/index'
 * import { withGracefulShutdown } from '@/utils/server-lifecycle'
 *
 * const program = Effect.gen(function* () {
 *   const server = yield* start(myApp)
 *   yield* withGracefulShutdown(server)
 * })
 *
 * Effect.runPromise(program)
 * ```
 */
export const withGracefulShutdown = (server: ServerInstance): Effect.Effect<never> =>
  Effect.gen(function* () {
    // Setup SIGINT handler for graceful shutdown
    // Wrap process.on() side effect in Effect.sync for testability
    // Note: Effect.runPromise/runSync inside signal handler is intentional -
    // signal handlers run outside the Effect runtime, so we need a new runtime
    // @effect-suppress runEffectInsideEffect
    yield* Effect.sync(() =>
      process.on('SIGINT', () => {
        Effect.runPromise(
          Effect.gen(function* () {
            yield* Console.log('\nReceived SIGINT, stopping server...')
            yield* server.stop
            // Terminate process - imperative statement required for graceful shutdown
            // eslint-disable-next-line functional/no-expression-statements
            process.exit(0)
          })
        ).catch((error) => {
          Effect.runSync(Console.error('Failed to stop server:', error))
          // Terminate process - imperative statement required for error handling
          // eslint-disable-next-line functional/no-expression-statements
          process.exit(1)
        })
      })
    )

    // Log shutdown instructions
    yield* Console.log('')
    yield* Console.log('Press Ctrl+C to stop the server')

    // Keep the process alive indefinitely
    return yield* Effect.never
  })
