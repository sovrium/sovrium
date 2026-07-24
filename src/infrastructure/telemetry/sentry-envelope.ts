/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import type { SentryDsn } from '@/domain/models/env/telemetry/sentry-dsn'

export interface SentryStackFrame {
  readonly filename: string
  readonly function?: string
  readonly lineno?: number
  readonly colno?: number
  readonly in_app: boolean
}

export interface SentryEvent {
  readonly event_id: string
  readonly timestamp: number
  readonly platform: 'javascript'
  readonly level: 'error'
  readonly release: string
  readonly environment: string
  readonly server_name: string
  readonly exception: {
    readonly values: ReadonlyArray<{
      readonly type: string
      readonly value: string
      readonly stacktrace: { readonly frames: ReadonlyArray<SentryStackFrame> }
    }>
  }
  readonly request?: {
    readonly method: string
    readonly url: string
    readonly headers: Readonly<Record<string, string>>
  }
}

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

export interface EventMeta {
  readonly release: string
  readonly environment: string
  readonly serverName: string
}

export interface RequestContext {
  readonly method: string
  readonly url: string
  readonly headers: Readonly<Record<string, string>>
}

const HEADER_ALLOWLIST: ReadonlySet<string> = new Set([
  'user-agent',
  'accept',
  'content-type',
  'referer',
])

const newEventId = (): string => crypto.randomUUID().replace(/-/g, '')

const randomHex = (length: number): string =>
  Array.from({ length }, () => Math.floor(Math.random() * 16).toString(16)).join('')

const scrubHeaders = (
  headers: Readonly<Record<string, string>>
): Readonly<Record<string, string>> =>
  Object.entries(headers).reduce<Record<string, string>>((acc, [key, value]) => {
    const lower = key.toLowerCase()
    return HEADER_ALLOWLIST.has(lower) ? { ...acc, [lower]: value } : acc
  }, {})

const parseStackFrames = (stack: string | undefined): ReadonlyArray<SentryStackFrame> => {
  if (!stack) return []
  const framesNewestFirst = stack
    .split('\n')
    .map((line) => parseStackLine(line.trim()))
    .filter((frame): frame is SentryStackFrame => frame !== undefined)
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

export const buildEventFromError = (
  error: unknown,
  meta: EventMeta,
  request?: RequestContext
): SentryEvent => {
  const err = error instanceof Error ? error : new Error(String(error))
  return {
    event_id: newEventId(),
    timestamp: Date.now() / 1000,
    platform: 'javascript',
    level: 'error',
    release: meta.release,
    environment: meta.environment,
    server_name: meta.serverName,
    exception: {
      values: [
        {
          type: err.name || 'Error',
          value: err.message,
          stacktrace: { frames: parseStackFrames(err.stack) },
        },
      ],
    },
    ...(request
      ? {
          request: {
            method: request.method,
            url: request.url,
            headers: scrubHeaders(request.headers),
          },
        }
      : {}),
  }
}

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

export const buildEnvelope = (
  eventId: string,
  itemType: 'event' | 'transaction',
  payload: SentryEvent | SentryTransaction
): string => {
  const envelopeHeader = { event_id: eventId, sent_at: new Date().toISOString() }
  const itemHeader = { type: itemType }
  return `${[envelopeHeader, itemHeader, payload].map((part) => JSON.stringify(part)).join('\n')}\n`
}

export const buildAuthHeader = (dsn: SentryDsn, clientVersion: string): string =>
  `Sentry sentry_version=7, sentry_client=sovrium/${clientVersion}, sentry_key=${dsn.publicKey}`
