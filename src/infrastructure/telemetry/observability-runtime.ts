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
 * `OtlpSerialization`) plus `FetchHttpClient`, never an aggregate barrel (v3's
 * `@effect/opentelemetry` barrel pulled `@opentelemetry/*` and broke
 * `bun build --compile`; `effect/unstable/observability/index` would do the same).
 *
 * EFFECT 4. `@effect/opentelemetry` and `@effect/platform` are gone as packages
 * — v4 absorbs both, so these are the SAME exporters on new paths under
 * `effect/unstable/*`. `unstable` means the API may break in a minor; that is
 * accepted for this file only. `Metric` itself is stable and top-level
 * — only the OTLP exporter wiring lives under `unstable`.
 */

import { Duration, Effect, Layer, Logger, References, ManagedRuntime, Tracer } from 'effect'
import * as FetchHttpClient from 'effect/unstable/http/FetchHttpClient'
import * as HttpBody from 'effect/unstable/http/HttpBody'
import * as OtlpExporter from 'effect/unstable/observability/OtlpExporter'
import * as OtlpLogger from 'effect/unstable/observability/OtlpLogger'
import * as OtlpMetrics from 'effect/unstable/observability/OtlpMetrics'
import * as OtlpSerialization from 'effect/unstable/observability/OtlpSerialization'
import * as OtlpTracer from 'effect/unstable/observability/OtlpTracer'
import { formatClock } from '@/infrastructure/logging/cli-output'
import { isDebugEnabled, isProduction } from '@/infrastructure/process/env'
import { collectingTracer } from './span-collector'
import { getTelemetryConfig } from './telemetry-config'
import type { LogAttributes, TelemetryLogLevel } from './telemetry-sink'
import type {
  LogExportConfig as LogExport,
  MetricsExportConfig as MetricsExport,
  TracesConfig as Traces,
} from '@/domain/models/process-env/telemetry/telemetry'
import type { LogLevel } from 'effect'

/** Resolved OTLP resource identity (service name/version + deployment env). */
export interface LogResource {
  readonly serviceName: string
  readonly serviceVersion: string
  readonly environment: string
}

/**
 * v4's OTLP layers PROVIDE `Exporter.Flusher` where v3's provided `never`.
 * That does NOT have to appear here: v4 declares `Layer<in ROut, ...>` and
 * `ManagedRuntime<in R, ...>` CONTRAVARIANT in the services they provide, so a
 * `Layer<Flusher>` is assignable to `Layer<never>` and a
 * `ManagedRuntime<Flusher>` to `ManagedRuntime<never>`. Nothing here consumes
 * the Flusher — the tees flush on scope release — so the narrower type stands
 * and the signatures below are unchanged from v3.
 */
type ObsRuntime = ManagedRuntime.ManagedRuntime<never, never>

/** Resource identity, stamped by `activateTelemetry` before the first record. */
const state = new Map<'resource', LogResource>()
/** The pre-built stdout+OTLP runtime (undefined until `initObsRuntime`). */
const runtimes = new Map<'full' | 'bootstrap', ObsRuntime>()

/**
 * Map a severity to an Effect `LogLevel`.
 *
 * EFFECT 4. `LogLevel` is a plain string union (`LogLevel.d.ts:63`), not the v3
 * object with `.label`/`._tag`. Note the v3 constant was `LogLevel.Warning`
 * while the v4 literal is `'Warn'` — a mechanical `Warning -> 'Warning'` would
 * be an invalid member and, worse, a `'Warning'` STRING would still satisfy a
 * loosely-typed comparison elsewhere.
 */
const toLogLevel = (level: TelemetryLogLevel): LogLevel.Severity => {
  switch (level) {
    case 'error':
      return 'Error'
    case 'warn':
      return 'Warn'
    case 'info':
      return 'Info'
    case 'debug':
      return 'Debug'
  }
}

/**
 * Render one structured log line for the terminal — the pure half of
 * {@link stdoutLogger}, extracted so both shapes are testable without capturing
 * a process stream.
 *
 * PRODUCTION keeps `[ISO] [LEVEL] msg`, byte for byte (T43). That is the format
 * journald, Scalingo and the OTLP tee already parse; reformatting it would be a
 * log-shipping outage wearing a design change. The `.toUpperCase()` below is
 * load-bearing for exactly that reason — v3 read `logLevel.label`, which was
 * already UPPERCASE (`'WARN'`), while v4's `logLevel` IS the string and it is
 * title-case (`'Warn'`).
 *
 * OUTSIDE PRODUCTION the line joins the journal (T39): `HH:MM:SS <message>`,
 * where the message already opens with its own `[area]` tag by the convention
 * in `logging/logger.ts`. Severity is the WORD, after the clock (T41) — never a
 * `[LEVEL]` bracket, which T34 exists to refuse, and never a glyph (T11).
 *
 * The `date` is the one Effect's `Logger.make` already hands the callback, so
 * the clock is the instant of the log record rather than the instant of
 * formatting.
 */
export const formatStdoutLogLine = (
  label: string,
  message: string,
  date: Readonly<Date>
): string => {
  if (isProduction()) return `[${date.toISOString()}] [${label}] ${message}`
  const severity = label === 'ERROR' ? 'Error: ' : label === 'WARN' ? 'Warning: ' : ''
  return `${formatClock(date)} ${severity}${message}`
}

/**
 * The stdout sink. debug/info → stdout, warn/error → stderr (matching
 * `Console.debug/log` vs `Console.warn/error`). The error `cause` stack is
 * written by the `logError` helper, not here.
 *
 * The routing is deliberately shape-independent: the stream carries severity in
 * BOTH shapes (T31), so a development journal and a production log agree about
 * where a warning goes even though they disagree about how it reads.
 */
const stdoutLogger: Logger.Logger<unknown, void> = Logger.make(({ logLevel, message, date }) => {
  const label = logLevel.toUpperCase()
  const line = `${formatStdoutLogLine(label, String(message), date)}\n`
  const toStderr = label === 'ERROR' || label === 'WARN'
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
 * Restore UPPERCASE `severityText` on exported OTLP log records.
 *
 * EFFECT 4 BEHAVIOURAL CHANGE. v3's `@effect/opentelemetry` OtlpLogger wrote
 * `severityText: options.logLevel.label`, and `label` was UPPERCASE (`'ERROR'`).
 * v4 writes `severityText: options.logLevel` directly
 * (`OtlpLogger.ts:222`), and v4's `LogLevel.Severity` union is title-case
 * (`'Fatal' | 'Error' | 'Warn' | …`, `LogLevel.ts:87`). So every exported record
 * silently changed `ERROR` -> `Error`, and any operator pipeline filtering
 * `severityText == "ERROR"` stops matching WITHOUT erroring — the silent-breakage
 * class this migration keeps finding. Our GlitchTip collector is live production.
 *
 * `severityNumber` is UNAFFECTED (still 17 for error), so a consumer filtering on
 * the numeric field never saw this. The text field is the one that broke.
 *
 * Two reasons this maps back rather than accepting v4's casing:
 *   1. v3 parity — this migration intends no user-facing behaviour change.
 *   2. INTERNAL CONSISTENCY — `stdoutLogger` above already calls `.toUpperCase()`
 *      for exactly this reason. Leaving OTLP title-case would make our own two
 *      log sinks disagree about the level of the same event.
 *
 * `OtlpLogger.layer` exposes no record-transform hook, so the mapping happens at
 * the serialization seam below — the last point before the HTTP body is built.
 */
export const uppercaseSeverityText = (data: OtlpLogger.LogsData): OtlpLogger.LogsData => ({
  ...data,
  resourceLogs: data.resourceLogs.map((resourceLog) => ({
    ...resourceLog,
    scopeLogs: resourceLog.scopeLogs.map((scopeLog) => ({
      ...scopeLog,
      logRecords: scopeLog.logRecords?.map((record) =>
        typeof record.severityText === 'string'
          ? { ...record, severityText: record.severityText.toUpperCase() }
          : record
      ),
    })),
  })),
})

/**
 * Drop-in replacement for `OtlpSerialization.layerJson` that applies
 * {@link uppercaseSeverityText} to logs. `traces` and `metrics` mirror upstream
 * verbatim and are untouched — they carry no severity field.
 *
 * This mirrors a 3-line upstream layer rather than wrapping it, because
 * `layerJson` is a `Layer.succeed` with no service to delegate to. If upstream
 * changes the JSON body construction, this must follow — the coupling is the
 * price of the mapping, and it is confined to this one constant.
 */
const otlpSerializationJson = Layer.succeed(OtlpSerialization.OtlpSerialization, {
  traces: (spans) => HttpBody.jsonUnsafe(spans),
  metrics: (metrics) => HttpBody.jsonUnsafe(metrics),
  logs: (logs) => HttpBody.jsonUnsafe(uppercaseSeverityText(logs)),
})

/**
 * Logs tee (0 or 1 layer). v4's `OtlpLogger.layer` defaults
 * `mergeWithExisting: true` (OtlpLogger.js:79), so it ADDS OTLP to the logger
 * set rather than replacing it — `stdoutLogger` keeps writing the console and
 * OTLP exports the same record, which is what v3's omitted `replaceLogger` did.
 * Empty unless log export is armed.
 */
const logTee = (logExport: LogExport | undefined): readonly Layer.Layer<never>[] =>
  logExport === undefined
    ? []
    : [
        OtlpLogger.layer({
          url: logExport.endpoint,
          headers: logExport.headers,
          resource: otlpResource(),
        }).pipe(Layer.provide(otlpSerializationJson), Layer.provide(FetchHttpClient.layer)),
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
        }).pipe(Layer.provide(otlpSerializationJson), Layer.provide(FetchHttpClient.layer)),
      ]

/**
 * Traces tee (0 or 1 layer), gated on EITHER of two independent signals.
 *
 * 1. **A traces endpoint is armed.** The OTLP tracer is installed; its exporter
 *    fiber batches finished spans every `exportInterval`
 *    (`OTEL_BSP_SCHEDULE_DELAY`, default 5s) and PUSHes them to
 *    `<endpoint>/v1/traces`. The fiber lives in this (pre-built) runtime's scope
 *    so `Effect.withSpan` seams run against the OTLP tracer and the final batch
 *    flushes on `disposeObsRuntime`.
 * 2. **Sentry performance sampling is armed.** Spans then have somewhere to GO
 *    even with the OTLP pipeline disarmed — the Sentry transaction envelope.
 *
 * `collectingTracer` is what joins the two: it files every span it mints into
 * the current request's box (`request-trace-context.ts`) and otherwise behaves
 * exactly like the tracer it wraps. With traces armed it wraps the OTLP tracer,
 * so BOTH destinations see the same spans; with traces disarmed it wraps
 * nothing and mints native spans, reproducing the default tracer's behaviour
 * while still filling the box.
 *
 * That second branch is the production configuration and the reason this file
 * changed at all: GlitchTip received 4293 transactions and zero spans precisely
 * because span reachability was gated on an OTLP endpoint nobody had set.
 *
 * The armed-traces branch reproduces `OtlpTracer.layer` inline
 * (`flow(make, Layer.effect(Tracer.Tracer), Layer.provideMerge(layerFlusher))`)
 * rather than calling it, because the wrap has to happen BETWEEN `make` and
 * `Layer.effect` — there is no seam for it once the layer is built.
 *
 * Head-sampling (the ecoconception volume lever) is applied at the request edge
 * in `runRequestEffect` via `Effect.withTracerEnabled` — NOT here; the OtlpTracer
 * exports every span it is handed.
 */
const tracesTee = (
  traces: Traces | undefined,
  collectSpans: boolean
): readonly Layer.Layer<never>[] => {
  if (traces !== undefined) {
    // Always collecting, even with the Sentry gate off: `runRequestEffect` reads
    // `box.root` to decide whether to open a request root or chain under the
    // existing one, so a traces-only instance needs the collector too — without
    // it, a handler running several Effect programs fragments one request into
    // several disconnected traces. Outside a request box the collector is inert.
    return [
      Layer.effect(
        Tracer.Tracer,
        Effect.map(
          OtlpTracer.make({
            url: traces.endpoint,
            headers: traces.headers,
            resource: otlpResource(),
            ...(traces.scheduleDelayMs !== undefined
              ? { exportInterval: Duration.millis(traces.scheduleDelayMs) }
              : {}),
          }),
          (delegate) => collectingTracer(delegate)
        )
      ).pipe(
        Layer.provideMerge(OtlpExporter.layerFlusher),
        Layer.provide(otlpSerializationJson),
        Layer.provide(FetchHttpClient.layer)
      ),
    ]
  }
  return collectSpans ? [Layer.succeed(Tracer.Tracer, collectingTracer())] : []
}

/** Build the observability layer. `withOtlp` adds the OTLP tees (async `Scope`). */
const buildLayer = (withOtlp: boolean): Layer.Layer<never> => {
  const minimumLevel: LogLevel.LogLevel = isDebugEnabled() ? 'Debug' : 'Info'
  // EFFECT 4, two renames that are NOT interchangeable with their v3 spelling:
  //
  //  - `Logger.replace(defaultLogger, stdoutLogger)` swapped ONE logger and left
  //    the rest of the set alone. `Logger.layer([...])` replaces the WHOLE set,
  //    so `Logger.tracerLogger` — part of v3's default set, and what turns log
  //    records into span events — has to be listed explicitly or it is silently
  //    dropped. It matters here precisely because this file also installs
  //    `OtlpTracer`.
  //  - `Logger.minimumLogLevel(l)` is gone; the level is a Context Reference
  //    (`References.MinimumLogLevel`, References.d.ts:338).
  const base = Layer.merge(
    Logger.layer([stdoutLogger, Logger.tracerLogger]),
    Layer.succeed(References.MinimumLogLevel, minimumLevel)
  )
  // `performance` arms this runtime too, even though it exports nothing over
  // OTLP: the span box the Sentry transaction reads is filled by the tracer the
  // traces tee installs, so a performance-only instance still needs that tee.
  const { logExport, metricsExport, traces, performance } = getTelemetryConfig()
  if (
    !withOtlp ||
    (logExport === undefined &&
      metricsExport === undefined &&
      traces === undefined &&
      performance === undefined)
  ) {
    return base
  }
  return Layer.mergeAll(
    base,
    ...logTee(logExport),
    ...metricsTee(metricsExport),
    ...tracesTee(traces, performance !== undefined)
  )
}

// `ObsRuntime` is a local alias for `ManagedRuntime.ManagedRuntime<never, never>`
// — an Effect-owned type. `functional/prefer-immutable-types` is exempted from
// Effect's own types by ANNOTATION TEXT, and a
// local alias is exactly the case that lever cannot see. Disabling here rather
// than adding `^ObsRuntime$` to that list keeps the list describing types we do
// not own, instead of quietly accumulating names of ours.
/** The sync-buildable stdout-only runtime — always available (boot window / OTLP off). */
// eslint-disable-next-line functional/prefer-immutable-types -- ObsRuntime is an alias
const bootstrapRuntime = (): ObsRuntime => {
  const existing = runtimes.get('bootstrap')
  if (existing !== undefined) return existing
  const runtime = ManagedRuntime.make(buildLayer(false))
  // eslint-disable-next-line functional/no-expression-statements, functional/immutable-data -- memoize
  runtimes.set('bootstrap', runtime)
  return runtime
}

/** The active runtime: the pre-built stdout+OTLP one once ready, else bootstrap. */
// eslint-disable-next-line functional/prefer-immutable-types -- ObsRuntime is an alias
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
  const { logExport, metricsExport, traces, performance } = getTelemetryConfig()
  if (
    logExport === undefined &&
    metricsExport === undefined &&
    traces === undefined &&
    performance === undefined
  )
    return
  const runtime = ManagedRuntime.make(buildLayer(true))
  // Pre-build: populate the cached Runtime (acquires the OTLP Scope + exporter
  // fiber) so later runSync takes the fast, synchronous cached-runtime path.
  // EFFECT 4: `ManagedRuntime.runtime()` is gone; `context()` resolves the same
  // cached context (ManagedRuntime.d.ts:108), which is what "pre-build" means
  // here — the async OTLP Scope and its exporter fibers are acquired now so
  // every later `runSync` takes the synchronous cached path.
  // eslint-disable-next-line functional/no-expression-statements -- pre-build the runtime
  await runtime.context()
  // eslint-disable-next-line functional/no-expression-statements, functional/immutable-data -- publish the pre-built runtime
  runtimes.set('full', runtime)
}

/**
 * The log record itself, as an Effect — the thing {@link emitLog} runs.
 *
 * Exported so a test can run the EXACT effect the sink runs, on its own runtime
 * with a capturing logger, rather than re-deriving an equivalent one. That is
 * the only way to assert the `parentSpan` behaviour below, because the real
 * runtime's loggers are stdout and the OTLP tee.
 *
 * `parentSpan` is what gives log↔trace correlation, and it has to be passed in
 * rather than inherited. Every call here runs on the OBSERVABILITY runtime,
 * which means a FRESH fiber: `OtlpLogger` stamps `traceId`/`spanId` from
 * `options.fiber.currentSpan` (OtlpLogger.ts:230), and a fresh fiber has none,
 * so before this argument existed NO log line emitted from inside application
 * code could carry a trace id — however deep inside a span it was written.
 * `Effect.withParentSpan` puts the caller's span into this fiber's context,
 * where `fiber.currentSpan` reads it.
 */
export const logRecordEffect = (
  level: TelemetryLogLevel,
  message: string,
  attributes?: LogAttributes,
  parentSpan?: Tracer.AnySpan
): Effect.Effect<void> => {
  // EFFECT 4: `logWithLevel` is CURRIED — `(level) => (...message) => Effect`
  // (Effect.d.ts:17479), where v3 took both at once.
  const record = Effect.logWithLevel(toLogLevel(level))(message)
  const annotated = attributes ? record.pipe(Effect.annotateLogs(attributes)) : record
  return parentSpan ? annotated.pipe(Effect.withParentSpan(parentSpan)) : annotated
}

/**
 * Emit one structured log line through the unified runtime: stdout (always) +
 * OTLP (once activated). Optional `attributes` become OTLP record attributes via
 * `Effect.annotateLogs`; they never touch stdout. `runSync` is safe because the
 * active runtime is either sync-buildable (bootstrap) or pre-built (full).
 *
 * `parentSpan` is supplied by the `Logger` SERVICE, which reads the ambient span
 * off its own fiber before crossing into this runtime. The plain-function
 * helpers (`logError` and friends) pass nothing, because there is no fiber to
 * read one from — which is the honest answer for a `catch` block in an async
 * helper, and why the argument is optional rather than required.
 */
export const emitLog = (
  level: TelemetryLogLevel,
  message: string,
  attributes?: LogAttributes,
  parentSpan?: Tracer.AnySpan
): void => {
  activeRuntime().runSync(logRecordEffect(level, message, attributes, parentSpan))
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
