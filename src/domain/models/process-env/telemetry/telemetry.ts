/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Telemetry (observability-export) environment configuration
 * ([internal ref]-*).
 *
 * Resolves four independent, env-gated, default-OFF signals from `process.env`:
 *
 * 1. Error reporting     — gate `SENTRY_DSN`
 * 2. Performance         — gate `SENTRY_DSN` + `SENTRY_TRACES_SAMPLE_RATE` in (0,1]
 * 3. Log export (OTLP)   — gate `OTEL_EXPORTER_OTLP_ENDPOINT` (or the full-URL
 *                          `OTEL_EXPORTER_OTLP_LOGS_ENDPOINT` override)
 * 4. OTel traces (dormant) — gate `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`
 *
 * Pure, dependency-free parsing modelled on `database/database-dialect.ts`:
 * an UNSET gate resolves to off (sovereignty default preserved); a SET-but-
 * malformed value (bad DSN grammar, a sample rate outside `(0,1]`) throws so the
 * boot validator can abort loudly, naming the offending variable. An empty
 * string counts as unset (off) — this defeats a leaked parent-env var without
 * turning it into a malformed-value boot failure.
 */

import { parseSentryDsn, type SentryDsn } from './sentry-dsn'

/** A read-only `process.env`-shaped map (the only input this module reads). */
type EnvRecord = Readonly<Record<string, string | undefined>>

/** Error-reporting signal: a parsed DSN + the resolved deployment environment. */
export interface ErrorReportingConfig {
  readonly dsn: SentryDsn
  readonly environment: string
}

/** Performance signal: a validated sample rate in `(0,1]`. */
export interface PerformanceConfig {
  readonly sampleRate: number
}

/** Log-export signal: the resolved OTLP `/v1/logs` URL + resource identity. */
export interface LogExportConfig {
  /** Full logs endpoint POSTed to — base + `/v1/logs`, or the verbatim override. */
  readonly endpoint: string
  /** `OTEL_SERVICE_NAME` (may be empty — the app-name fallback is applied in infra). */
  readonly serviceName: string
  /** Resolved `deployment.environment` resource attribute. */
  readonly environment: string
  /** Parsed `OTEL_EXPORTER_OTLP_HEADERS` (`k=v,k2=v2`), passed through verbatim. */
  readonly headers: Readonly<Record<string, string>>
  /** Destination host parsed from `endpoint` — the banner renders this only. */
  readonly host: string
}

/** Metrics-export signal: the resolved OTLP `/v1/metrics` URL + poll interval. */
export interface MetricsExportConfig {
  /** Full metrics endpoint POSTed to — base + `/v1/metrics`, or the verbatim override. */
  readonly endpoint: string
  /** `OTEL_SERVICE_NAME` (may be empty — the app-name fallback is applied in infra). */
  readonly serviceName: string
  /** Resolved `deployment.environment` resource attribute. */
  readonly environment: string
  /** Parsed `OTEL_EXPORTER_OTLP_HEADERS` (`k=v,k2=v2`), passed through verbatim. */
  readonly headers: Readonly<Record<string, string>>
  /** Destination host parsed from `endpoint` — the banner renders this only. */
  readonly host: string
  /** Poll interval (ms) the periodic reader snapshots the registry on (default 10000). */
  readonly exportIntervalMs: number
}

/**
 * OTel-standard trace-sampler names Sovrium recognizes. Unknown names abort the
 * boot (fail-loud). `parentbased_*` variants honor an incoming parent's sampling
 * decision when one exists; at the request root (no upstream parent, Phase T) the
 * ratio applies directly — so each variant collapses to an effective head ratio.
 */
export type TraceSampler =
  | 'always_on'
  | 'always_off'
  | 'traceidratio'
  | 'parentbased_always_on'
  | 'parentbased_always_off'
  | 'parentbased_traceidratio'

/** OTel traces signal: an explicit traces endpoint + resource identity + sampling. */
export interface TracesConfig {
  readonly endpoint: string
  /** `OTEL_SERVICE_NAME` (may be empty — the app-name fallback is applied in infra). */
  readonly serviceName: string
  /** Resolved `deployment.environment` resource attribute. */
  readonly environment: string
  /** Parsed `OTEL_EXPORTER_OTLP_HEADERS`, passed through verbatim. */
  readonly headers: Readonly<Record<string, string>>
  /** Parsed `OTEL_TRACES_SAMPLER` name (default `parentbased_traceidratio`). */
  readonly sampler: TraceSampler
  /**
   * Effective head-sampling ratio in `[0,1]` — the fraction of requests to
   * sample — derived from `sampler` + `OTEL_TRACES_SAMPLER_ARG`. The request edge
   * applies this via `Effect.withTracerEnabled` (the ecoconception volume lever).
   */
  readonly sampleRatio: number
  /**
   * Optional span-batch flush interval (ms) from `OTEL_BSP_SCHEDULE_DELAY`, wired
   * to `OtlpTracer.layer({ exportInterval })`. Absent → the tracer's 5s default.
   */
  readonly scheduleDelayMs?: number
}

/** The resolved telemetry configuration — every field is absent when off. */
export interface TelemetryConfig {
  readonly errorReporting?: ErrorReportingConfig
  readonly performance?: PerformanceConfig
  readonly logExport?: LogExportConfig
  readonly metricsExport?: MetricsExportConfig
  readonly traces?: TracesConfig
}

/** Trim a value and treat empty (or unset) as "not provided". */
const clean = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim() ?? ''
  return trimmed === '' ? undefined : trimmed
}

/** Resolve the deployment environment: `SENTRY_ENVIRONMENT` → `NODE_ENV` → `development`. */
const resolveEnvironment = (env: EnvRecord): string =>
  clean(env['SENTRY_ENVIRONMENT']) ?? clean(env['NODE_ENV']) ?? 'development'

/** Drop a single trailing slash so `<base>` + `/v1/logs` never doubles up. */
const stripTrailingSlash = (value: string): string => value.replace(/\/+$/, '')

/** Best-effort host extraction for the banner — never throws on a bad URL. */
const safeHost = (rawUrl: string): string => {
  try {
    return new URL(rawUrl).hostname
  } catch {
    return rawUrl
  }
}

/**
 * Parse `OTEL_EXPORTER_OTLP_HEADERS` (`k=v,k2=v2`) into a header record.
 *
 * Splits each pair on the FIRST `=` only, so header values that themselves
 * contain `=` or spaces survive intact — e.g. `Authorization=Bearer <key>`
 * (the GlitchTip `/v1/logs` ingest auth) round-trips unchanged.
 */
const parseOtlpHeaders = (raw: string | undefined): Readonly<Record<string, string>> => {
  const cleaned = clean(raw)
  if (cleaned === undefined) return {}
  return cleaned.split(',').reduce<Record<string, string>>((acc, pair) => {
    const eq = pair.indexOf('=')
    if (eq <= 0) return acc
    const key = pair.slice(0, eq).trim()
    const value = pair.slice(eq + 1).trim()
    return key === '' ? acc : { ...acc, [key]: value }
  }, {})
}

/** Resolve the error-reporting signal (throws on a set-but-malformed DSN). */
const resolveErrorReporting = (
  env: EnvRecord,
  environment: string
): ErrorReportingConfig | undefined => {
  const rawDsn = clean(env['SENTRY_DSN'])
  if (rawDsn === undefined) return undefined
  return { dsn: parseDsnOrThrow(rawDsn), environment }
}

/** Parse the DSN, re-wrapping any failure so the message names `SENTRY_DSN`. */
const parseDsnOrThrow = (rawDsn: string): SentryDsn => {
  try {
    return parseSentryDsn(rawDsn)
  } catch (error) {
    // eslint-disable-next-line functional/no-throw-statements -- fail-loud: name SENTRY_DSN so the boot error is actionable
    throw new Error(
      `SENTRY_DSN is invalid: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

/**
 * Resolve the performance signal. A set-but-out-of-range rate throws (fail-loud,
 * regardless of DSN); a valid rate in `(0,1]` arms sampling only when a DSN is
 * present (transactions share the DSN ingest path); `0` or unset → off.
 */
const resolvePerformance = (env: EnvRecord, hasDsn: boolean): PerformanceConfig | undefined => {
  const raw = clean(env['SENTRY_TRACES_SAMPLE_RATE'])
  if (raw === undefined) return undefined
  const rate = Number(raw)
  if (Number.isNaN(rate) || rate < 0 || rate > 1) {
    // eslint-disable-next-line functional/no-throw-statements -- fail-loud: name the variable and its accepted range
    throw new Error(
      `SENTRY_TRACES_SAMPLE_RATE must be a number in (0,1] (0 disables), got: "${raw}"`
    )
  }
  return rate > 0 && hasDsn ? { sampleRate: rate } : undefined
}

/** Resolve the OTLP log-export signal (verbatim override wins over base + `/v1/logs`). */
const resolveLogExport = (env: EnvRecord, environment: string): LogExportConfig | undefined => {
  const override = clean(env['OTEL_EXPORTER_OTLP_LOGS_ENDPOINT'])
  const base = clean(env['OTEL_EXPORTER_OTLP_ENDPOINT'])
  const endpoint =
    override !== undefined
      ? override
      : base !== undefined
        ? `${stripTrailingSlash(base)}/v1/logs`
        : undefined
  if (endpoint === undefined) return undefined
  return {
    endpoint,
    serviceName: clean(env['OTEL_SERVICE_NAME']) ?? '',
    environment,
    headers: parseOtlpHeaders(env['OTEL_EXPORTER_OTLP_HEADERS']),
    host: safeHost(endpoint),
  }
}

/** Default metrics poll interval (ms) when `OTEL_METRIC_EXPORT_INTERVAL` is unset. */
const DEFAULT_METRIC_EXPORT_INTERVAL_MS = 10_000

/**
 * Resolve `OTEL_METRIC_EXPORT_INTERVAL` (ms). Unset → the 10s default; a
 * set-but-non-positive / non-numeric value throws (fail-loud, names the variable).
 * Only consulted when metrics export is armed (an OTLP endpoint is present).
 */
const resolveExportInterval = (env: EnvRecord): number => {
  const raw = clean(env['OTEL_METRIC_EXPORT_INTERVAL'])
  if (raw === undefined) return DEFAULT_METRIC_EXPORT_INTERVAL_MS
  const ms = Number(raw)
  if (Number.isNaN(ms) || ms <= 0) {
    // eslint-disable-next-line functional/no-throw-statements -- fail-loud: name the variable and its accepted range
    throw new Error(
      `OTEL_METRIC_EXPORT_INTERVAL must be a positive number of milliseconds, got: "${raw}"`
    )
  }
  return ms
}

/**
 * Resolve the OTLP metrics-export signal — armed ONLY by its own explicit
 * `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT`, taken verbatim.
 *
 * The base `OTEL_EXPORTER_OTLP_ENDPOINT` deliberately does NOT arm metrics. While
 * it did, metrics and logs shared one gate, so an operator could not turn metrics
 * off without also losing their logs — and GlitchTip, the backend Sovrium
 * actually ships against, mounts no `/v1/metrics` at all, so every deployment
 * pushed snapshots into a 404 on a fixed interval with no way to stop. Traces
 * already required their own endpoint; metrics now match, per the ecoconception
 * rule that nothing is emitted the operator did not ask for.
 *
 * The endpoint is used VERBATIM — no `/v1/metrics` is appended — matching
 * `OTEL_EXPORTER_OTLP_LOGS_ENDPOINT` and the OTel convention that a per-signal
 * variable is the full URL. (`OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` is treated as a
 * base by its own resolver; that asymmetry is deliberate and out of scope here.)
 */
const resolveMetricsExport = (
  env: EnvRecord,
  environment: string
): MetricsExportConfig | undefined => {
  const endpoint = clean(env['OTEL_EXPORTER_OTLP_METRICS_ENDPOINT'])
  if (endpoint === undefined) return undefined
  return {
    endpoint,
    serviceName: clean(env['OTEL_SERVICE_NAME']) ?? '',
    environment,
    headers: parseOtlpHeaders(env['OTEL_EXPORTER_OTLP_HEADERS']),
    host: safeHost(endpoint),
    exportIntervalMs: resolveExportInterval(env),
  }
}

/**
 * Resolve the full telemetry configuration from the environment. Throws on any
 * set-but-malformed gate value (bad DSN, out-of-range sample rate, non-positive
 * metric interval); every unset gate resolves to off.
 */
export const parseTelemetryConfig = (env: EnvRecord = process.env): TelemetryConfig => {
  const environment = resolveEnvironment(env)
  const errorReporting = resolveErrorReporting(env, environment)
  const performance = resolvePerformance(env, errorReporting !== undefined)
  const logExport = resolveLogExport(env, environment)
  const metricsExport = resolveMetricsExport(env, environment)
  const traces = resolveTraces(env, environment)

  return {
    ...(errorReporting ? { errorReporting } : {}),
    ...(performance ? { performance } : {}),
    ...(logExport ? { logExport } : {}),
    ...(metricsExport ? { metricsExport } : {}),
    ...(traces ? { traces } : {}),
  }
}

/** The OTel trace-sampler names Sovrium accepts (unknown → boot-abort). */
const KNOWN_TRACE_SAMPLERS: ReadonlySet<TraceSampler> = new Set<TraceSampler>([
  'always_on',
  'always_off',
  'traceidratio',
  'parentbased_always_on',
  'parentbased_always_off',
  'parentbased_traceidratio',
])

/** Default sampler when `OTEL_TRACES_SAMPLER` is unset (matches the OTel SDK default). */
const DEFAULT_TRACE_SAMPLER: TraceSampler = 'parentbased_traceidratio'

/**
 * LOW default sample ratio (ecoconception) applied when the sampler is
 * ratio-based and `OTEL_TRACES_SAMPLER_ARG` is unset. Traces stay default-OFF
 * until the endpoint is set, so this only bites once the operator arms traces.
 */
const DEFAULT_TRACE_SAMPLE_RATIO = 0.1

/** Resolve + validate `OTEL_TRACES_SAMPLER` (an unknown name aborts the boot). */
const resolveSamplerName = (env: EnvRecord): TraceSampler => {
  const raw = clean(env['OTEL_TRACES_SAMPLER'])
  if (raw === undefined) return DEFAULT_TRACE_SAMPLER
  if (!KNOWN_TRACE_SAMPLERS.has(raw as TraceSampler)) {
    // eslint-disable-next-line functional/no-throw-statements -- fail-loud: name the variable and its accepted values
    throw new Error(
      `OTEL_TRACES_SAMPLER must be one of ${[...KNOWN_TRACE_SAMPLERS].join(', ')}, got: "${raw}"`
    )
  }
  return raw as TraceSampler
}

/** Resolve + validate `OTEL_TRACES_SAMPLER_ARG` (a float in `[0,1]`; out-of-range → boot-abort). */
const resolveSamplerArg = (env: EnvRecord): number => {
  const raw = clean(env['OTEL_TRACES_SAMPLER_ARG'])
  if (raw === undefined) return DEFAULT_TRACE_SAMPLE_RATIO
  const ratio = Number(raw)
  if (Number.isNaN(ratio) || ratio < 0 || ratio > 1) {
    // eslint-disable-next-line functional/no-throw-statements -- fail-loud: name the variable and its accepted range
    throw new Error(`OTEL_TRACES_SAMPLER_ARG must be a number in [0,1], got: "${raw}"`)
  }
  return ratio
}

/** Collapse a sampler name + ratio arg into the effective head-sampling ratio in `[0,1]`. */
const effectiveSampleRatio = (sampler: TraceSampler, arg: number): number => {
  switch (sampler) {
    case 'always_on':
    case 'parentbased_always_on':
      return 1
    case 'always_off':
    case 'parentbased_always_off':
      return 0
    case 'traceidratio':
    case 'parentbased_traceidratio':
      return arg
  }
}

/**
 * Resolve the traces POST endpoint. `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` is
 * treated as a BASE — `/v1/traces` is appended (matching the metrics/logs base
 * handling and the [internal ref] `<endpoint>/v1/traces` contract) — UNLESS the
 * operator already supplied the full `/v1/traces` path, in which case it is used
 * verbatim (so a fully-qualified endpoint never doubles up).
 */
const resolveTracesEndpoint = (raw: string): string => {
  const stripped = stripTrailingSlash(raw)
  return stripped.endsWith('/v1/traces') ? stripped : `${stripped}/v1/traces`
}

/**
 * Resolve + validate `OTEL_BSP_SCHEDULE_DELAY` (ms). Unset → undefined (the
 * tracer's 5s default); a set-but-non-positive / non-numeric value aborts the
 * boot (fail-loud, mirroring `resolveExportInterval`).
 */
const resolveScheduleDelay = (env: EnvRecord): number | undefined => {
  const raw = clean(env['OTEL_BSP_SCHEDULE_DELAY'])
  if (raw === undefined) return undefined
  const ms = Number(raw)
  if (Number.isNaN(ms) || ms <= 0) {
    // eslint-disable-next-line functional/no-throw-statements -- fail-loud: name the variable and its accepted range
    throw new Error(
      `OTEL_BSP_SCHEDULE_DELAY must be a positive number of milliseconds, got: "${raw}"`
    )
  }
  return ms
}

/**
 * Resolve the OTel traces signal (armed only by an EXPLICIT
 * `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` — the base OTLP endpoint alone does NOT
 * arm traces). The sampler + flush knobs are validated only once traces are
 * armed; a set-but-malformed knob then aborts the boot loudly.
 */
const resolveTraces = (env: EnvRecord, environment: string): TracesConfig | undefined => {
  const rawEndpoint = clean(env['OTEL_EXPORTER_OTLP_TRACES_ENDPOINT'])
  if (rawEndpoint === undefined) return undefined
  const sampler = resolveSamplerName(env)
  const sampleRatio = effectiveSampleRatio(sampler, resolveSamplerArg(env))
  const scheduleDelayMs = resolveScheduleDelay(env)
  return {
    endpoint: resolveTracesEndpoint(rawEndpoint),
    serviceName: clean(env['OTEL_SERVICE_NAME']) ?? '',
    environment,
    headers: parseOtlpHeaders(env['OTEL_EXPORTER_OTLP_HEADERS']),
    sampler,
    sampleRatio,
    ...(scheduleDelayMs !== undefined ? { scheduleDelayMs } : {}),
  }
}

/** Whether the error-reporting signal is active. */
export const isErrorReportingEnabled = (config: TelemetryConfig): boolean =>
  config.errorReporting !== undefined

/** Whether the OTLP log-export signal is active. */
export const isLogExportEnabled = (config: TelemetryConfig): boolean =>
  config.logExport !== undefined

/** Whether the OTLP metrics-export signal is active. */
export const isMetricsExportEnabled = (config: TelemetryConfig): boolean =>
  config.metricsExport !== undefined

/** Whether the performance-transaction signal is active. */
export const isPerformanceEnabled = (config: TelemetryConfig): boolean =>
  config.performance !== undefined
