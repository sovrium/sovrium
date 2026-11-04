/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The evidence chain of a signing request: how one event is spelled, hashed
 * and linked to the one before it, how personal data enters it, and how a
 * reader checks it.
 *
 * Each event is spelled as canonical JSON (`canonical-json.ts`) of
 * `{ requestId, seq, type, at, signer?, data, prevHash }`; its `hash` is the SHA-256, in
 * lowercase hex, of those bytes. `prevHash` is the hash of the event before,
 * or {@link GENESIS_PREVIOUS_HASH} for the first, and `seq` counts from 1. So
 * changing one byte of any event, removing one or reordering two breaks every
 * hash after it, and the request id inside every hash keeps an event, or a
 * whole chain, from being passed off as another request's.
 *
 * Personal data never enters an event in clear. A name, an address, a phone
 * number, a network address or a browser string enters as a salted
 * commitment ({@link subjectCommitment}): the SHA-256 of `{ field, salt, value }`.
 * The value and its salt are kept apart; deleting them (an erasure) leaves a
 * chain that still verifies and a commitment that no longer opens to anyone.
 *
 * Pure: the caller supplies the clock, the salts and the stored rows.
 */

import { createHash } from 'node:crypto'
import { canonicalJsonBytes, type CanonicalJsonValue } from '@/domain/kernel/format/canonical-json'
import { durationToMs } from '@/domain/kernel/time/parse-duration'
import type { SIGNATURE_EVENT_TYPES } from '@/domain/models/api/signatures/evidence'

/** The `prevHash` of the first event of a chain. */
export const GENESIS_PREVIOUS_HASH = '0'.repeat(64)

/** One kind of event the chain records. */
export type SignatureEventType = (typeof SIGNATURE_EVENT_TYPES)[number]

/** Event details: personal data only as commitments. */
export type SignatureEventData = { readonly [key: string]: CanonicalJsonValue | undefined }

/** An event before it is linked: what happened, when, to whom. */
export interface SignatureEventBody {
  readonly seq: number
  readonly type: SignatureEventType
  /** Server instant, ISO 8601 UTC. */
  readonly at: string
  /** The signer the event concerns, by her name within the flow. */
  readonly signer?: string | undefined
  readonly data: SignatureEventData
}

/** An event linked into its chain. */
export interface ChainedSignatureEvent extends SignatureEventBody {
  readonly prevHash: string
  readonly hash: string
}

/** The head of a chain: the request it belongs to, and what the next event links to. */
export interface ChainHead {
  readonly requestId: string
  readonly seq: number
  readonly hash: string
}

/** The head of the empty chain of `requestId`: the first event takes `seq` 1 and the genesis hash. */
export const emptyChainHead = (requestId: string): ChainHead => ({
  requestId,
  seq: 0,
  hash: GENESIS_PREVIOUS_HASH,
})

/** SHA-256 of `bytes` (a string is hashed as UTF-8), lowercase hex. */
export const sha256Hex = (bytes: Uint8Array | string): string =>
  createHash('sha256').update(bytes).digest('hex')

/** The bytes an event of request `requestId` is hashed over. */
export const eventCanonicalBytes = (
  requestId: string,
  body: SignatureEventBody,
  prevHash: string
): Uint8Array =>
  canonicalJsonBytes({
    requestId,
    ...{ seq: body.seq, type: body.type, at: body.at, signer: body.signer },
    ...{ data: body.data, prevHash },
  })

/** `body` linked after `head`: its `seq` and `prevHash` follow the head's. */
export const chainEventAfter = (
  head: ChainHead,
  body: Omit<SignatureEventBody, 'seq'>
): { readonly event: ChainedSignatureEvent; readonly canonicalBytes: Uint8Array } => {
  const linked = { ...body, seq: head.seq + 1 }
  const canonicalBytes = eventCanonicalBytes(head.requestId, linked, head.hash)
  return {
    event: { ...linked, prevHash: head.hash, hash: sha256Hex(canonicalBytes) },
    canonicalBytes,
  }
}

/** `bodies` linked one after the other from `head`, with each one's canonical bytes. */
export const chainEventsAfter = (
  head: ChainHead,
  bodies: readonly Omit<SignatureEventBody, 'seq'>[]
): readonly { readonly event: ChainedSignatureEvent; readonly canonicalBytes: Uint8Array }[] =>
  bodies.reduce<
    readonly { readonly event: ChainedSignatureEvent; readonly canonicalBytes: Uint8Array }[]
  >((linked, body) => {
    const last = linked.at(-1)?.event
    return [
      ...linked,
      chainEventAfter(last === undefined ? head : { ...last, requestId: head.requestId }, body),
    ]
  }, [])

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * The event `canonicalBytes` spell, as stored: `undefined` when the bytes are
 * not one canonical event (not JSON, a member missing or of the wrong kind).
 */
export const parseCanonicalEvent = (
  canonicalBytes: Uint8Array
): (SignatureEventBody & { readonly prevHash: string }) | undefined => {
  const parsed = ((): unknown => {
    try {
      return JSON.parse(new TextDecoder().decode(canonicalBytes)) as unknown
    } catch {
      return undefined
    }
  })()
  if (!isRecord(parsed)) return undefined
  const { seq, type, at, signer, data, prevHash } = parsed
  const valid =
    typeof seq === 'number' &&
    typeof type === 'string' &&
    typeof at === 'string' &&
    (signer === undefined || typeof signer === 'string') &&
    isRecord(data) &&
    typeof prevHash === 'string'
  if (!valid) return undefined
  return {
    ...{ seq, type: type as SignatureEventType, at, data: data as SignatureEventData, prevHash },
    ...(signer === undefined ? {} : { signer }),
  }
}

/** Whether a chain checks, and the first break when it does not. */
export type ChainVerdict =
  { readonly valid: true } | { readonly valid: false; readonly detail: string }

/** The first break in `event`, the `index`-th of the chain of `requestId`, after `previous`. */
const eventBreak = (
  requestId: string,
  event: ChainedSignatureEvent,
  index: number,
  previous: ChainedSignatureEvent | undefined
): string | undefined => {
  if (event.seq !== index + 1) return `event ${index + 1} is numbered ${event.seq}`
  const expectedPrevious = previous === undefined ? GENESIS_PREVIOUS_HASH : previous.hash
  if (event.prevHash !== expectedPrevious) {
    return `event ${event.seq} does not link to the event before it`
  }
  if (sha256Hex(eventCanonicalBytes(requestId, event, event.prevHash)) !== event.hash) {
    return `event ${event.seq} does not match its hash`
  }
  return undefined
}

/**
 * Whether `events` are one unbroken chain of request `requestId`: numbered
 * 1, 2, 3…, each linked to the one before (the first to the genesis hash),
 * each matching its hash taken with that request id. An empty chain is
 * broken: a request always records at least one event.
 */
export const verifyChainEvents = (
  requestId: string,
  events: readonly ChainedSignatureEvent[]
): ChainVerdict => {
  if (events.length === 0) return { valid: false, detail: 'the chain holds no event' }
  const detail = events
    .map((event, index) =>
      eventBreak(requestId, event, index, index === 0 ? undefined : events[index - 1])
    )
    .find((found) => found !== undefined)
  return detail === undefined ? { valid: true } : { valid: false, detail }
}

/** A fresh-looking salt is 16 bytes or more of randomness, hex. */
const SALT_PATTERN = /^[0-9a-f]{32,}$/

/** Whether `salt` is shaped like a salt the engine mints: 16 random bytes or more, in hex. */
export const isCommitmentSalt = (salt: string): boolean => SALT_PATTERN.test(salt)

/**
 * The salted commitment to one personal datum: SHA-256 of the canonical JSON
 * of `{ field, salt, value }`. `field` names the datum (`name`, `email`,
 * `phone`, `ipAddress`, `userAgent`, `contact`), so the same value committed as
 * two fields gives two commitments.
 */
export const subjectCommitment = (field: string, value: string, salt: string): string =>
  sha256Hex(canonicalJsonBytes({ field, salt, value }))

/** Whether `value`, with `salt`, opens `commitment` as `field`. */
export const opensCommitment = (
  commitment: string,
  opening: { readonly field: string; readonly value: string; readonly salt: string }
): boolean => subjectCommitment(opening.field, opening.value, opening.salt) === commitment

/**
 * The one value a signer's contact commitment is taken over: her address and
 * her phone, either possibly empty, spelled canonically so a reader with both
 * reproduces it.
 */
export const contactCommitmentValue = (contact: {
  readonly email?: string | undefined
  readonly phone?: string | undefined
}): string =>
  new TextDecoder().decode(
    canonicalJsonBytes({ email: contact.email ?? '', phone: contact.phone ?? '' })
  )

/**
 * When the evidence of a request that ended at `endedAtMs` may go: that
 * instant plus the flow's `evidence.keep`. `undefined` for a `keep` that is
 * not a duration.
 */
export const evidenceKeepUntil = (endedAtMs: number, keep: string): number | undefined => {
  const keepMs = durationToMs(keep)
  return keepMs === undefined ? undefined : endedAtMs + keepMs
}

/** The request statuses after which nothing more happens to a request, but its retention. */
export const TERMINAL_REQUEST_STATUSES = ['completed', 'declined', 'cancelled', 'expired'] as const

/** One of {@link TERMINAL_REQUEST_STATUSES}. */
export type TerminalRequestStatus = (typeof TERMINAL_REQUEST_STATUSES)[number]

/** Whether `status` ends a request: completed, declined, cancelled or expired. */
export const isTerminalRequestStatus = (status: string): status is TerminalRequestStatus =>
  (TERMINAL_REQUEST_STATUSES as readonly string[]).includes(status)
