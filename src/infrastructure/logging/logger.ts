/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Effect, Layer } from 'effect'

/**
 * Logger service for application-wide logging
 *
 * Provides structured logging with log levels:
 * - debug: Detailed diagnostic information
 * - info: General informational messages
 * - warn: Warning messages for potential issues
 * - error: Error messages for failures
 */
export class Logger extends Context.Tag('Logger')<
  Logger,
  {
    readonly debug: (message: string, ...args: unknown[]) => Effect.Effect<void>
    readonly info: (message: string, ...args: unknown[]) => Effect.Effect<void>
    readonly warn: (message: string, ...args: unknown[]) => Effect.Effect<void>
    readonly error: (message: string, error?: unknown) => Effect.Effect<void>
  }
>() {}

/**
 * Console-based logger implementation
 *
 * Uses console.* methods for output in development
 * Can be replaced with file-based logging in production
 */
export const LoggerLive = Layer.succeed(Logger, {
  debug: (message, ...args) =>
    Effect.sync(() => {
      if (process.env.LOG_LEVEL === 'debug' || process.env.NODE_ENV === 'development') {
        console.debug(`[DEBUG] ${message}`, ...args)
      }
    }),

  info: (message, ...args) =>
    Effect.sync(() => {
      console.log(`[INFO] ${message}`, ...args)
    }),

  warn: (message, ...args) =>
    Effect.sync(() => {
      console.warn(`[WARN] ${message}`, ...args)
    }),

  error: (message, error) =>
    Effect.sync(() => {
      if (error) {
        console.error(`[ERROR] ${message}`, error)
      } else {
        console.error(`[ERROR] ${message}`)
      }
    }),
})

/**
 * Silent logger for testing
 *
 * Discards all log messages
 */
export const LoggerSilent = Layer.succeed(Logger, {
  debug: () => Effect.void,
  info: () => Effect.void,
  warn: () => Effect.void,
  error: () => Effect.void,
})
