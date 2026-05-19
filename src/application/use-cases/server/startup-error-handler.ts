/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Console } from 'effect'
import type { AppValidationError } from '@/application/errors/app-validation-error'
import type { CSSCompilationError } from '@/infrastructure/errors/css-compilation-error'
import type { ServerCreationError } from '@/infrastructure/errors/server-creation-error'

export type ServerStartupError = AppValidationError | ServerCreationError | CSSCompilationError

export const handleStartupError = (error: ServerStartupError): Effect.Effect<never> =>
  Effect.gen(function* () {
    yield* Console.error('Failed to start server:')

    if ('_tag' in error) {
      switch (error._tag) {
        case 'AppValidationError':
          yield* Console.error('Invalid app configuration:', error.cause)
          break
        case 'ServerCreationError':
          yield* Console.error('Server creation failed:', error.cause)
          break
        case 'CSSCompilationError':
          yield* Console.error('CSS compilation failed:', error.cause)
          break
        default:
          yield* Console.error('Unknown error:', error)
      }
    } else {
      yield* Console.error('Unknown error:', error)
    }

    process.exit(1)
  })
