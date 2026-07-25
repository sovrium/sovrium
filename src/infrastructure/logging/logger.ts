/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Effect, Layer } from 'effect'
import { emitTelemetryLog, type LogAttributes } from '@/infrastructure/telemetry/telemetry-sink'


export class Logger extends Context.Tag('Logger')<
  Logger,
  {
    readonly debug: (message: string, attributes?: LogAttributes) => Effect.Effect<void>
    readonly info: (message: string, attributes?: LogAttributes) => Effect.Effect<void>
    readonly warn: (message: string, attributes?: LogAttributes) => Effect.Effect<void>
    readonly error: (
      message: string,
      cause?: unknown,
      attributes?: LogAttributes
    ) => Effect.Effect<void>
  }
>() {}

export const LoggerLive = Layer.succeed(Logger, {
  debug: (message, attributes) =>
    Effect.sync(() => emitTelemetryLog('debug', message, undefined, attributes)),
  info: (message, attributes) =>
    Effect.sync(() => emitTelemetryLog('info', message, undefined, attributes)),
  warn: (message, attributes) =>
    Effect.sync(() => emitTelemetryLog('warn', message, undefined, attributes)),
  error: (message, cause, attributes) =>
    Effect.sync(() => emitTelemetryLog('error', message, cause, attributes)),
})

export const LoggerSilent = Layer.succeed(Logger, {
  debug: () => Effect.void,
  info: () => Effect.void,
  warn: () => Effect.void,
  error: () => Effect.void,
})



export const logError = (message: string, cause?: unknown, attributes?: LogAttributes): void =>
  emitTelemetryLog('error', message, cause, attributes)

export const logWarning = (message: string, attributes?: LogAttributes): void =>
  emitTelemetryLog('warn', message, undefined, attributes)

export const logInfo = (message: string, attributes?: LogAttributes): void =>
  emitTelemetryLog('info', message, undefined, attributes)

export const logDebug = (message: string, attributes?: LogAttributes): void =>
  emitTelemetryLog('debug', message, undefined, attributes)


export * from './startup-summary'
