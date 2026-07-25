/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { hostname } from 'node:os'
import { isErrorReportingEnabled } from '@/domain/models/env/telemetry/telemetry'
import { initErrorReporter, registerProcessErrorHandlers, reportException } from './error-reporter'
import { disposeObsRuntime, emitLog, initObsRuntime, setLogResource } from './observability-runtime'
import { getTelemetryConfig } from './telemetry-config'

export type TelemetryLogLevel = 'debug' | 'info' | 'warn' | 'error'

export type LogAttributes = Readonly<Record<string, string>>

export interface ActivateTelemetryOptions {
  readonly appName: string
  readonly version: string
}

export const activateTelemetry = (options: ActivateTelemetryOptions): void => {
  const config = getTelemetryConfig()

  if (isErrorReportingEnabled(config) && config.errorReporting !== undefined) {
    initErrorReporter({
      release: `sovrium@${options.version}`,
      environment: config.errorReporting.environment,
      serverName: hostname(),
    })
    registerProcessErrorHandlers()
  }

  const otlp = config.logExport ?? config.metricsExport ?? config.traces
  if (otlp !== undefined) {
    setLogResource({
      serviceName: otlp.serviceName || options.appName || 'sovrium',
      serviceVersion: options.version,
      environment: otlp.environment,
    })
    void initObsRuntime()
  }
}

export const emitTelemetryLog = (
  level: TelemetryLogLevel,
  message: string,
  cause?: unknown,
  attributes?: LogAttributes
): void => {
  emitLog(level, message, attributes)
  if (cause instanceof Error) {
    process.stderr.write((cause.stack ?? String(cause)) + '\n')
    void reportException(cause)
  }
}

export const shutdownTelemetry = (): Promise<void> => disposeObsRuntime()
