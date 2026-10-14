/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Answer a request once per idempotency key: a form submission
 * (`POST /api/forms/:name/submissions`) and a page's automation press
 * (`POST /api/automations/:name/form-action`).
 *
 * A request may carry a key — the `Idempotency-Key` header, which wins, or the
 * `_idempotency` field a native form post can carry. Within a fixed window a
 * request with a key already answered with a success, the same caller and the
 * same body does nothing and receives the first answer again, marked
 * `Idempotency-Replayed: true`; one arriving while the first is still being
 * processed waits for it. The same key with another body is refused with 422
 * `IDEMPOTENCY_MISMATCH`. Only a success holds a key: a refused request frees
 * it. A request with no key is processed as it always was.
 *
 * The store is in memory, per process, bounded: expired entries are evicted on
 * each write, and at most {@link IDEMPOTENCY_MAX_KEYS} keys and
 * {@link IDEMPOTENCY_MAX_BYTES} of answers are held, the oldest dropped first;
 * an answer larger than {@link IDEMPOTENCY_MAX_ANSWER_BYTES} holds no key. A
 * request still in flight after the window no longer holds its key either, so
 * a run that never ends cannot keep every retry waiting. A restart forgets every key, and a multi-process
 * deployment deduplicates per process — the caveat the webhook deduplication
 * (`automations/webhook-dedup.ts`) carries too. Each key is scoped to its
 * route, its form or automation and its caller ({@link callerScope}: the
 * signed-in user, else the anonymous visitor's address), so one caller's key
 * never answers another's request. Keys are never logged.
 */

import { createHash } from 'node:crypto'
import { ApiErrorCode } from '@/domain/models/api/combinators/error'
import { getRequestRateLimitKey } from '@/presentation/api/middleware/client-ip'
import { errorBody } from './auth-helpers'
import { FORM_FLASH_COOKIE } from './form-flash'
import type { Context } from 'hono'

/** How long a success holds its key. Fixed: no setting. */
export const IDEMPOTENCY_WINDOW_MS = 5 * 60 * 1000

/** The most keys one process holds; the oldest is dropped first. */
export const IDEMPOTENCY_MAX_KEYS = 10_000

/** The most answer bytes one process holds; the oldest is dropped first. */
export const IDEMPOTENCY_MAX_BYTES = 16 * 1024 * 1024

/** An answer larger than this holds no key: a repeat of it is processed again. */
export const IDEMPOTENCY_MAX_ANSWER_BYTES = 64 * 1024

/** The body field a native form post carries its key in. */
export const IDEMPOTENCY_FIELD = '_idempotency'

const KEY_PATTERN = /^[A-Za-z0-9_-]{16,128}$/

/** What a request says about its key. */
export type IdempotencyKeyReading =
  | { readonly kind: 'absent' }
  | { readonly kind: 'invalid' }
  | { readonly kind: 'key'; readonly key: string }

/** The request's key: the header when one is sent, else the body field. */
export function readIdempotencyKey(
  header: string | undefined,
  field: unknown
): IdempotencyKeyReading {
  const supplied = header ?? field
  if (supplied === undefined) return { kind: 'absent' }
  return typeof supplied === 'string' && KEY_PATTERN.test(supplied)
    ? { kind: 'key', key: supplied }
    : { kind: 'invalid' }
}

/** The body without its key field: what is stored, run and compared. */
export function withoutIdempotencyField(
  body: Readonly<Record<string, unknown>>
): Record<string, unknown> {
  return Object.fromEntries(Object.entries(body).filter(([name]) => name !== IDEMPOTENCY_FIELD))
}

/** A value with its object keys sorted and each file reduced to its name, type and size. */
function canonical(value: unknown): unknown {
  if (value instanceof File) return { name: value.name, type: value.type, size: value.size }
  if (Array.isArray(value)) return value.map(canonical)
  if (value === null || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.keys(value)
      .toSorted()
      .map((name) => [name, canonical((value as Record<string, unknown>)[name])])
  )
}

/** The digest two bodies are compared by: the same values, whatever their order. */
export function fingerprintOf(body: Readonly<Record<string, unknown>>): string {
  return createHash('sha256')
    .update(JSON.stringify(canonical(body)) ?? '')
    .digest('hex')
}

/** A success as it was answered, kept to be answered again. */
export interface ReplayableAnswer {
  readonly status: number
  readonly headers: ReadonlyArray<readonly [string, string]>
  readonly body: ArrayBuffer
}

interface SettledEntry {
  readonly kind: 'settled'
  readonly fingerprint: string
  readonly answer: ReplayableAnswer
  readonly at: number
}

interface InFlightEntry {
  readonly kind: 'in-flight'
  readonly fingerprint: string
  readonly done: Promise<ReplayableAnswer | undefined>
  readonly at: number
}

/** What the store says to do with a keyed request. */
export type IdempotencyAdmission =
  | {
      readonly kind: 'proceed'
      /** Hold the key with the success it was answered with, or free it (`undefined`). */
      readonly settle: (answer: ReplayableAnswer | undefined) => void
    }
  | { readonly kind: 'replay'; readonly answer: ReplayableAnswer }
  | { readonly kind: 'mismatch' }
  | { readonly kind: 'wait'; readonly done: Promise<ReplayableAnswer | undefined> }

export interface IdempotencyStore {
  readonly admit: (storeKey: string, fingerprint: string) => IdempotencyAdmission
  /** How many keys are held, settled or in flight. */
  readonly size: () => number
}

type Entry = SettledEntry | InFlightEntry

interface StoreLimits {
  readonly now: () => number
  readonly windowMs: number
  readonly maxKeys: number
  readonly maxBytes: number
}

/** The held entries, with the answer bytes they hold counted. */
function makeEntries(limits: StoreLimits) {
  const entries = new Map<string, Entry>()
  const held = { bytes: 0 }
  const bytesOf = (entry: Entry): number =>
    entry.kind === 'settled' ? entry.answer.body.byteLength : 0
  const drop = (key: string): void => {
    const entry = entries.get(key)
    if (entry === undefined) return
    held.bytes -= bytesOf(entry)
    entries.delete(key)
  }
  // An entry, settled or in flight, holds its key for the window and no longer.
  const expired = (entry: Entry, at: number): boolean => at - entry.at >= limits.windowMs
  return {
    get: (key: string): Entry | undefined => entries.get(key),
    size: (): number => entries.size,
    expired,
    drop,
    // Expired entries go on every write, then the oldest until there is room.
    set: (key: string, entry: Entry): void => {
      const at = limits.now()
      for (const [heldKey, heldEntry] of entries) if (expired(heldEntry, at)) drop(heldKey)
      const incoming = bytesOf(entry)
      while (entries.size >= limits.maxKeys || held.bytes + incoming > limits.maxBytes) {
        const oldest = entries.keys().next()
        if (oldest.done === true) break
        drop(oldest.value)
      }
      entries.set(key, entry)
      held.bytes += incoming
    },
  }
}

/** A store reading the time from `now`, so a test can move it. */
export function makeIdempotencyStore(options: {
  readonly now: () => number
  readonly windowMs?: number
  readonly maxKeys?: number
  readonly maxBytes?: number
}): IdempotencyStore {
  const { now } = options
  const entries = makeEntries({
    now,
    windowMs: options.windowMs ?? IDEMPOTENCY_WINDOW_MS,
    maxKeys: options.maxKeys ?? IDEMPOTENCY_MAX_KEYS,
    maxBytes: options.maxBytes ?? IDEMPOTENCY_MAX_BYTES,
  })
  const proceed = (storeKey: string, fingerprint: string): IdempotencyAdmission => {
    let resolve!: (answer: ReplayableAnswer | undefined) => void
    const done = new Promise<ReplayableAnswer | undefined>((settleWith) => {
      resolve = settleWith
    })
    entries.set(storeKey, { kind: 'in-flight', fingerprint, done, at: now() })
    return {
      kind: 'proceed',
      settle: (answer) => {
        // Only this request's own entry: one evicted or expired while in flight
        // may since have been replaced by a newer request under the same key.
        const own = entries.get(storeKey)
        if (own?.kind === 'in-flight' && own.done === done) {
          entries.drop(storeKey)
          if (answer !== undefined) {
            entries.set(storeKey, { kind: 'settled', fingerprint, answer, at: now() })
          }
        }
        resolve(answer)
      },
    }
  }
  return {
    size: entries.size,
    admit: (storeKey, fingerprint) => {
      const entry = entries.get(storeKey)
      if (entry === undefined || entries.expired(entry, now()))
        return proceed(storeKey, fingerprint)
      if (entry.fingerprint !== fingerprint) return { kind: 'mismatch' }
      return entry.kind === 'settled'
        ? { kind: 'replay', answer: entry.answer }
        : { kind: 'wait', done: entry.done }
    },
  }
}

/** The process's store. */
const PROCESS_STORE = makeIdempotencyStore({ now: () => Date.now() })

/** A 2xx, or the 303 a native form post is sent on with, holds its key. */
const holdsKey = (status: number): boolean => (status >= 200 && status < 300) || status === 303

/**
 * The caller a key is scoped to: the signed-in user, else the anonymous
 * visitor's address (the rate-limit key: an IPv6 address widened to its /64),
 * so a key one visitor sent never answers another visitor's request.
 */
export const callerScope = (c: Context, userId: string | undefined): string =>
  userId ?? `anonymous@${getRequestRateLimitKey(c)}`

async function capture(response: Response): Promise<ReplayableAnswer> {
  return {
    status: response.status,
    headers: [...response.headers.entries()],
    body: await response.arrayBuffer(),
  }
}

/**
 * A cookie a replay carries again: only the one-shot success notice a native
 * form post is sent on with (`form-flash.ts`), which names no caller. Every
 * other cookie was the first request's.
 */
const replaysCookie = ([name, value]: readonly [string, string]): boolean =>
  name !== 'set-cookie' || value.startsWith(`${FORM_FLASH_COOKIE}=`)

/** The first answer again — its cookies left out but the success notice. */
function replayed(answer: ReplayableAnswer): Response {
  const headers = new Headers(
    answer.headers.filter(replaysCookie).map(([name, value]): [string, string] => [name, value])
  )
  headers.set('Idempotency-Replayed', 'true')
  return new Response(answer.body.slice(0), { status: answer.status, headers })
}

/** One request through the store: replayed, refused, waited for, or run. */
async function admitAndRun(
  c: Context,
  store: IdempotencyStore,
  keyed: { readonly storeKey: string; readonly fingerprint: string },
  run: () => Promise<Response>
): Promise<Response> {
  const admission = store.admit(keyed.storeKey, keyed.fingerprint)
  if (admission.kind === 'replay') return replayed(admission.answer)
  if (admission.kind === 'mismatch') {
    return c.json(
      errorBody({
        error: ApiErrorCode.IDEMPOTENCY_MISMATCH,
        message: 'This idempotency key was already used for a different request',
        code: ApiErrorCode.IDEMPOTENCY_MISMATCH,
      }),
      422
    )
  }
  if (admission.kind === 'wait') {
    const first = await admission.done
    // A refused first request freed the key: this one is processed as new.
    return first === undefined ? admitAndRun(c, store, keyed, run) : replayed(first)
  }
  // Assigned once the answer is known; read in `finally`, so the key is freed even when `run` throws.
  let held: ReplayableAnswer | undefined
  try {
    const response = await run()
    if (!holdsKey(response.status)) return response
    const answer = await capture(response)
    if (answer.body.byteLength <= IDEMPOTENCY_MAX_ANSWER_BYTES) held = answer
    return new Response(answer.body.slice(0), { status: answer.status, headers: response.headers })
  } finally {
    admission.settle(held)
  }
}

/** Who and what a key is scoped to: the route kind, the form or automation, the signed-in user. */
export interface IdempotencyScope {
  readonly kind: 'forms' | 'automations'
  readonly name: string
  readonly userId: string | undefined
}

/**
 * Run `run` with the request's body, once per key. The key is scoped to the
 * route, the form or automation and the caller ({@link callerScope}); the body
 * reaches `run` without its key field, keyed or not.
 */
export async function answerOnce(
  c: Context,
  request: { readonly scope: IdempotencyScope; readonly body: Readonly<Record<string, unknown>> },
  run: (body: Record<string, unknown>) => Promise<Response>,
  store: IdempotencyStore = PROCESS_STORE
): Promise<Response> {
  const reading = readIdempotencyKey(
    c.req.header('idempotency-key'),
    request.body[IDEMPOTENCY_FIELD]
  )
  const body = withoutIdempotencyField(request.body)
  if (reading.kind === 'absent') return run(body)
  if (reading.kind === 'invalid') {
    return c.json(
      errorBody({
        error: 'invalid idempotency key',
        message: 'An idempotency key is 16 to 128 letters, digits, dashes or underscores',
        code: ApiErrorCode.BAD_REQUEST,
      }),
      400
    )
  }
  const { kind, name, userId } = request.scope
  const storeKey = `${kind}:${name}:${callerScope(c, userId)}:${reading.key}`
  return admitAndRun(c, store, { storeKey, fingerprint: fingerprintOf(body) }, () => run(body))
}
