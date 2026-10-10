/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Result, Schema } from 'effect'
import type { RendererConfig } from './renderer'

/**
 * Browser automation environment configuration ([internal ref] D1, D2).
 *
 * A `browser/run` step drives a real browser the operator provides: a local
 * Chrome, Chromium or Edge it spawns (`BROWSER_CHROME_PATH`, or the one found
 * on the machine), a running Chrome it connects to (`BROWSER_CDP_URL`), or —
 * in the desktop app on macOS only — the system WebKit. It is OFF on a server
 * until the operator says otherwise; the desktop app switches it on.
 *
 * Env vars: BROWSER_PROVIDER, BROWSER_BACKEND, BROWSER_CHROME_PATH,
 *           BROWSER_CDP_URL, BROWSER_STEP_TIMEOUT_MS, BROWSER_RUN_TIMEOUT_MS,
 *           BROWSER_CONCURRENCY, BROWSER_HOLD_MAX_MS,
 *           BROWSER_ARTIFACT_RETENTION_DAYS, BROWSER_NO_SANDBOX,
 *           SOVRIUM_INSTALL_METHOD (the desktop marker)
 */

/** Recognised `BROWSER_PROVIDER` values. */
export const SUPPORTED_BROWSER_PROVIDERS = ['webview', 'off'] as const

/** Recognised `BROWSER_BACKEND` values. */
export const SUPPORTED_BROWSER_BACKENDS = ['auto', 'webkit', 'chrome'] as const

export type BrowserProvider = (typeof SUPPORTED_BROWSER_PROVIDERS)[number]
export type BrowserBackend = (typeof SUPPORTED_BROWSER_BACKENDS)[number]

/** Ceiling per step. */
export const DEFAULT_BROWSER_STEP_TIMEOUT_MS = 15_000
/** Ceiling per run, the wait for a confirmation excluded. */
export const DEFAULT_BROWSER_RUN_TIMEOUT_MS = 300_000
/** Browser sessions in flight per process. */
export const DEFAULT_BROWSER_CONCURRENCY = 1
/** How long a run waiting for a confirmation keeps its browser open. */
export const DEFAULT_BROWSER_HOLD_MAX_MS = 600_000
/** Days screenshots and traces are kept. */
export const DEFAULT_BROWSER_ARTIFACT_RETENTION_DAYS = 30

/** The longest deadline a JavaScript timer can hold (2^31 - 1 ms). */
const MAX_TIMER_MS = 2_147_483_647

const PositiveIntFromString = Schema.FiniteFromString.pipe(
  Schema.check(Schema.isInt(), Schema.isGreaterThan(0))
)

const TimerFromString = PositiveIntFromString.pipe(
  Schema.check(Schema.isLessThanOrEqualTo(MAX_TIMER_MS))
)

/** The spellings `BROWSER_NO_SANDBOX` accepts; the first three turn the sandbox off. */
const NO_SANDBOX_VALUES = ['1', 'true', 'TRUE', '0', 'false', 'FALSE'] as const

const NO_SANDBOX_ON: ReadonlySet<string> = new Set(NO_SANDBOX_VALUES.slice(0, 3))

/** The raw `BROWSER_*` variables, decoded. Every key is optional. */
export const BrowserEnvSchema = Schema.Struct({
  provider: Schema.optional(Schema.Literals(SUPPORTED_BROWSER_PROVIDERS)),
  backend: Schema.optional(Schema.Literals(SUPPORTED_BROWSER_BACKENDS)),
  chromePath: Schema.optional(Schema.String.pipe(Schema.check(Schema.isMinLength(1)))),
  cdpUrl: Schema.optional(
    Schema.String.pipe(Schema.check(Schema.isPattern(/^(?:https?|wss?):\/\/[^/\s]+/)))
  ),
  stepTimeoutMs: Schema.optional(TimerFromString),
  runTimeoutMs: Schema.optional(TimerFromString),
  concurrency: Schema.optional(PositiveIntFromString),
  holdMaxMs: Schema.optional(TimerFromString),
  artifactRetentionDays: Schema.optional(PositiveIntFromString),
  noSandbox: Schema.optional(Schema.Literals(NO_SANDBOX_VALUES)),
})

/** The `BROWSER_*` configuration, every default applied. */
export interface BrowserConfig {
  readonly provider: BrowserProvider
  /** `true` when `BROWSER_PROVIDER` was not set and the default applied. */
  readonly providerDefaulted: boolean
  readonly backend: BrowserBackend
  readonly chromePath?: string
  readonly cdpUrl?: string
  readonly stepTimeoutMs: number
  readonly runTimeoutMs: number
  readonly concurrency: number
  readonly holdMaxMs: number
  readonly artifactRetentionDays: number
  /** `BROWSER_NO_SANDBOX` set to a true value. Absent otherwise: the sandbox stays on. */
  readonly noSandbox?: true
  /** The engine runs under the desktop app (`SOVRIUM_INSTALL_METHOD=desktop`). */
  readonly desktop: boolean
}

export type BrowserEnvParse =
  | { readonly ok: true; readonly config: BrowserConfig }
  | { readonly ok: false; readonly error: string }

const blankToUndefined = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim()
  return trimmed === undefined || trimmed === '' ? undefined : trimmed
}

/** Whether the engine runs inside the desktop app: the marker its shell sets, and nothing else. */
export const isDesktopEnv = (env: Readonly<Record<string, string | undefined>>): boolean =>
  blankToUndefined(env['SOVRIUM_INSTALL_METHOD']) === 'desktop'

const describeInvalidEnv = (env: Readonly<Record<string, string | undefined>>): string => {
  const provider = blankToUndefined(env['BROWSER_PROVIDER'])
  if (
    provider !== undefined &&
    !(SUPPORTED_BROWSER_PROVIDERS as readonly string[]).includes(provider)
  ) {
    return `BROWSER_PROVIDER=${provider} is not supported. Supported: ${SUPPORTED_BROWSER_PROVIDERS.join(', ')}.`
  }
  const backend = blankToUndefined(env['BROWSER_BACKEND'])
  if (
    backend !== undefined &&
    !(SUPPORTED_BROWSER_BACKENDS as readonly string[]).includes(backend)
  ) {
    return `BROWSER_BACKEND=${backend} is not supported. Supported: ${SUPPORTED_BROWSER_BACKENDS.join(', ')}.`
  }
  return 'The BROWSER_* variables are invalid: BROWSER_CDP_URL must be an http(s) or ws(s) URL; BROWSER_STEP_TIMEOUT_MS, BROWSER_RUN_TIMEOUT_MS and BROWSER_HOLD_MAX_MS positive integers of at most 2147483647; BROWSER_CONCURRENCY and BROWSER_ARTIFACT_RETENTION_DAYS positive integers; and BROWSER_NO_SANDBOX 1, true, 0 or false.'
}

/** The limits, every default applied. */
const limitsWithDefaults = (raw: typeof BrowserEnvSchema.Type) => ({
  stepTimeoutMs: raw.stepTimeoutMs ?? DEFAULT_BROWSER_STEP_TIMEOUT_MS,
  runTimeoutMs: raw.runTimeoutMs ?? DEFAULT_BROWSER_RUN_TIMEOUT_MS,
  concurrency: raw.concurrency ?? DEFAULT_BROWSER_CONCURRENCY,
  holdMaxMs: raw.holdMaxMs ?? DEFAULT_BROWSER_HOLD_MAX_MS,
  artifactRetentionDays: raw.artifactRetentionDays ?? DEFAULT_BROWSER_ARTIFACT_RETENTION_DAYS,
})

const withDefaults = (raw: typeof BrowserEnvSchema.Type, desktop: boolean): BrowserConfig => ({
  // Off on a server unless the operator says otherwise; the desktop app turns it on (Q1).
  provider: raw.provider ?? (desktop ? 'webview' : 'off'),
  providerDefaulted: raw.provider === undefined,
  backend: raw.backend ?? 'auto',
  ...(raw.chromePath === undefined ? {} : { chromePath: raw.chromePath }),
  ...(raw.cdpUrl === undefined ? {} : { cdpUrl: raw.cdpUrl }),
  ...limitsWithDefaults(raw),
  ...(NO_SANDBOX_ON.has(raw.noSandbox ?? '') ? { noSandbox: true as const } : {}),
  desktop,
})

/**
 * Read the `BROWSER_*` variables from an env snapshot. Total: an invalid value
 * is `{ ok: false }` with an operator-facing reason naming the variable.
 */
export const parseBrowserEnv = (
  env: Readonly<Record<string, string | undefined>>
): BrowserEnvParse => {
  const decoded = Schema.decodeUnknownResult(BrowserEnvSchema)({
    provider: blankToUndefined(env['BROWSER_PROVIDER']),
    backend: blankToUndefined(env['BROWSER_BACKEND']),
    chromePath: blankToUndefined(env['BROWSER_CHROME_PATH']),
    cdpUrl: blankToUndefined(env['BROWSER_CDP_URL']),
    stepTimeoutMs: blankToUndefined(env['BROWSER_STEP_TIMEOUT_MS']),
    runTimeoutMs: blankToUndefined(env['BROWSER_RUN_TIMEOUT_MS']),
    concurrency: blankToUndefined(env['BROWSER_CONCURRENCY']),
    holdMaxMs: blankToUndefined(env['BROWSER_HOLD_MAX_MS']),
    artifactRetentionDays: blankToUndefined(env['BROWSER_ARTIFACT_RETENTION_DAYS']),
    noSandbox: blankToUndefined(env['BROWSER_NO_SANDBOX']),
  })
  if (Result.isFailure(decoded)) return { ok: false, error: describeInvalidEnv(env) }
  return { ok: true, config: withDefaults(decoded.success, isDesktopEnv(env)) }
}

/** `browser_config_conflict: …`, naming the variables involved. */
const conflict = (detail: string): string => `browser_config_conflict: ${detail}`

/** Whether the document renderer may start a Chrome of its own in this process. */
const rendererUsesChrome = (renderer: RendererConfig | undefined): boolean =>
  renderer !== undefined && renderer.provider !== 'off' && renderer.provider !== 'gotenberg'

/** The renderer's path and address conflicts with the browser's, or `undefined`. */
const rendererConflict = (
  config: BrowserConfig,
  renderer: RendererConfig | undefined
): string | undefined => {
  if (renderer === undefined) return undefined
  if (
    config.chromePath !== undefined &&
    renderer.chromePath !== undefined &&
    config.chromePath !== renderer.chromePath
  ) {
    return conflict(
      'BROWSER_CHROME_PATH and RENDERER_CHROME_PATH name different executables. One Chrome serves the whole process, so whichever starts first would silently decide for both: set them to the same path, or leave one unset.'
    )
  }
  if (
    config.cdpUrl !== undefined &&
    renderer.cdpUrl !== undefined &&
    config.cdpUrl !== renderer.cdpUrl
  ) {
    return conflict(
      'BROWSER_CDP_URL and RENDERER_CDP_URL name different browsers. One Chrome serves the whole process: point both at the same one, or run the renderer and the browser in two processes.'
    )
  }
  if (
    rendererUsesChrome(renderer) &&
    (config.noSandbox === true) !== (renderer.noSandbox === true)
  ) {
    return conflict(
      'BROWSER_NO_SANDBOX and RENDERER_NO_SANDBOX disagree. One Chrome serves the whole process, started with or without its sandbox once for both: give the two variables the same value.'
    )
  }
  return undefined
}

/**
 * Why the boot is refused for the `BROWSER_*` configuration ([internal ref] D1, D2,
 * D10), or `undefined`. Only an enabled browser is checked: `off` needs nothing.
 */
export const browserBootRefusal = (input: {
  readonly config: BrowserConfig
  readonly renderer: RendererConfig | undefined
  readonly platform: string
}): string | undefined => {
  const { config, renderer, platform } = input
  if (config.provider === 'off') return undefined
  if (config.backend === 'webkit' && (!config.desktop || platform !== 'darwin')) {
    return `browser_backend_refused: BROWSER_BACKEND=webkit is allowed only in the desktop app on macOS, where the browser acts for the person on their own machine. WebKit cannot hold a page to allowedHosts, so a server must use BROWSER_BACKEND=chrome (or auto).`
  }
  if (config.chromePath !== undefined && config.cdpUrl !== undefined) {
    return conflict(
      'BROWSER_CHROME_PATH and BROWSER_CDP_URL are both set: set BROWSER_CHROME_PATH to spawn a local Chrome, or BROWSER_CDP_URL to connect to a running one, not both.'
    )
  }
  if (config.concurrency > 1 && config.backend !== 'webkit') {
    return conflict(
      `BROWSER_CONCURRENCY=${String(config.concurrency)} with Chrome: every Chrome session shares one cookie jar, so browser runs take turns. Set BROWSER_CONCURRENCY=1.`
    )
  }
  return rendererConflict(config, renderer)
}

/** The message a browser step fails with when no browser is configured. */
export const browserUnavailableMessage = (config: BrowserConfig): string =>
  config.providerDefaulted
    ? 'browser_unavailable: browser automation is off on this server. Set BROWSER_PROVIDER=webview (with BROWSER_CHROME_PATH or BROWSER_CDP_URL when no Chrome is installed) to let automations drive a browser.'
    : 'browser_unavailable: browser automation is switched off (BROWSER_PROVIDER=off). Set BROWSER_PROVIDER=webview to let automations drive a browser.'

/** The screenshot retention in days, the default when the variable is unset or invalid. */
export const browserArtifactRetentionDays = (
  env: Readonly<Record<string, string | undefined>>
): number => {
  const parsed = parseBrowserEnv(env)
  return parsed.ok ? parsed.config.artifactRetentionDays : DEFAULT_BROWSER_ARTIFACT_RETENTION_DAYS
}
