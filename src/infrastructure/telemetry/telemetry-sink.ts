/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { hostname } from 'node:os'
import {
  isErrorReportingEnabled,
  isLogExportEnabled,
} from '@/domain/models/env/telemetry/telemetry'
import { initErrorReporter, registerProcessErrorHandlers, reportException } from './error-reporter'
import { getTelemetryConfig } from './telemetry-config'
import { disposeLogRuntime, emitOtlpLog, initLogRuntime, setLogResource } from './telemetry-runtime'

export type TelemetryLogLevel = 'debug' | 'info' | 'warn' | 'error'

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

  if (isLogExportEnabled(config) && config.logExport !== undefined) {
    setLogResource({
      serviceName: config.logExport.serviceName || options.appName || 'sovrium',
      serviceVersion: options.version,
      environment: config.logExport.environment,
    })
    initLogRuntime()
  }
}

export const emitTelemetryLog = (
  level: TelemetryLogLevel,
  message: string,
  cause?: unknown
): void => {
  emitOtlpLog(level, message)
  if (cause instanceof Error) {
    void reportException(cause)
  }
}

export const shutdownTelemetry = (): Promise<void> => disposeLogRuntime()
