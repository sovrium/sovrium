/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Sentry-protocol envelope builders ([internal ref]
 * / -PERFORMANCE).
 *
 * A minimal, hand-rolled Sentry-envelope serializer — NOT the `@sentry/node`
 * SDK (consistent with [internal ref]'s custom-Logger rationale: zero heavy deps,
 * `bun build --compile`-safe). A Sentry envelope is a three-line NDJSON body:
 *
 *   1. envelope header  `{ "event_id": ..., "sent_at": ... }`
 *   2. item header      `{ "type": "event" }` (or `"transaction"`)
 *   3. item payload     the event / transaction JSON
 *
 * POSTed to the DSN's `/api/<project_id>/envelope/` endpoint with an
 * `X-Sentry-Auth` header derived from the DSN public key.
 *
 * Everything here is PURE (no I/O, no module state) so it is trivially testable
 * and reusable across the error reporter and the performance middleware.
 */

import { elidedLabel, resolveCauseChain } from './error-chain'
import type { SentryDsn } from '@/domain/models/env/telemetry/sentry-dsn'

/** A parsed V8 stack frame in Sentry's `stacktrace.frames[]` shape. */
export interface SentryStackFrame {
  readonly filename: string
  readonly function?: string
  readonly lineno?: number
  readonly colno?: number
  /** `true` for application frames (outside `node_modules`). */
  readonly in_app: boolean
}

/**
 * One link of a Sentry `exception.values[]` chain — a single `Error` in a
 * `cause` chain, with its own type, message, and stack.
 */
export interface SentryExceptionValue {
  readonly type: string
  readonly value: string
  readonly stacktrace: { readonly frames: ReadonlyArray<SentryStackFrame> }
}

/** A Sentry error event payload (the subset Sovrium emits). */
export interface SentryEvent {
  readonly event_id: string
  readonly timestamp: number
  readonly platform: 'javascript'
  readonly level: 'error'
  readonly release: string
  readonly environment: string
  readonly server_name: string
  readonly exception: {
    readonly values: ReadonlyArray<SentryExceptionValue>
  }
  readonly request?: {
    readonly method: string
    readonly url: string
    readonly headers: Readonly<Record<string, string>>
  }
}

/** A Sentry performance transaction payload. */
export interface SentryTransaction {
  readonly event_id: string
  readonly type: 'transaction'
  readonly transaction: string
  readonly start_timestamp: number
  readonly timestamp: number
  readonly platform: 'javascript'
  readonly release: string
  readonly environment: string
  readonly contexts: {
    readonly trace: {
      readonly trace_id: string
      readonly span_id: string
      readonly op: 'http.server'
      readonly status: string
    }
  }
}

/** Shared metadata stamped onto every event/transaction. */
export interface EventMeta {
  /** `sovrium@<version>`. */
  readonly release: string
  readonly environment: string
  readonly serverName: string
}

/** Inbound request context captured at the error boundary (pre-scrub). */
export interface RequestContext {
  readonly method: string
  readonly url: string
  readonly headers: Readonly<Record<string, string>>
}

/**
 * Request-header ALLOWLIST (standing rule S4): only these non-sensitive headers
 * are ever copied into an event's request context. `cookie` and `authorization`
 * can therefore never leak — a newly-added sensitive header is excluded by
 * omission, not by an easy-to-forget denylist entry.
 */
const HEADER_ALLOWLIST: ReadonlySet<string> = new Set([
  'user-agent',
  'accept',
  'content-type',
  'referer',
])

/** Literal substituted for every query-parameter value in a reported URL. */
const REDACTED_VALUE = '[REDACTED]'

/**
 * Strip every query-parameter VALUE out of a URL, keeping the scheme, host,
 * path, and every parameter NAME (standing rule S4).
 *
 * Why UNCONDITIONALLY, including values that look innocuous
 * ---------------------------------------------------------
 * The query surface of a Sovrium app is config-driven — an operator can add a
 * page, route, or automation that reads any parameter it likes — so no
 * allowlist of "safe" parameter names can be kept accurate. And a denylist of
 * "sensitive-looking" names is exactly the easy-to-forget pattern that
 * `HEADER_ALLOWLIST` above was built to avoid. Redacting every value is the
 * only rule that stays correct as the app's routes change.
 *
 * This is not hypothetical: `admin-invitation-routes.ts` reads
 * `c.req.query('token')`, and both OAuth callbacks (`connections/index.ts`,
 * `admin/connections-actions.ts`) read `?code=`. A 500 on any of those used to
 * persist a LIVE credential into the error store, which is durable, widely
 * readable, and outlives the credential's own rotation.
 *
 * Names are kept deliberately: a name carries no secret, and knowing that a
 * `token` parameter was PRESENT (rather than absent) is precisely what
 * separates "malformed invitation link" from "no invitation link at all" —
 * the diagnostic the request context exists to provide.
 *
 * TOTAL BY CONSTRUCTION: this is a pure string transform — no `new URL()`, no
 * `decodeURIComponent`, nothing that can throw on a relative, malformed, or
 * partially-encoded input. Telemetry must never affect the request it observes
 * (see `error-reporter.ts`), and a reporter that threw here would not merely
 * degrade the URL, it would drop the whole crash report.
 */
export const redactUrlQueryValues = (rawUrl: string): string => {
  if (typeof rawUrl !== 'string') return ''
  const queryStart = rawUrl.indexOf('?')
  if (queryStart === -1) return rawUrl

  const base = rawUrl.slice(0, queryStart)
  const query = rawUrl.slice(queryStart + 1)
  if (query === '') return rawUrl

  const redacted = query
    .split('&')
    .map((pair) => {
      const separator = pair.indexOf('=')
      // A valueless parameter (`?flag`) has no value to redact — it IS a name,
      // and names are kept, so it passes through unchanged.
      return separator === -1 ? pair : `${pair.slice(0, separator)}=${REDACTED_VALUE}`
    })
    .join('&')

  return `${base}?${redacted}`
}

/** 32-hex-char event id (a UUID v4 with the dashes stripped, per Sentry). */
const newEventId = (): string => crypto.randomUUID().replace(/-/g, '')

/** A random hex string of `length` characters (trace/span ids). */
const randomHex = (length: number): string =>
  Array.from({ length }, () => Math.floor(Math.random() * 16).toString(16)).join('')

/** Copy only the allowlisted headers, lower-casing keys. */
const scrubHeaders = (
  headers: Readonly<Record<string, string>>
): Readonly<Record<string, string>> =>
  Object.entries(headers).reduce<Record<string, string>>((acc, [key, value]) => {
    const lower = key.toLowerCase()
    return HEADER_ALLOWLIST.has(lower) ? { ...acc, [lower]: value } : acc
  }, {})

/**
 * Parse a V8 error stack into Sentry frames, OLDEST-first (Sentry renders the
 * crash site last). Frames inside `node_modules` are marked `in_app: false`.
 * Lines that don't match the `at fn (file:line:col)` grammar are dropped.
 */
const parseStackFrames = (stack: string | undefined): ReadonlyArray<SentryStackFrame> => {
  if (!stack) return []
  const framesNewestFirst = stack
    .split('\n')
    .map((line) => parseStackLine(line.trim()))
    .filter((frame): frame is SentryStackFrame => frame !== undefined)
  // Sentry renders oldest-first (crash site last); V8 gives newest-first.
  return framesNewestFirst.reduceRight<ReadonlyArray<SentryStackFrame>>(
    (acc, item) => [...acc, item],
    []
  )
}

const WITH_FN = /^at\s+(?:async\s+)?(.+?)\s+\((.*):(\d+):(\d+)\)$/
const NO_FN = /^at\s+(?:async\s+)?(.*):(\d+):(\d+)$/

const parseStackLine = (line: string): SentryStackFrame | undefined => {
  const withFn = WITH_FN.exec(line)
  if (withFn) {
    const [, fn, filename, lineno, colno] = withFn
    return frame(filename ?? '', Number(lineno), Number(colno), fn)
  }
  const noFn = NO_FN.exec(line)
  if (noFn) {
    const [, filename, lineno, colno] = noFn
    return frame(filename ?? '', Number(lineno), Number(colno))
  }
  return undefined
}

const frame = (filename: string, lineno: number, colno: number, fn?: string): SentryStackFrame => ({
  filename,
  ...(fn ? { function: fn } : {}),
  lineno,
  colno,
  in_app: !filename.includes('node_modules'),
})

/**
 * One chain link as a Sentry exception value. `elided > 0` annotates the message
 * to mark a compressed chain (see `buildExceptionValues`).
 */
const exceptionValue = (err: Readonly<Error>, elided: number): SentryExceptionValue => ({
  type: err.name || 'Error',
  value: elided > 0 ? `${err.message} [${elidedLabel(elided)}]` : err.message,
  stacktrace: { frames: parseStackFrames(err.stack) },
})

/**
 * Serialize an error and its `cause` chain into `exception.values[]`.
 *
 * Sentry sorts a chained exception OLDEST to NEWEST, so the ROOT CAUSE is
 * `values[0]` and the outermost wrapper is last — the reverse of the walk order,
 * hence the `reduceRight` (the same reversal idiom `parseStackFrames` uses).
 * Without this, every wrapped-error construction site reported only its
 * wrapper's message and a runtime-only stack, leaving the originating
 * driver/database error unrecoverable from the error backend.
 *
 * A compressed chain is marked on the RETAINED ROOT's `value` rather than by
 * inserting a synthetic link. A synthetic entry would be parsed by the backend
 * as a real exception — inflating the chain it displays and giving it a
 * fabricated type and empty stack to group on. The root is `values[0]`, never
 * the last element, so annotating it cannot disturb issue titling or grouping.
 */
const buildExceptionValues = (error: unknown): ReadonlyArray<SentryExceptionValue> => {
  const { links, elided } = resolveCauseChain(error)
  const rootIndex = links.length - 1
  return links.reduceRight<ReadonlyArray<SentryExceptionValue>>(
    (acc, item, index) => [...acc, exceptionValue(item, index === rootIndex ? elided : 0)],
    []
  )
}

/** Build a Sentry error event from a thrown value + optional request context. */
export const buildEventFromError = (
  error: unknown,
  meta: EventMeta,
  request?: RequestContext
): SentryEvent => {
  return {
    event_id: newEventId(),
    timestamp: Date.now() / 1000,
    platform: 'javascript',
    level: 'error',
    release: meta.release,
    environment: meta.environment,
    server_name: meta.serverName,
    exception: {
      values: buildExceptionValues(error),
    },
    ...(request
      ? {
          request: {
            method: request.method,
            // Query VALUES are stripped here, at the single serialization
            // boundary, so every current AND future URL-carrying telemetry
            // payload inherits the redaction rather than re-deriving it.
            url: redactUrlQueryValues(request.url),
            headers: scrubHeaders(request.headers),
          },
        }
      : {}),
  }
}

/** Build a Sentry transaction for a completed HTTP request. */
export const buildTransaction = (
  name: string,
  startMs: number,
  endMs: number,
  meta: EventMeta
): SentryTransaction => ({
  event_id: newEventId(),
  type: 'transaction',
  transaction: name,
  start_timestamp: startMs / 1000,
  timestamp: endMs / 1000,
  platform: 'javascript',
  release: meta.release,
  environment: meta.environment,
  contexts: {
    trace: {
      trace_id: randomHex(32),
      span_id: randomHex(16),
      op: 'http.server',
      status: 'ok',
    },
  },
})

/** Serialize an event/transaction into a three-line NDJSON Sentry envelope. */
export const buildEnvelope = (
  eventId: string,
  itemType: 'event' | 'transaction',
  payload: SentryEvent | SentryTransaction
): string => {
  const envelopeHeader = { event_id: eventId, sent_at: new Date().toISOString() }
  const itemHeader = { type: itemType }
  return `${[envelopeHeader, itemHeader, payload].map((part) => JSON.stringify(part)).join('\n')}\n`
}

/**
 * Build the `X-Sentry-Auth` header value. The collector reads `sentry_key` to
 * authenticate; `sentry_client` identifies the emitting SDK.
 */
export const buildAuthHeader = (dsn: SentryDsn, clientVersion: string): string =>
  `Sentry sentry_version=7, sentry_client=sovrium/${clientVersion}, sentry_key=${dsn.publicKey}`
