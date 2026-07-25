/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import * as OtlpLogger from '@effect/opentelemetry/OtlpLogger'
import * as OtlpMetrics from '@effect/opentelemetry/OtlpMetrics'
import * as OtlpSerialization from '@effect/opentelemetry/OtlpSerialization'
import * as OtlpTracer from '@effect/opentelemetry/OtlpTracer'
import * as FetchHttpClient from '@effect/platform/FetchHttpClient'
import { Duration, Effect, Layer, Logger, LogLevel, ManagedRuntime } from 'effect'
import { isDebugEnabled } from '@/infrastructure/utils/env'
import { getTelemetryConfig } from './telemetry-config'
import type { LogAttributes, TelemetryLogLevel } from './telemetry-sink'
import type {
  LogExportConfig as LogExport,
  MetricsExportConfig as MetricsExport,
  TracesConfig as Traces,
} from '@/domain/models/env/telemetry/telemetry'

export interface LogResource {
  readonly serviceName: string
  readonly serviceVersion: string
  readonly environment: string
}

type ObsRuntime = ManagedRuntime.ManagedRuntime<never, never>

const state = new Map<'resource', LogResource>()
const runtimes = new Map<'full' | 'bootstrap', ObsRuntime>()

const toLogLevel = (level: TelemetryLogLevel): LogLevel.LogLevel => {
  switch (level) {
    case 'error':
      return LogLevel.Error
    case 'warn':
      return LogLevel.Warning
    case 'info':
      return LogLevel.Info
    case 'debug':
      return LogLevel.Debug
  }
}

const stdoutLogger: Logger.Logger<unknown, void> = Logger.make(({ logLevel, message, date }) => {
  const line = `[${date.toISOString()}] [${logLevel.label}] ${String(message)}\n`
  const toStderr = logLevel.label === 'ERROR' || logLevel.label === 'WARN'
  ;(toStderr ? process.stderr : process.stdout).write(line)
})

const otlpResource = (): {
  readonly serviceName: string
  readonly serviceVersion: string
  readonly attributes: Record<string, string>
} => {
  const resource = state.get('resource')
  return {
    serviceName: resource?.serviceName ?? 'sovrium',
    serviceVersion: resource?.serviceVersion ?? '0.0.0',
    attributes: { 'deployment.environment': resource?.environment ?? 'development' },
  }
}

const logTee = (logExport: LogExport | undefined): readonly Layer.Layer<never>[] =>
  logExport === undefined
    ? []
    : [
        OtlpLogger.layer({
          url: logExport.endpoint,
          headers: logExport.headers,
          resource: otlpResource(),
        }).pipe(Layer.provide(OtlpSerialization.layerJson), Layer.provide(FetchHttpClient.layer)),
      ]

const metricsTee = (metricsExport: MetricsExport | undefined): readonly Layer.Layer<never>[] =>
  metricsExport === undefined
    ? []
    : [
        OtlpMetrics.layer({
          url: metricsExport.endpoint,
          headers: metricsExport.headers,
          resource: otlpResource(),
          exportInterval: Duration.millis(metricsExport.exportIntervalMs),
        }).pipe(Layer.provide(OtlpSerialization.layerJson), Layer.provide(FetchHttpClient.layer)),
      ]

const tracesTee = (traces: Traces | undefined): readonly Layer.Layer<never>[] =>
  traces === undefined
    ? []
    : [
        OtlpTracer.layer({
          url: traces.endpoint,
          headers: traces.headers,
          resource: otlpResource(),
          ...(traces.scheduleDelayMs !== undefined
            ? { exportInterval: Duration.millis(traces.scheduleDelayMs) }
            : {}),
        }).pipe(Layer.provide(OtlpSerialization.layerJson), Layer.provide(FetchHttpClient.layer)),
      ]

const buildLayer = (withOtlp: boolean): Layer.Layer<never> => {
  const minimumLevel = isDebugEnabled() ? LogLevel.Debug : LogLevel.Info
  const base = Layer.merge(
    Logger.replace(Logger.defaultLogger, stdoutLogger),
    Logger.minimumLogLevel(minimumLevel)
  )
  const { logExport, metricsExport, traces } = getTelemetryConfig()
  if (
    !withOtlp ||
    (logExport === undefined && metricsExport === undefined && traces === undefined)
  ) {
    return base
  }
  return Layer.mergeAll(
    base,
    ...logTee(logExport),
    ...metricsTee(metricsExport),
    ...tracesTee(traces)
  )
}

const bootstrapRuntime = (): ObsRuntime => {
  const existing = runtimes.get('bootstrap')
  if (existing !== undefined) return existing
  const runtime = ManagedRuntime.make(buildLayer(false))
  runtimes.set('bootstrap', runtime)
  return runtime
}

const activeRuntime = (): ObsRuntime => runtimes.get('full') ?? bootstrapRuntime()

export const setLogResource = (resource: LogResource): void => {
  state.set('resource', resource)
}

export const initObsRuntime = async (): Promise<void> => {
  const { logExport, metricsExport, traces } = getTelemetryConfig()
  if (logExport === undefined && metricsExport === undefined && traces === undefined) return
  const runtime = ManagedRuntime.make(buildLayer(true))
  await runtime.runtime()
  runtimes.set('full', runtime)
}

export const emitLog = (
  level: TelemetryLogLevel,
  message: string,
  attributes?: LogAttributes
): void => {
  const record = Effect.logWithLevel(toLogLevel(level), message)

  activeRuntime().runSync(attributes ? record.pipe(Effect.annotateLogs(attributes)) : record)
}

export const emitMetric = (effect: Effect.Effect<void>): void => {
  activeRuntime().runSync(effect)
}

export const runRequest = <A, E>(effect: Effect.Effect<A, E>): Promise<A> =>
  activeRuntime().runPromise(effect)

export const disposeObsRuntime = async (): Promise<void> => {
  const runtime = runtimes.get('full')
  if (runtime === undefined) return
  runtimes.delete('full')
  await runtime.dispose().catch(() => undefined)
}
