/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Console, Context, Effect, Layer, ManagedRuntime } from 'effect'
import { isDevelopment as isDevelopmentEnv } from '@/infrastructure/utils/env'

export class Logger extends Context.Tag('Logger')<
  Logger,
  {
    readonly debug: (message: string, ...args: unknown[]) => Effect.Effect<void>
    readonly info: (message: string, ...args: unknown[]) => Effect.Effect<void>
    readonly warn: (message: string, ...args: unknown[]) => Effect.Effect<void>
    readonly error: (message: string, error?: unknown) => Effect.Effect<void>
  }
>() {}

const formatLogMessage = (level: string, message: string): string => {
  const timestamp = new Date().toISOString()
  return `[${timestamp}] [${level}] ${message}`
}

export const LoggerLive = Layer.succeed(Logger, {
  debug: (message, ...args) =>
    Effect.gen(function* () {
      if (process.env.LOG_LEVEL === 'debug' || isDevelopmentEnv()) {
        yield* Console.debug(formatLogMessage('DEBUG', message), ...args)
      }
    }),

  info: (message, ...args) => Console.log(formatLogMessage('INFO', message), ...args),

  warn: (message, ...args) => Console.warn(formatLogMessage('WARN', message), ...args),

  error: (message, error) =>
    error
      ? Console.error(formatLogMessage('ERROR', message), error)
      : Console.error(formatLogMessage('ERROR', message)),
})

export const LoggerSilent = Layer.succeed(Logger, {
  debug: () => Effect.void,
  info: () => Effect.void,
  warn: () => Effect.void,
  error: () => Effect.void,
})



const logRuntime = ManagedRuntime.make(LoggerLive)

const runLogEffect = <A>(effect: Effect.Effect<A, never, Logger>): void => {
  logRuntime.runSync(effect)
}

export const logError = (message: string, cause?: unknown): void => {
  runLogEffect(
    Effect.gen(function* () {
      const logger = yield* Logger
      yield* logger.error(message, cause)
    })
  )
}

export const logWarning = (message: string): void => {
  runLogEffect(
    Effect.gen(function* () {
      const logger = yield* Logger
      yield* logger.warn(message)
    })
  )
}

export const logInfo = (message: string): void => {
  runLogEffect(
    Effect.gen(function* () {
      const logger = yield* Logger
      yield* logger.info(message)
    })
  )
}

export const logDebug = (message: string): void => {
  runLogEffect(
    Effect.gen(function* () {
      const logger = yield* Logger
      yield* logger.debug(message)
    })
  )
}

export const createModuleLogger = (module: string) => ({
  error: (message: string, cause?: unknown) => logError(`[${module}] ${message}`, cause),
  warning: (message: string) => logWarning(`[${module}] ${message}`),
  info: (message: string) => logInfo(`[${module}] ${message}`),
  debug: (message: string) => logDebug(`[${module}] ${message}`),
})


export interface StartupPhase {
  readonly label: string
  readonly detail?: string
  readonly type: 'success' | 'warning' | 'skip'
}

export interface StartupSummary {
  readonly version: string
  readonly phases: readonly StartupPhase[]
  readonly url: string
  readonly durationMs: number
}

export const formatDuration = (ms: number): string =>
  ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`

export const renderStartupSummary = (summary: StartupSummary): Effect.Effect<void> =>
  Effect.gen(function* () {
    const warnings = summary.phases.filter((p) => p.type === 'warning')
    const successes = summary.phases.filter((p) => p.type === 'success')

    yield* Console.log('')
    yield* Console.log(`  Sovrium v${summary.version}`)

    if (warnings.length > 0) {
      yield* Console.log('')
      yield* Effect.forEach(warnings, (phase) => Console.log(`  \u26A0 ${phase.label}`))
    }

    if (successes.length > 0) {
      yield* Console.log('')
      yield* Effect.forEach(successes, (phase) => Console.log(`  \u2713 ${phase.label}`))
    }

    yield* Console.log('')
    yield* Console.log(`  \u2192 ${summary.url}`)
    yield* Console.log('')
  })
