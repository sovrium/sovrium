/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Result, Schema } from 'effect'

/**
 * Document renderer environment configuration ([internal ref] D2).
 *
 * HTML → PDF / image needs a real browser, which cannot live inside the
 * compiled binary. The operator points Sovrium at one: a local Chrome it spawns
 * (`RENDERER_CHROME_PATH`), a running Chrome it connects to (`RENDERER_CDP_URL`),
 * or a Gotenberg server (`RENDERER_PROVIDER=gotenberg` + `RENDERER_URL`).
 *
 * Env vars: RENDERER_PROVIDER, RENDERER_CHROME_PATH, RENDERER_CDP_URL,
 *           RENDERER_URL, RENDERER_TIMEOUT_MS, RENDERER_MAX_PAGES,
 *           RENDERER_MAX_OUTPUT_BYTES, RENDERER_CONCURRENCY, RENDERER_NO_SANDBOX
 */

/** Recognised `RENDERER_PROVIDER` values, in the order an error message lists them. */
export const SUPPORTED_RENDERER_PROVIDERS = ['webview', 'puppeteer', 'gotenberg', 'off'] as const

export type RendererProvider = (typeof SUPPORTED_RENDERER_PROVIDERS)[number]

/** Per-render ceiling, navigation through the print or the screenshot. */
export const DEFAULT_RENDERER_TIMEOUT_MS = 30_000

/** A PDF above this page count is refused. */
export const DEFAULT_RENDERER_MAX_PAGES = 200

/** An output above this size is refused (50 MB). */
export const DEFAULT_RENDERER_MAX_OUTPUT_BYTES = 52_428_800

/** Renders in flight per process; the rest queue. */
export const DEFAULT_RENDERER_CONCURRENCY = 2

/** The longest deadline a JavaScript timer can hold (2^31 - 1 ms). */
const MAX_TIMER_MS = 2_147_483_647

const PositiveIntFromString = Schema.FiniteFromString.pipe(
  Schema.check(Schema.isInt(), Schema.isGreaterThan(0))
)

/** The spellings `RENDERER_NO_SANDBOX` accepts; the first three turn the sandbox off. */
const NO_SANDBOX_VALUES = ['1', 'true', 'TRUE', '0', 'false', 'FALSE'] as const

const NO_SANDBOX_ON: ReadonlySet<string> = new Set(NO_SANDBOX_VALUES.slice(0, 3))

const NonEmptyString = Schema.String.pipe(Schema.check(Schema.isMinLength(1)))

/** The raw `RENDERER_*` variables, decoded. Every key is optional. */
export const RendererEnvSchema = Schema.Struct({
  provider: Schema.optional(
    Schema.Literals(SUPPORTED_RENDERER_PROVIDERS).annotate({
      description: 'HTML renderer (RENDERER_PROVIDER); unset picks webview when a Chrome is found',
    })
  ),
  chromePath: Schema.optional(
    NonEmptyString.annotate({ description: 'Chrome executable to spawn (RENDERER_CHROME_PATH)' })
  ),
  cdpUrl: Schema.optional(
    Schema.String.annotate({
      description: 'DevTools address of a running Chrome (RENDERER_CDP_URL)',
      examples: ['http://renderer:9222', 'ws://127.0.0.1:9222/devtools/browser/<id>'],
    }).pipe(Schema.check(Schema.isPattern(/^(?:https?|wss?):\/\/[^/\s]+/)))
  ),
  gotenbergUrl: Schema.optional(
    Schema.String.annotate({ description: 'Gotenberg base URL (RENDERER_URL)' }).pipe(
      Schema.check(Schema.isPattern(/^https?:\/\/[^/\s]+/))
    )
  ),
  timeoutMs: Schema.optional(
    PositiveIntFromString.annotate({
      description: 'Per-render ceiling (RENDERER_TIMEOUT_MS)',
    }).pipe(Schema.check(Schema.isLessThanOrEqualTo(MAX_TIMER_MS)))
  ),
  maxPages: Schema.optional(
    PositiveIntFromString.annotate({ description: 'Largest PDF page count (RENDERER_MAX_PAGES)' })
  ),
  maxOutputBytes: Schema.optional(
    PositiveIntFromString.annotate({
      description: 'Largest output in bytes (RENDERER_MAX_OUTPUT_BYTES)',
    })
  ),
  concurrency: Schema.optional(
    PositiveIntFromString.annotate({ description: 'Renders in flight (RENDERER_CONCURRENCY)' })
  ),
  noSandbox: Schema.optional(
    Schema.Literals(NO_SANDBOX_VALUES).annotate({
      description:
        'Start the spawned Chrome without its own sandbox (RENDERER_NO_SANDBOX), for hosts where it cannot create one',
    })
  ),
})

/** The `RENDERER_*` configuration, every default applied. */
export interface RendererConfig {
  /** `undefined` = not set: webview when a Chrome is found, else off. */
  readonly provider: RendererProvider | undefined
  readonly chromePath?: string
  readonly cdpUrl?: string
  /** `RENDERER_URL`, falling back to `OFFICE_URL`. */
  readonly gotenbergUrl?: string
  readonly timeoutMs: number
  readonly maxPages: number
  readonly maxOutputBytes: number
  readonly concurrency: number
  /**
   * `RENDERER_NO_SANDBOX` set to a true value: the Chrome Sovrium spawns runs
   * without its own sandbox. Absent otherwise — the sandbox stays on.
   */
  readonly noSandbox?: true
}

export type RendererEnvParse =
  | { readonly ok: true; readonly config: RendererConfig }
  | { readonly ok: false; readonly error: string }

const blankToUndefined = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim()
  return trimmed === undefined || trimmed === '' ? undefined : trimmed
}

const describeInvalidEnv = (env: Readonly<Record<string, string | undefined>>): string => {
  const provider = blankToUndefined(env['RENDERER_PROVIDER'])
  if (
    provider !== undefined &&
    !(SUPPORTED_RENDERER_PROVIDERS as readonly string[]).includes(provider)
  ) {
    return `RENDERER_PROVIDER=${provider} is not a supported renderer. Supported: ${SUPPORTED_RENDERER_PROVIDERS.join(', ')}.`
  }
  return 'The RENDERER_* variables are invalid: RENDERER_CDP_URL must be an http(s) or ws(s) URL, RENDERER_URL an http(s) URL, and RENDERER_TIMEOUT_MS (at most 2147483647), RENDERER_MAX_PAGES, RENDERER_MAX_OUTPUT_BYTES and RENDERER_CONCURRENCY positive integers, and RENDERER_NO_SANDBOX 1, true, 0 or false.'
}

/** The decoded variables with every default applied. */
const withDefaults = (raw: typeof RendererEnvSchema.Type): RendererConfig => ({
  provider: raw.provider,
  ...(raw.chromePath !== undefined ? { chromePath: raw.chromePath } : {}),
  ...(raw.cdpUrl !== undefined ? { cdpUrl: raw.cdpUrl } : {}),
  ...(raw.gotenbergUrl !== undefined ? { gotenbergUrl: raw.gotenbergUrl.replace(/\/+$/, '') } : {}),
  timeoutMs: raw.timeoutMs ?? DEFAULT_RENDERER_TIMEOUT_MS,
  maxPages: raw.maxPages ?? DEFAULT_RENDERER_MAX_PAGES,
  maxOutputBytes: raw.maxOutputBytes ?? DEFAULT_RENDERER_MAX_OUTPUT_BYTES,
  concurrency: raw.concurrency ?? DEFAULT_RENDERER_CONCURRENCY,
  ...(NO_SANDBOX_ON.has(raw.noSandbox ?? '') ? { noSandbox: true as const } : {}),
})

/**
 * Read the `RENDERER_*` variables from an env snapshot.
 *
 * Total: an invalid value is `{ ok: false }` with an operator-facing reason,
 * which the renderer reports on every render instead of crashing the boot.
 * `RENDERER_CHROME_PATH` and `RENDERER_CDP_URL` are mutually exclusive: one
 * spawns a browser, the other connects to a running one.
 */
export const parseRendererEnv = (
  env: Readonly<Record<string, string | undefined>>
): RendererEnvParse => {
  const decoded = Schema.decodeUnknownResult(RendererEnvSchema)({
    provider: blankToUndefined(env['RENDERER_PROVIDER']),
    chromePath: blankToUndefined(env['RENDERER_CHROME_PATH']),
    cdpUrl: blankToUndefined(env['RENDERER_CDP_URL']),
    gotenbergUrl: blankToUndefined(env['RENDERER_URL']) ?? blankToUndefined(env['OFFICE_URL']),
    timeoutMs: blankToUndefined(env['RENDERER_TIMEOUT_MS']),
    maxPages: blankToUndefined(env['RENDERER_MAX_PAGES']),
    maxOutputBytes: blankToUndefined(env['RENDERER_MAX_OUTPUT_BYTES']),
    concurrency: blankToUndefined(env['RENDERER_CONCURRENCY']),
    noSandbox: blankToUndefined(env['RENDERER_NO_SANDBOX']),
  })
  if (Result.isFailure(decoded)) return { ok: false, error: describeInvalidEnv(env) }
  const raw = decoded.success
  if (raw.chromePath !== undefined && raw.cdpUrl !== undefined) {
    return {
      ok: false,
      error:
        'RENDERER_CHROME_PATH and RENDERER_CDP_URL are both set: set RENDERER_CHROME_PATH to spawn a local Chrome, or RENDERER_CDP_URL to connect to a running one, not both.',
    }
  }
  return { ok: true, config: withDefaults(raw) }
}

/**
 * Why a rendered output is refused under the configured limits, or `undefined`
 * when it fits. `pages` is `undefined` for an image. One sentence per limit,
 * each naming the variable that raises it.
 */
export const renderLimitRefusal = (
  config: Pick<RendererConfig, 'maxPages' | 'maxOutputBytes'>,
  output: { readonly bytes: number; readonly pages?: number }
): string | undefined => {
  if (output.pages !== undefined && output.pages > config.maxPages) {
    return `the document has ${String(output.pages)} pages, above the ${String(config.maxPages)}-page limit (RENDERER_MAX_PAGES)`
  }
  if (output.bytes > config.maxOutputBytes) {
    return `the output is ${String(output.bytes)} bytes, above the ${String(config.maxOutputBytes)}-byte limit (RENDERER_MAX_OUTPUT_BYTES)`
  }
  return undefined
}
