/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Telemetry activation + dual-write sink ([internal ref]-*).
 *
 * `activateTelemetry` is called ONCE at boot (from `startServer`) after the
 * fail-loud validation has passed. It wires the DSN-gated error reporter (+ its
 * process-level crash handlers) and, when an OTLP endpoint is set, stamps the
 * log-export resource identity and eagerly builds the export runtime.
 *
 * `emitTelemetryLog` is the dual-write bridge the structured `Logger` calls on
 * every line: it exports the line as an OTLP log record AND forwards any `Error`
 * cause to the Sentry reporter (deduped against the `.onError` path via the
 * reporter's `WeakSet`), while writing that cause's FULL chain to stderr. stdout
 * stays byte-identical because the export runs in an isolated runtime whose
 * default logger is replaced — this sink never writes to the console.
 */

import { hostname } from 'node:os'
import { isErrorReportingEnabled } from '@/domain/models/env/telemetry/telemetry'
import { formatErrorChain } from './error-chain'
import { initErrorReporter, registerProcessErrorHandlers, reportException } from './error-reporter'
import { disposeObsRuntime, emitLog, initObsRuntime, setLogResource } from './observability-runtime'
import { getTelemetryConfig } from './telemetry-config'

/** Severity of a dual-written log line (mirrors the `Logger` service methods). */
export type TelemetryLogLevel = 'debug' | 'info' | 'warn' | 'error'

/**
 * Structured key/value fields attached to a log line. Rendered as OTLP log-record
 * attributes (via `Effect.annotateLogs`), enabling correlation/filtering in the
 * backend — e.g. `{ 'request.id': '…' }`. The human-readable stdout line is
 * unchanged; attributes travel only on the exported record.
 */
export type LogAttributes = Readonly<Record<string, string>>

/** Boot-time activation inputs (resolved in `startServer`). */
export interface ActivateTelemetryOptions {
  /** App name — the OTLP `service.name` fallback when `OTEL_SERVICE_NAME` is unset. */
  readonly appName: string
  /** Sovrium version — feeds `release` (Sentry) and `service.version` (OTLP). */
  readonly version: string
}

/**
 * Activate every enabled telemetry signal exactly once. Idempotent across watch
 * reloads. Never activated on the static-build / `createAdmin` paths.
 */
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

  // Logs, metrics, and traces share ONE OTLP resource identity and ONE pre-built
  // runtime. ANY of the three signals arms it; when several are on (a base
  // `OTEL_EXPORTER_OTLP_ENDPOINT` derives logs+metrics), the first present supplies
  // the resource — all carry identical service/environment values. Traces alone
  // (only `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` set) must still arm the runtime so
  // the OtlpTracer tee (and its exporter fiber) is built.
  const otlp = config.logExport ?? config.metricsExport ?? config.traces
  if (otlp !== undefined) {
    // service.name: OTEL_SERVICE_NAME → app name → `sovrium`.
    setLogResource({
      serviceName: otlp.serviceName || options.appName || 'sovrium',
      serviceVersion: options.version,
      environment: otlp.environment,
    })
    // Pre-build the unified stdout+OTLP runtime (async: acquires the OTLP Scope
    // and the metrics poller fiber) so later synchronous emits run against the
    // cached runtime. Until it resolves, the sync stdout bootstrap serves each
    // line — boot logs stay stdout-only exactly as before.
    // eslint-disable-next-line functional/no-expression-statements -- fire-and-forget pre-build
    void initObsRuntime()
  }
}

/**
 * Dual-write a structured log line to telemetry, in addition to (never instead
 * of) stdout. Exports an OTLP log record and forwards an `Error` cause to the
 * Sentry reporter. No-op for whichever signals are disabled.
 */
export const emitTelemetryLog = (
  level: TelemetryLogLevel,
  message: string,
  cause?: unknown,
  attributes?: LogAttributes
): void => {
  emitLog(level, message, attributes)
  if (cause instanceof Error) {
    // Local stack for terminal debugging — the unified stdout logger writes only
    // the formatted message line; the reporter forwards the cause to Sentry (deduped).
    //
    // The FULL cause chain is rendered, not `cause.stack`. `Error.prototype.stack`
    // stops at the error it belongs to, so writing it alone recorded the wrapper
    // ("Failed to create record in X") and silently discarded the originating
    // driver error — one level deep, in the sink operators rely on most.
    // stdout/journald is the last-resort record: it survives the error backend
    // being down, misconfigured, or never enabled, so it must carry the whole
    // chain rather than the outermost link.
    // eslint-disable-next-line functional/no-expression-statements -- terminal stack write
    process.stderr.write(formatErrorChain(cause) + '\n')
    // eslint-disable-next-line functional/no-expression-statements -- fire-and-forget cause report (deduped)
    void reportException(cause)
  }
}

/** Flush + close the unified observability runtime on server shutdown. */
export const shutdownTelemetry = (): Promise<void> => disposeObsRuntime()
