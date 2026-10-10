/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What kind of failure a rejected outbound request was, read from the error
 * `fetch` (or `withFetchTimeout` / `guardedFetch`) rejected with.
 *
 * The shapes are Bun's (1.4.2, probed): an unresolved host is a `TypeError`
 * with `code: 'ENOTFOUND'`, a closed port `code: 'ConnectionRefused'`, an
 * untrusted certificate `code: 'DEPTH_ZERO_SELF_SIGNED_CERT'` /
 * `'CERT_HAS_EXPIRED'` and the like, and a request aborted on its budget an
 * `AbortError` (a body read past it a `TimeoutError`). The code may sit on the
 * error or on its `cause`, so both are read.
 *
 * Anything not recognised is a `connection` failure: the request did not get
 * an answer, and "the connection failed" is the honest least-specific reading.
 */
export type EgressFailureKind = 'timeout' | 'dns' | 'connection' | 'tls'

const DNS_CODES: ReadonlySet<string> = new Set(['ENOTFOUND', 'EAI_AGAIN', 'EAI_NONAME'])

/** A certificate or handshake failure, whatever the exact code names. */
const TLS_CODE = /CERT|SSL|TLS|SELF_SIGNED/i

const fieldOf = (value: unknown, key: 'name' | 'code'): string | undefined => {
  if (value === null || typeof value !== 'object') return undefined
  const field = (value as Readonly<Record<string, unknown>>)[key]
  return typeof field === 'string' ? field : undefined
}

/** The error and its `cause`, the two places Bun puts a failure's name and code. */
const layersOf = (error: unknown): readonly unknown[] =>
  error !== null && typeof error === 'object' && 'cause' in error
    ? [error, (error as { readonly cause?: unknown }).cause]
    : [error]

/** Classify a rejected outbound request. Pure; never throws. */
export const classifyEgressFailure = (error: unknown): EgressFailureKind => {
  const layers = layersOf(error)
  const names = new Set(layers.map((layer) => fieldOf(layer, 'name')))
  if (names.has('AbortError') || names.has('TimeoutError')) return 'timeout'
  const codes = layers
    .map((layer) => fieldOf(layer, 'code'))
    .filter((code): code is string => code !== undefined)
  if (codes.some((code) => DNS_CODES.has(code))) return 'dns'
  if (codes.some((code) => TLS_CODE.test(code))) return 'tls'
  return 'connection'
}
