/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Console, Runtime } from 'effect'
import type { ServerInstance } from '@/application/models/server'

export const withGracefulShutdown = (server: ServerInstance): Effect.Effect<never> =>
  Effect.gen(function* () {
    const runtime = yield* Effect.runtime<never>()

    const handleShutdown = (signal: string) => () => {
      Runtime.runPromise(runtime)(
        Effect.gen(function* () {
          yield* Console.log(`\nReceived ${signal}, stopping server...`)
          yield* server.stop
          process.exit(0)
        })
      ).catch((error) => {
        Runtime.runSync(runtime)(Console.error('Failed to stop server:', error))
        process.exit(1)
      })
    }

    yield* Effect.sync(() => {
      process.on('SIGINT', handleShutdown('SIGINT'))
      process.on('SIGTERM', handleShutdown('SIGTERM'))
    })

    return yield* Effect.never
  })
