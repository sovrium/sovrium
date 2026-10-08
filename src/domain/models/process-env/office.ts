/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Result, Schema } from 'effect'

/**
 * The office engine `document/convert` sends Word, Excel, PowerPoint and
 * OpenDocument files to: Gotenberg's LibreOffice route
 * (`OFFICE_PROVIDER=gotenberg` + `OFFICE_URL`) on a server, or a LibreOffice
 * installed on the machine (`OFFICE_PROVIDER=soffice`, found at
 * `OFFICE_SOFFICE_PATH` or in the usual places) on the desktop. Unset, office
 * conversion is off.
 *
 * Env vars: OFFICE_PROVIDER, OFFICE_URL, OFFICE_SOFFICE_PATH, OFFICE_TIMEOUT_MS,
 *           OFFICE_CONCURRENCY
 */

/** Recognised `OFFICE_PROVIDER` values, in the order an error message lists them. */
export const SUPPORTED_OFFICE_PROVIDERS = ['gotenberg', 'soffice'] as const

export type OfficeProvider = (typeof SUPPORTED_OFFICE_PROVIDERS)[number]

/** The longest one conversion may take by default: two minutes. */
export const DEFAULT_OFFICE_TIMEOUT_MS = 120_000

/** Conversions in flight per process by default; the rest queue. */
export const DEFAULT_OFFICE_CONCURRENCY = 2

/** The largest delay a timer accepts (2^31 − 1 ms). */
const MAX_TIMER_MS = 2_147_483_647

const PositiveIntFromString = Schema.FiniteFromString.pipe(
  Schema.check(Schema.isInt(), Schema.isGreaterThan(0), Schema.isLessThanOrEqualTo(MAX_TIMER_MS))
)

/** The raw `OFFICE_*` variables, decoded. Every key is optional. */
export const OfficeEnvSchema = Schema.Struct({
  provider: Schema.optional(
    Schema.Literals(SUPPORTED_OFFICE_PROVIDERS).annotate({
      description: 'Office engine (OFFICE_PROVIDER); unset, office conversion is off',
    })
  ),
  url: Schema.optional(
    Schema.String.annotate({ description: 'Gotenberg base URL (OFFICE_URL)' }).pipe(
      Schema.check(Schema.isPattern(/^https?:\/\/[^/\s]+/))
    )
  ),
  sofficePath: Schema.optional(
    Schema.String.annotate({ description: 'LibreOffice executable (OFFICE_SOFFICE_PATH)' })
  ),
  timeoutMs: Schema.optional(
    PositiveIntFromString.annotate({ description: 'Per-conversion ceiling (OFFICE_TIMEOUT_MS)' })
  ),
  concurrency: Schema.optional(
    PositiveIntFromString.annotate({
      description: 'Conversions in progress at once (OFFICE_CONCURRENCY)',
    })
  ),
})

/** The `OFFICE_*` configuration, every default applied. */
export interface OfficeConfig {
  readonly provider: OfficeProvider | undefined
  readonly url?: string
  readonly sofficePath?: string
  readonly timeoutMs: number
  readonly concurrency: number
}

export type OfficeEnvParse =
  | { readonly ok: true; readonly config: OfficeConfig }
  | { readonly ok: false; readonly error: string }

const blankToUndefined = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim()
  return trimmed === undefined || trimmed === '' ? undefined : trimmed
}

/**
 * Read the `OFFICE_*` variables from an env snapshot. Total: an invalid value
 * is `{ ok: false }` with an operator-facing reason, reported on every
 * conversion instead of crashing the boot.
 */
export const parseOfficeEnv = (
  env: Readonly<Record<string, string | undefined>>
): OfficeEnvParse => {
  const decoded = Schema.decodeUnknownResult(OfficeEnvSchema)({
    provider: blankToUndefined(env['OFFICE_PROVIDER']),
    url: blankToUndefined(env['OFFICE_URL']),
    sofficePath: blankToUndefined(env['OFFICE_SOFFICE_PATH']),
    timeoutMs: blankToUndefined(env['OFFICE_TIMEOUT_MS']),
    concurrency: blankToUndefined(env['OFFICE_CONCURRENCY']),
  })
  if (Result.isFailure(decoded)) {
    return {
      ok: false,
      error: `The OFFICE_* variables are invalid: OFFICE_PROVIDER must be ${SUPPORTED_OFFICE_PROVIDERS.join(' or ')}, OFFICE_URL an http(s) URL, OFFICE_TIMEOUT_MS a positive integer of milliseconds, and OFFICE_CONCURRENCY a positive integer.`,
    }
  }
  const raw = decoded.success
  return {
    ok: true,
    config: {
      provider: raw.provider,
      ...(raw.url === undefined ? {} : { url: raw.url.replace(/\/+$/, '') }),
      ...(raw.sofficePath === undefined ? {} : { sofficePath: raw.sofficePath }),
      timeoutMs: raw.timeoutMs ?? DEFAULT_OFFICE_TIMEOUT_MS,
      concurrency: raw.concurrency ?? DEFAULT_OFFICE_CONCURRENCY,
    },
  }
}
