/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { parseSentryDsn, type SentryDsn } from './sentry-dsn'

type EnvRecord = Readonly<Record<string, string | undefined>>

export interface ErrorReportingConfig {
  readonly dsn: SentryDsn
  readonly environment: string
}

export interface PerformanceConfig {
  readonly sampleRate: number
}

export interface LogExportConfig {
  readonly endpoint: string
  readonly serviceName: string
  readonly environment: string
  readonly headers: Readonly<Record<string, string>>
  readonly host: string
}

export interface MetricsExportConfig {
  readonly endpoint: string
  readonly serviceName: string
  readonly environment: string
  readonly headers: Readonly<Record<string, string>>
  readonly host: string
  readonly exportIntervalMs: number
}

export type TraceSampler =
  | 'always_on'
  | 'always_off'
  | 'traceidratio'
  | 'parentbased_always_on'
  | 'parentbased_always_off'
  | 'parentbased_traceidratio'

export interface TracesConfig {
  readonly endpoint: string
  readonly serviceName: string
  readonly environment: string
  readonly headers: Readonly<Record<string, string>>
  readonly sampler: TraceSampler
  readonly sampleRatio: number
  readonly scheduleDelayMs?: number
}

export interface TelemetryConfig {
  readonly errorReporting?: ErrorReportingConfig
  readonly performance?: PerformanceConfig
  readonly logExport?: LogExportConfig
  readonly metricsExport?: MetricsExportConfig
  readonly traces?: TracesConfig
}

const clean = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim() ?? ''
  return trimmed === '' ? undefined : trimmed
}

const resolveEnvironment = (env: EnvRecord): string =>
  clean(env['SENTRY_ENVIRONMENT']) ?? clean(env['NODE_ENV']) ?? 'development'

const stripTrailingSlash = (value: string): string => value.replace(/\/+$/, '')

const safeHost = (rawUrl: string): string => {
  try {
    return new URL(rawUrl).hostname
  } catch {
    return rawUrl
  }
}

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

const resolveErrorReporting = (
  env: EnvRecord,
  environment: string
): ErrorReportingConfig | undefined => {
  const rawDsn = clean(env['SENTRY_DSN'])
  if (rawDsn === undefined) return undefined
  return { dsn: parseDsnOrThrow(rawDsn), environment }
}

const parseDsnOrThrow = (rawDsn: string): SentryDsn => {
  try {
    return parseSentryDsn(rawDsn)
  } catch (error) {
    throw new Error(
      `SENTRY_DSN is invalid: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

const resolvePerformance = (env: EnvRecord, hasDsn: boolean): PerformanceConfig | undefined => {
  const raw = clean(env['SENTRY_TRACES_SAMPLE_RATE'])
  if (raw === undefined) return undefined
  const rate = Number(raw)
  if (Number.isNaN(rate) || rate < 0 || rate > 1) {
    throw new Error(
      `SENTRY_TRACES_SAMPLE_RATE must be a number in (0,1] (0 disables), got: "${raw}"`
    )
  }
  return rate > 0 && hasDsn ? { sampleRate: rate } : undefined
}

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

const DEFAULT_METRIC_EXPORT_INTERVAL_MS = 10_000

const resolveExportInterval = (env: EnvRecord): number => {
  const raw = clean(env['OTEL_METRIC_EXPORT_INTERVAL'])
  if (raw === undefined) return DEFAULT_METRIC_EXPORT_INTERVAL_MS
  const ms = Number(raw)
  if (Number.isNaN(ms) || ms <= 0) {
    throw new Error(
      `OTEL_METRIC_EXPORT_INTERVAL must be a positive number of milliseconds, got: "${raw}"`
    )
  }
  return ms
}

const resolveMetricsExport = (
  env: EnvRecord,
  environment: string
): MetricsExportConfig | undefined => {
  const override = clean(env['OTEL_EXPORTER_OTLP_METRICS_ENDPOINT'])
  const base = clean(env['OTEL_EXPORTER_OTLP_ENDPOINT'])
  const endpoint =
    override !== undefined
      ? override
      : base !== undefined
        ? `${stripTrailingSlash(base)}/v1/metrics`
        : undefined
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

const KNOWN_TRACE_SAMPLERS: ReadonlySet<TraceSampler> = new Set<TraceSampler>([
  'always_on',
  'always_off',
  'traceidratio',
  'parentbased_always_on',
  'parentbased_always_off',
  'parentbased_traceidratio',
])

const DEFAULT_TRACE_SAMPLER: TraceSampler = 'parentbased_traceidratio'

const DEFAULT_TRACE_SAMPLE_RATIO = 0.1

const resolveSamplerName = (env: EnvRecord): TraceSampler => {
  const raw = clean(env['OTEL_TRACES_SAMPLER'])
  if (raw === undefined) return DEFAULT_TRACE_SAMPLER
  if (!KNOWN_TRACE_SAMPLERS.has(raw as TraceSampler)) {
    throw new Error(
      `OTEL_TRACES_SAMPLER must be one of ${[...KNOWN_TRACE_SAMPLERS].join(', ')}, got: "${raw}"`
    )
  }
  return raw as TraceSampler
}

const resolveSamplerArg = (env: EnvRecord): number => {
  const raw = clean(env['OTEL_TRACES_SAMPLER_ARG'])
  if (raw === undefined) return DEFAULT_TRACE_SAMPLE_RATIO
  const ratio = Number(raw)
  if (Number.isNaN(ratio) || ratio < 0 || ratio > 1) {
    throw new Error(`OTEL_TRACES_SAMPLER_ARG must be a number in [0,1], got: "${raw}"`)
  }
  return ratio
}

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

const resolveTracesEndpoint = (raw: string): string => {
  const stripped = stripTrailingSlash(raw)
  return stripped.endsWith('/v1/traces') ? stripped : `${stripped}/v1/traces`
}

const resolveScheduleDelay = (env: EnvRecord): number | undefined => {
  const raw = clean(env['OTEL_BSP_SCHEDULE_DELAY'])
  if (raw === undefined) return undefined
  const ms = Number(raw)
  if (Number.isNaN(ms) || ms <= 0) {
    throw new Error(
      `OTEL_BSP_SCHEDULE_DELAY must be a positive number of milliseconds, got: "${raw}"`
    )
  }
  return ms
}

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

export const isErrorReportingEnabled = (config: TelemetryConfig): boolean =>
  config.errorReporting !== undefined

export const isLogExportEnabled = (config: TelemetryConfig): boolean =>
  config.logExport !== undefined

export const isMetricsExportEnabled = (config: TelemetryConfig): boolean =>
  config.metricsExport !== undefined

export const isPerformanceEnabled = (config: TelemetryConfig): boolean =>
  config.performance !== undefined
