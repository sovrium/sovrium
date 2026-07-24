/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import * as OtlpLogger from '@effect/opentelemetry/OtlpLogger'
import * as OtlpSerialization from '@effect/opentelemetry/OtlpSerialization'
import * as FetchHttpClient from '@effect/platform/FetchHttpClient'
import { Effect, Layer, Logger, LogLevel, ManagedRuntime } from 'effect'
import { getTelemetryConfig } from './telemetry-config'
import type { TelemetryLogLevel } from './telemetry-sink'

export interface LogResource {
  readonly serviceName: string
  readonly serviceVersion: string
  readonly environment: string
}

type LogRuntime = ManagedRuntime.ManagedRuntime<never, never>

const runtimeState = new Map<'runtime', LogRuntime>()
const resourceState = new Map<'resource', LogResource>()

export const setLogResource = (resource: LogResource): void => {
  resourceState.set('resource', resource)
}

const buildRuntime = (endpoint: string, headers: Readonly<Record<string, string>>): LogRuntime => {
  const resource = resourceState.get('resource')
  const loggerLayer = OtlpLogger.layer({
    url: endpoint,
    replaceLogger: Logger.defaultLogger,
    headers,
    resource: {
      serviceName: resource?.serviceName ?? 'sovrium',
      serviceVersion: resource?.serviceVersion ?? '0.0.0',
      attributes: { 'deployment.environment': resource?.environment ?? 'development' },
    },
  }).pipe(Layer.provide(OtlpSerialization.layerJson), Layer.provide(FetchHttpClient.layer))
  return ManagedRuntime.make(loggerLayer)
}

const getRuntime = (): LogRuntime | undefined => {
  const existing = runtimeState.get('runtime')
  if (existing !== undefined) return existing
  const { logExport } = getTelemetryConfig()
  if (logExport === undefined) return undefined
  const runtime = buildRuntime(logExport.endpoint, logExport.headers)
  runtimeState.set('runtime', runtime)
  return runtime
}

export const initLogRuntime = (): void => {
  getRuntime()
}

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

export const emitOtlpLog = (level: TelemetryLogLevel, message: string): void => {
  const runtime = getRuntime()
  if (runtime === undefined) return
  runtime.runFork(Effect.logWithLevel(toLogLevel(level), message))
}

export const disposeLogRuntime = async (): Promise<void> => {
  const runtime = runtimeState.get('runtime')
  if (runtime === undefined) return
  runtimeState.delete('runtime')
  await runtime.dispose().catch(() => undefined)
}
