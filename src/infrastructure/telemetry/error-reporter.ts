/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { hostname } from 'node:os'
import {
  buildAuthHeader,
  buildEnvelope,
  buildEventFromError,
  buildTransaction,
  type EventMeta,
  type RequestContext,
  type SentryEvent,
  type SentryTransaction,
} from './sentry-envelope'
import { getTelemetryConfig } from './telemetry-config'
import type { SentryDsn } from '@/domain/models/env/telemetry/sentry-dsn'

const RATE_LIMIT = 30
const RATE_WINDOW_MS = 60_000
const DEDUP_WINDOW_MS = 60_000
const POST_TIMEOUT_MS = 3000
const FLUSH_CAP_MS = 2000


const metaState = new Map<'meta', EventMeta>()
const handlerState = new Map<'registered', true>()
const muteState = new Map<'until', number>()
const reportedObjects = new WeakSet<object>()
const fingerprintSeen = new Map<string, number>()
const rateWindow = new Map<'all', ReadonlyArray<number>>()

export const initErrorReporter = (meta: EventMeta): void => {
  metaState.set('meta', meta)
}

export const registerProcessErrorHandlers = (): void => {
  if (handlerState.get('registered')) return
  handlerState.set('registered', true)
  process.on('uncaughtException', reportAndExit)
  process.on('unhandledRejection', reportAndExit)
}

export const reportException = (error: unknown, request?: RequestContext): Promise<void> => {
  try {
    const config = getTelemetryConfig()
    const { errorReporting } = config
    if (errorReporting === undefined) return Promise.resolve()

    const now = Date.now()
    if (isMuted(now)) return Promise.resolve()
    if (isDuplicateObject(error)) return Promise.resolve()
    if (isDuplicateFingerprint(error, now)) return Promise.resolve()
    if (!allowByRate(now)) return Promise.resolve()

    const meta = resolveMeta(errorReporting.environment)
    const event = buildEventFromError(error, meta, request)
    return emitEnvelope(errorReporting.dsn, meta.release, 'event', event)
  } catch {
    return Promise.resolve()
  }
}

export const reportTransaction = (name: string, startMs: number, endMs: number): void => {
  try {
    const { errorReporting } = getTelemetryConfig()
    if (errorReporting === undefined) return
    if (isMuted(Date.now())) return

    const meta = resolveMeta(errorReporting.environment)
    const transaction = buildTransaction(name, startMs, endMs, meta)
    void emitEnvelope(errorReporting.dsn, meta.release, 'transaction', transaction)
  } catch {
  }
}


const isMuted = (now: number): boolean => now < (muteState.get('until') ?? 0)

const isDuplicateObject = (error: unknown): boolean => {
  if (typeof error !== 'object' || error === null) return false
  if (reportedObjects.has(error)) return true
  reportedObjects.add(error)
  return false
}

const isDuplicateFingerprint = (error: unknown, now: number): boolean => {
  const fp = fingerprint(error)
  const last = fingerprintSeen.get(fp)
  if (last !== undefined && now - last < DEDUP_WINDOW_MS) return true
  fingerprintSeen.set(fp, now)
  return false
}

const allowByRate = (now: number): boolean => {
  const pruned = (rateWindow.get('all') ?? []).filter((t) => now - t < RATE_WINDOW_MS)
  if (pruned.length >= RATE_LIMIT) {
    rateWindow.set('all', pruned)
    return false
  }
  rateWindow.set('all', [...pruned, now])
  return true
}

const fingerprint = (error: unknown): string => {
  const err = error instanceof Error ? error : new Error(String(error))
  const firstFrame = (err.stack?.split('\n')[1] ?? '').trim()
  return `${err.name}:${err.message}:${firstFrame}`
}

const fallbackMeta = (environment: string): EventMeta => ({
  release: 'sovrium@0.0.0',
  environment,
  serverName: hostname(),
})

const resolveMeta = (environment: string): EventMeta =>
  metaState.get('meta') ?? fallbackMeta(environment)

const clientVersion = (release: string): string => release.replace(/^sovrium@/, '') || '0.0.0'

const emitEnvelope = (
  dsn: SentryDsn,
  release: string,
  itemType: 'event' | 'transaction',
  payload: SentryEvent | SentryTransaction
): Promise<void> => {
  const body = buildEnvelope(payload.event_id, itemType, payload)
  const auth = buildAuthHeader(dsn, clientVersion(release))
  return sendEnvelope(dsn.envelopeUrl, body, auth)
}

const sendEnvelope = async (url: string, body: string, authHeader: string): Promise<void> => {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-sentry-envelope',
        'x-sentry-auth': authHeader,
      },
      body,
      signal: AbortSignal.timeout(POST_TIMEOUT_MS),
    })
    if (response.status === 429) {
      const retryAfter = Number(response.headers.get('retry-after')) || 60
      muteState.set('until', Date.now() + retryAfter * 1000)
    }
  } catch {
  }
}

const reportAndExit = (error: unknown): void => {
  void Promise.race([
    reportException(error),
    new Promise<void>((resolve) => setTimeout(resolve, FLUSH_CAP_MS)),
  ]).finally(exitFailure)
}

const exitFailure = (): never => process.exit(1)
