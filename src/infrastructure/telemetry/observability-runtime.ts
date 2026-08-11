/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Unified observability runtime ([internal ref]-*).
 *
 * ONE `ManagedRuntime` carries the whole logging path: a custom stdout logger
 * (`[ISO] [LEVEL] msg`, byte-compatible with the previous `Console.*` output)
 * teed with the OTLP log exporter. A single `Effect.log*` therefore fans out to
 * BOTH stdout and OTLP from one runtime — replacing the previous two-runtime
 * split (a sync stdout runtime + a separate fire-and-forget OTLP runtime).
 *
 * WHY THIS IS SAFE (the "P2b" resolution): `ManagedRuntime` builds lazily and
 * caches. A *cold* `runSync` would try to build the async OTLP `Scope` layer
 * synchronously and throw — the historic blocker. We instead PRE-BUILD the OTLP
 * runtime once at boot (`await runtime.runtime()` in `initObsRuntime`); every
 * later `runSync(Effect.log…)` then runs only the synchronous log effect against
 * the already-resolved context. Before activation (and whenever OTLP is off), a
 * sync-buildable stdout-only runtime is used — so boot logs before telemetry
 * activation are stdout-only, exactly as before.
 *
 * The metrics reader is teed onto the SAME runtime: `OtlpMetrics.layer` spawns a
 * periodic poller fiber that snapshots the global `Metric` registry every
 * `exportInterval` and PUSHes the datapoints to `<endpoint>/v1/metrics`. Because
 * that poller is a background fiber, it must live in the PRE-BUILT full runtime
 * (`initObsRuntime` calls `await runtime.runtime()`) so its scope is actually
 * acquired at boot and released by `disposeObsRuntime` on shutdown.
 *
 * Binary-safety: OTLP is imported by subpath (`OtlpLogger`/`OtlpMetrics`/
 * `OtlpSerialization`) plus `FetchHttpClient`, never the `@effect/opentelemetry`
 * barrel (which pulls `@opentelemetry/*` and breaks `bun build --compile`).
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

/** Resolved OTLP resource identity (service name/version + deployment env). */
export interface LogResource {
  readonly serviceName: string
  readonly serviceVersion: string
  readonly environment: string
}

type ObsRuntime = ManagedRuntime.ManagedRuntime<never, never>

/** Resource identity, stamped by `activateTelemetry` before the first record. */
const state = new Map<'resource', LogResource>()
/** The pre-built stdout+OTLP runtime (undefined until `initObsRuntime`). */
const runtimes = new Map<'full' | 'bootstrap', ObsRuntime>()

/** Map a severity to an Effect `LogLevel`. */
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

/**
 * The stdout sink — reproduces `[ISO] [LEVEL] msg`, byte-compatible with the
 * previous `formatLogMessage` + `Console.*` output. debug/info → stdout,
 * warn/error → stderr (matching `Console.debug/log` vs `Console.warn/error`);
 * the E2E harnesses merge both streams, so the split is not asserted. The error
 * `cause` stack is written by the `logError` helper, not here.
 */
const stdoutLogger: Logger.Logger<unknown, void> = Logger.make(({ logLevel, message, date }) => {
  const line = `[${date.toISOString()}] [${logLevel.label}] ${String(message)}\n`
  const toStderr = logLevel.label === 'ERROR' || logLevel.label === 'WARN'
  // eslint-disable-next-line functional/no-expression-statements -- terminal sink write
  ;(toStderr ? process.stderr : process.stdout).write(line)
})

/** The shared OTLP resource identity (service name/version + deployment env). */
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

/**
 * Logs tee (0 or 1 layer). Omitting `replaceLogger` ADDS OTLP to the logger set
 * (additive tee) — `stdoutLogger` keeps writing the console and OTLP exports the
 * same record. Empty unless log export is armed.
 */
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

/**
 * Metrics tee (0 or 1 layer): a periodic reader fiber that snapshots the global
 * `Metric` registry every `exportInterval` and PUSHes to `<endpoint>/v1/metrics`.
 * Empty unless metrics export is armed; its poll fiber lives in this (pre-built)
 * runtime's scope.
 */
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

/**
 * Traces tee (0 or 1 layer): `OtlpTracer.layer` installs the OTLP tracer (via
 * `Layer.setTracer`) whose exporter fiber batches finished spans every
 * `exportInterval` (`OTEL_BSP_SCHEDULE_DELAY`, default 5s) and PUSHes them to
 * `<endpoint>/v1/traces`. Empty unless a traces endpoint is armed; its exporter
 * fiber lives in this (pre-built) runtime's scope so `Effect.withSpan` seams run
 * against the OTLP tracer and the final batch flushes on `disposeObsRuntime`.
 *
 * Head-sampling (the ecoconception volume lever) is applied at the request edge
 * in `runRequestEffect` via `Effect.withTracerEnabled` — NOT here; the OtlpTracer
 * exports every span it is handed.
 */
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

/** Build the observability layer. `withOtlp` adds the OTLP tees (async `Scope`). */
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

/** The sync-buildable stdout-only runtime — always available (boot window / OTLP off). */
const bootstrapRuntime = (): ObsRuntime => {
  const existing = runtimes.get('bootstrap')
  if (existing !== undefined) return existing
  const runtime = ManagedRuntime.make(buildLayer(false))
  // eslint-disable-next-line functional/no-expression-statements, functional/immutable-data -- memoize
  runtimes.set('bootstrap', runtime)
  return runtime
}

/** The active runtime: the pre-built stdout+OTLP one once ready, else bootstrap. */
const activeRuntime = (): ObsRuntime => runtimes.get('full') ?? bootstrapRuntime()

/** Provide the OTLP resource identity (called before `initObsRuntime`). */
export const setLogResource = (resource: LogResource): void => {
  // eslint-disable-next-line functional/no-expression-statements, functional/immutable-data -- set-once resource
  state.set('resource', resource)
}

/**
 * Build AND pre-build the unified stdout+OTLP runtime so subsequent `runSync`
 * calls are safe (the async OTLP `Scope` is resolved exactly once, here). Called
 * from `activateTelemetry` when log export is enabled. No-op when OTLP is off
 * (the bootstrap stdout runtime already serves every line synchronously).
 */
export const initObsRuntime = async (): Promise<void> => {
  const { logExport, metricsExport, traces } = getTelemetryConfig()
  if (logExport === undefined && metricsExport === undefined && traces === undefined) return
  const runtime = ManagedRuntime.make(buildLayer(true))
  // Pre-build: populate the cached Runtime (acquires the OTLP Scope + exporter
  // fiber) so later runSync takes the fast, synchronous cached-runtime path.
  // eslint-disable-next-line functional/no-expression-statements -- pre-build the runtime
  await runtime.runtime()
  // eslint-disable-next-line functional/no-expression-statements, functional/immutable-data -- publish the pre-built runtime
  runtimes.set('full', runtime)
}

/**
 * Emit one structured log line through the unified runtime: stdout (always) +
 * OTLP (once activated). Optional `attributes` become OTLP record attributes via
 * `Effect.annotateLogs`; they never touch stdout. `runSync` is safe because the
 * active runtime is either sync-buildable (bootstrap) or pre-built (full).
 */
export const emitLog = (
  level: TelemetryLogLevel,
  message: string,
  attributes?: LogAttributes
): void => {
  const record = Effect.logWithLevel(toLogLevel(level), message)

  activeRuntime().runSync(attributes ? record.pipe(Effect.annotateLogs(attributes)) : record)
}

/**
 * Record an HTTP-server metric-update effect (a `Metric.update` composition from
 * `metrics.ts`) through the active runtime. `Metric.update` writes the process-
 * global registry synchronously, which the OTLP metrics poller (living in the
 * pre-built full runtime) snapshots each cycle — so this reaches the exporter
 * regardless of which runtime runs it. `runSync` is safe: the effect is purely
 * synchronous and the active runtime is either sync-buildable or pre-built.
 */
export const emitMetric = (effect: Effect.Effect<void>): void => {
  activeRuntime().runSync(effect)
}

/**
 * Run a request-scoped Effect on the active observability runtime, returning a
 * Promise (the request-edge entry point used by `runRequestEffect`).
 *
 * When traces (or logs/metrics) are armed the PRE-BUILT `full` runtime is active,
 * so the OTLP tracer is in scope for any `Effect.withSpan` seams AND logs emitted
 * inside those spans auto-correlate — `OtlpLogger` stamps the current span's
 * `traceId` onto each record. When telemetry is off the sync-buildable bootstrap
 * runtime runs it: `Effect.withSpan` resolves to the default no-op tracer, so
 * there is zero tracing overhead and nothing is exported.
 */
export const runRequest = <A, E>(effect: Effect.Effect<A, E>): Promise<A> =>
  activeRuntime().runPromise(effect)

/** Flush + tear down the OTLP runtime on server shutdown. */
export const disposeObsRuntime = async (): Promise<void> => {
  const runtime = runtimes.get('full')
  if (runtime === undefined) return
  // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements, drizzle/enforce-delete-with-where -- release the handle (Map.delete; drizzle rule false-positive on Map)
  runtimes.delete('full')
  // eslint-disable-next-line functional/no-expression-statements -- flush + close the export runtime
  await runtime.dispose().catch(() => undefined)
}
