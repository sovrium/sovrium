/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Boot-time reachability probe for every armed telemetry destination
 *.
 *
 * Telemetry egress is fire-and-forget by construction: nothing downstream of the
 * export can fail the request that produced it. The cost of that design is that
 * an empty backend is AMBIGUOUS — "no traffic", "not configured", "wrong URL"
 * and "silently rejected" all look identical from the operator's side. Sovrium
 * exported into a dead endpoint for weeks on exactly that ambiguity: GlitchTip
 * 6.2.2 mounts no `/v1/traces` route, the upstream OTLP exporter retried three
 * times, dropped the batch, muted itself for 60 s, and reported the whole thing
 * through `Effect.logDebug` — filtered out, because production runs at `Info`.
 *
 * There is no seam to fix that inside the vendored exporter, so the signal is
 * produced at the boundary we own: once, at boot, POST a minimal well-formed
 * body to each armed destination and classify the answer. A 404/405 means the
 * route is not mounted and every future batch is going nowhere; a 401/403 means
 * the destination is reachable but will refuse us. Both are WARN, and both name
 * the exact environment variable the operator has to change — "export failed"
 * does not say which of the three OTLP endpoints is wrong.
 *
 * A 2xx, 400, 413 or 429 is silent: the route EXISTS, which is the only thing
 * this probe is qualified to assert. Note the direction of that guarantee — a
 * 2xx here is not confirmation that the payload was stored. GlitchTip's pydantic
 * models use the default `extra=ignore`, so unknown keys vanish without a word.
 * This probe distinguishes "nothing is listening" from "something is"; it does
 * not, and cannot, prove ingestion.
 *
 * Never blocks boot, never throws, ~1.5 s per destination.
 *
 * ## The error-reporting envelope endpoint is deliberately NOT probed
 *
 * Only the three OTLP destinations are probed, and that asymmetry is the point.
 * An OTLP probe POSTs an EMPTY batch — a collector accepts it and stores nothing
 * — whereas the smallest well-formed Sentry envelope is still an envelope:
 * ingested, and filed against the operator's own project on every single boot,
 * forever. A diagnostic that manufactures junk in the store it is diagnosing is
 * worse than no diagnostic.
 *
 * It would also buy nothing, because that path already reports itself:
 * `sendEnvelope` warns on any non-2xx answer, so a wrong DSN, a rejected key or
 * an unmounted envelope route surfaces on the first REAL envelope — carrying the
 * actual response body, which is strictly more than this probe could say. Do not
 * re-add it.
 *
 * ## Probe requests are marked
 *
 * Every request this module issues carries `x-sovrium-telemetry-probe: 1` so a
 * receiver can tell a boot probe from real traffic. The E2E collectors
 * drop marked requests rather than recording
 * them: a probe is not an export, and specs that count exports must not see it.
 */

import { getTelemetryConfig } from './telemetry-config'
import type { TelemetryConfig } from '@/domain/models/process-env/telemetry/telemetry'

/** Per-destination budget. Short enough that a black-holed host cannot stall boot. */
const PROBE_TIMEOUT_MS = 1500

/** A single armed destination to probe. */
export interface ProbeTarget {
  /** The environment variable the operator must change to fix this destination. */
  readonly envVar: string
  /** The exact URL the export path POSTs to. */
  readonly url: string
  /** What is lost when this destination refuses — "spans", "log records", … */
  readonly noun: string
  /** Headers the real export path sends, so auth is probed as configured. */
  readonly headers: Readonly<Record<string, string>>
  /** A minimal, well-formed, data-free body for this signal's wire format. */
  readonly body: string
}

/** What came back from a probe attempt. */
export type ProbeOutcome =
  | { readonly kind: 'status'; readonly status: number }
  | { readonly kind: 'unreachable'; readonly detail: string }

/** What the operator should be told, if anything. */
export type ProbeVerdict =
  { readonly level: 'silent' } | { readonly level: 'warn'; readonly message: string }

/**
 * The one capability this module needs from `fetch`, declared structurally
 * rather than as `typeof fetch`. The global type carries runtime-specific extras
 * (Bun adds `preconnect`), so requiring it would force every test stub through a
 * cast — a cast that would also hide a genuine signature drift.
 */
export type FetchLike = (input: string, init?: Readonly<RequestInit>) => Promise<Response>

/** Injectable seams so the probe is testable without a network. */
export interface ProbeDeps {
  readonly fetchImpl: FetchLike
  readonly log: (message: string) => void
  readonly timeoutMs?: number
}

const SILENT: ProbeVerdict = { level: 'silent' }

const warn = (message: string): ProbeVerdict => ({ level: 'warn', message })

/**
 * Decide what a probe answer means. PURE — no network, no clock, no logging —
 * so the whole classification table is a unit test.
 *
 * Anything not named below is silent on purpose. A 500 from the collector still
 * proves the route is mounted, and a boot-time WARN for a transient backend
 * hiccup trains operators to ignore the line that matters.
 */
export const classifyProbeResult = (
  target: Pick<ProbeTarget, 'envVar' | 'url' | 'noun'>,
  outcome: ProbeOutcome
): ProbeVerdict => {
  if (outcome.kind === 'unreachable') {
    return warn(
      `${target.envVar} could not be reached at ${target.url} (${outcome.detail}) — ` +
        `${target.noun} will be discarded silently.`
    )
  }
  if (outcome.status === 404 || outcome.status === 405) {
    return warn(
      `${target.envVar} points at an endpoint that is not mounted (${outcome.status}) — ` +
        `${target.noun} will be discarded silently. URL: ${target.url}`
    )
  }
  if (outcome.status === 401 || outcome.status === 403) {
    return warn(
      `${target.envVar} reached ${target.url} but the credentials were rejected ` +
        `(${outcome.status}) — ${target.noun} will be discarded silently.`
    )
  }
  return SILENT
}

/**
 * Which variable supplied an OTLP endpoint. The signal-specific override wins
 * when set; otherwise the base variable derived it. Naming the wrong one sends
 * the operator to edit a variable that is not in play.
 */
const otlpEnvVar = (
  env: Readonly<Record<string, string | undefined>>,
  overrideVar: string
): string => (env[overrideVar]?.trim() ? overrideVar : 'OTEL_EXPORTER_OTLP_ENDPOINT')

/**
 * Marks a request as a boot probe rather than an export. Receivers that keep a
 * record of what arrived — the E2E collectors in `[internal ref]` —
 * drop anything carrying it, so a probe can never be miscounted as real traffic.
 * The name is namespaced because this is Sovrium's own convention, not OTLP's.
 */
export const PROBE_MARKER_HEADER = 'x-sovrium-telemetry-probe'

const PROBE_HEADERS: Readonly<Record<string, string>> = { [PROBE_MARKER_HEADER]: '1' }

const OTLP_HEADERS: Readonly<Record<string, string>> = { 'content-type': 'application/json' }

/** One OTLP destination, with the JSON content-type every signal shares. */
const otlpProbe = (spec: {
  readonly envVar: string
  readonly endpoint: string
  readonly headers: Readonly<Record<string, string>>
  readonly noun: string
  readonly body: string
}): ProbeTarget => ({
  envVar: spec.envVar,
  url: spec.endpoint,
  noun: spec.noun,
  // The probe marker goes LAST: a configured header must never be able to
  // unmark a probe request and let it be recorded as an export.
  headers: { ...OTLP_HEADERS, ...spec.headers, ...PROBE_HEADERS },
  body: spec.body,
})

const logsTarget = (
  config: TelemetryConfig,
  env: Readonly<Record<string, string | undefined>>
): readonly ProbeTarget[] =>
  config.logExport === undefined
    ? []
    : [
        otlpProbe({
          envVar: otlpEnvVar(env, 'OTEL_EXPORTER_OTLP_LOGS_ENDPOINT'),
          endpoint: config.logExport.endpoint,
          headers: config.logExport.headers,
          noun: 'log records',
          body: '{"resourceLogs":[]}',
        }),
      ]

const metricsTarget = (config: TelemetryConfig): readonly ProbeTarget[] =>
  config.metricsExport === undefined
    ? []
    : [
        otlpProbe({
          // Metrics have exactly one gate: the base OTLP variable never
          // arms them, so there is no override/base ambiguity to resolve here.
          envVar: 'OTEL_EXPORTER_OTLP_METRICS_ENDPOINT',
          endpoint: config.metricsExport.endpoint,
          headers: config.metricsExport.headers,
          noun: 'metrics',
          body: '{"resourceMetrics":[]}',
        }),
      ]

const tracesTarget = (config: TelemetryConfig): readonly ProbeTarget[] =>
  config.traces === undefined
    ? []
    : [
        otlpProbe({
          // Traces have exactly one gate: the base OTLP variable never arms them,
          // so there is no override/base ambiguity to resolve here.
          envVar: 'OTEL_EXPORTER_OTLP_TRACES_ENDPOINT',
          endpoint: config.traces.endpoint,
          headers: config.traces.headers,
          noun: 'spans',
          body: '{"resourceSpans":[]}',
        }),
      ]

/**
 * Build the probe list from the resolved config. Only ARMED destinations appear:
 * a disabled signal has nothing to be wrong about.
 *
 * `config.errorReporting` is armed-but-unprobed by design — see the module
 * docstring. Every target here POSTs an empty batch and stores nothing.
 */
export const buildProbeTargets = (
  config: TelemetryConfig,
  env: Readonly<Record<string, string | undefined>>
): readonly ProbeTarget[] => [
  ...logsTarget(config, env),
  ...metricsTarget(config),
  ...tracesTarget(config),
]

const attempt = async (target: ProbeTarget, deps: ProbeDeps): Promise<ProbeOutcome> => {
  try {
    const response = await deps.fetchImpl(target.url, {
      method: 'POST',
      headers: { ...target.headers },
      body: target.body,
      signal: AbortSignal.timeout(deps.timeoutMs ?? PROBE_TIMEOUT_MS),
    })
    return { kind: 'status', status: response.status }
  } catch (error) {
    return { kind: 'unreachable', detail: error instanceof Error ? error.message : String(error) }
  }
}

const probeOne = async (target: ProbeTarget, deps: ProbeDeps): Promise<void> => {
  const verdict = classifyProbeResult(target, await attempt(target, deps))
  if (verdict.level === 'warn') {
    deps.log(verdict.message)
  }
}

/** Probe every target concurrently. Always resolves; a failure is a WARN, not a throw. */
export const runTelemetryProbes = async (
  targets: readonly ProbeTarget[],
  deps: ProbeDeps
): Promise<void> => {
  // eslint-disable-next-line functional/no-expression-statements -- await the concurrent probe fan-out
  await Promise.all(targets.map((target) => probeOne(target, deps)))
}

/**
 * Fire-and-forget boot entry point, called once from `activateTelemetry`.
 * Returns immediately; the probes resolve in the background and can only ever
 * produce a WARN line.
 */
export const probeTelemetryEndpoints = (options: {
  readonly log: (message: string) => void
}): void => {
  try {
    const targets = buildProbeTargets(getTelemetryConfig(), process.env)
    if (targets.length === 0) return
    // eslint-disable-next-line functional/no-expression-statements -- fire-and-forget: boot must not wait on egress
    void runTelemetryProbes(targets, { fetchImpl: fetch, log: options.log }).catch(() => undefined)
  } catch {
    // A probe that cannot even be built must not be the thing that stops a boot.
  }
}
