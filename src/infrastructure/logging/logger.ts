/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Console, Context, Effect, Layer, ManagedRuntime } from 'effect'
import { emitTelemetryLog } from '@/infrastructure/telemetry/telemetry-sink'
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
        yield* Effect.sync(() => emitTelemetryLog('debug', message))
      }
    }),

  info: (message, ...args) =>
    Effect.gen(function* () {
      yield* Console.log(formatLogMessage('INFO', message), ...args)
      yield* Effect.sync(() => emitTelemetryLog('info', message))
    }),

  warn: (message, ...args) =>
    Effect.gen(function* () {
      yield* Console.warn(formatLogMessage('WARN', message), ...args)
      yield* Effect.sync(() => emitTelemetryLog('warn', message))
    }),

  error: (message, error) =>
    Effect.gen(function* () {
      yield* error
        ? Console.error(formatLogMessage('ERROR', message), error)
        : Console.error(formatLogMessage('ERROR', message))
      yield* Effect.sync(() => emitTelemetryLog('error', message, error))
    }),
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

export interface BootstrapTokenBanner {
  readonly plaintext: string
  readonly claimEndpoint: string
  readonly expiresInMinutes: number
}

export interface StartupSummary {
  readonly version: string
  readonly phases: readonly StartupPhase[]
  readonly url: string
  readonly durationMs: number
  readonly bootstrapToken?: BootstrapTokenBanner
}

export const formatDuration = (ms: number): string =>
  ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`

export const renderStartupSummary = (summary: StartupSummary): Effect.Effect<void> =>
  renderSummary({
    version: summary.version,
    phases: summary.phases,
    footer: summary.url,
    ...(summary.bootstrapToken ? { bootstrapToken: summary.bootstrapToken } : {}),
  })

const renderSummary = (params: {
  readonly version: string
  readonly phases: readonly StartupPhase[]
  readonly footer: string
  readonly bootstrapToken?: BootstrapTokenBanner
}): Effect.Effect<void> =>
  Effect.gen(function* () {
    const warnings = params.phases.filter((p) => p.type === 'warning')
    const successes = params.phases.filter((p) => p.type === 'success')

    yield* Console.log('')
    yield* Console.log(`  Sovrium v${params.version}`)

    if (warnings.length > 0) {
      yield* Console.log('')
      yield* Effect.forEach(warnings, (phase) => Console.log(`  \u26A0 ${phase.label}`))
    }

    if (successes.length > 0) {
      yield* Console.log('')
      yield* Effect.forEach(successes, (phase) => Console.log(`  \u2713 ${phase.label}`))
    }

    yield* Console.log('')
    yield* Console.log(`  \u2192 ${params.footer}`)

    if (params.bootstrapToken) {
      yield* Console.log(
        `  \u2192 First-admin token (POST ${params.bootstrapToken.claimEndpoint}):`
      )
      yield* Console.log(`    ${params.bootstrapToken.plaintext}`)
    }
    yield* Console.log('')
  })

export interface BuildSummary {
  readonly version: string
  readonly phases: readonly StartupPhase[]
  readonly outputDir: string
}

export const renderBuildSummary = (summary: BuildSummary): Effect.Effect<void> =>
  renderSummary({ version: summary.version, phases: summary.phases, footer: summary.outputDir })
