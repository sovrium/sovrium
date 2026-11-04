/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `SignatureChallengeRepository` over the evidence tables and the shared token
 * store, on either engine.
 *
 * An address budget is keyed by an HMAC of the address under a key derived
 * from the install's root secret: stable across restarts, unique per install,
 * and no address is ever stored in clear.
 */

import { createHmac } from 'node:crypto'
import { Effect } from 'effect'
import {
  SignatureChallengeRepository,
  type SignatureCodeChannel,
} from '@/application/ports/repositories/signatures/signature-challenge-repository'
import { DatabaseError } from '@/domain/errors'
import { deriveSubkey } from '@/infrastructure/crypto/root-secret'
import { layerOverDatabase } from '@/infrastructure/database/drizzle/layer'
import {
  epochOf,
  issueChallengeWithinBudgetsOn,
} from '@/infrastructure/database/signature-challenge-issue'
import {
  addressEventCountOn,
  challengeRowOn,
  challengeStandingOn,
  consumeChallengeOn,
  countChallengeTryOn,
  expireChallengeAtBirthOn,
  insertAddressEventOn,
  signingAddressIdentifier,
  verifiedChallengeCountOn,
} from '@/infrastructure/database/signature-challenge-queries'
import { appendChainEventOn } from '@/infrastructure/database/signature-evidence-queries'
import { subjectsOfSignerOn } from '@/infrastructure/database/signature-request-queries'
import { optionalString, sentContactOf } from '@/infrastructure/database/signature-request-rows'
import { withPromiseTransaction } from '@/infrastructure/database/transaction'
import type { PortableDb } from '@/infrastructure/database/drizzle/db'
import type { RawSqlRunner } from '@/infrastructure/database/sql/dialect-execute'

const runner = (db: PortableDb | unknown): Readonly<RawSqlRunner> => db as Readonly<RawSqlRunner>

const databaseError = (message: string) => (cause: unknown) => new DatabaseError(message, cause)

/** The purpose the address-digest key is derived for; changing it re-keys every budget. */
const ADDRESS_DIGEST_PURPOSE = 'sovrium-signing-address-digest'

let addressKey: Buffer | undefined

/** The digest an address budget is keyed by; the key is derived once per process. */
const addressDigest = (address: string): string => {
  addressKey ??= deriveSubkey(ADDRESS_DIGEST_PURPOSE)
  return createHmac('sha256', addressKey).update(address).digest('hex')
}

export const SignatureChallengeRepositoryLive = layerOverDatabase(SignatureChallengeRepository, {
  destination: (db, dialect) => (signerId) =>
    Effect.tryPromise({
      try: () => subjectsOfSignerOn(runner(db), dialect, signerId),
      catch: databaseError('Failed to read the address of a signer'),
    }).pipe(
      Effect.map((rows) => sentContactOf(rows).email),
      Effect.withSpan('signatures.read-code-destination')
    ),

  phoneDestination: (db, dialect) => (signerId) =>
    Effect.tryPromise({
      try: () => subjectsOfSignerOn(runner(db), dialect, signerId),
      catch: databaseError('Failed to read the phone of a signer'),
    }).pipe(
      Effect.map((rows) => sentContactOf(rows).phone),
      Effect.withSpan('signatures.read-code-phone')
    ),

  hasVerified: (db, dialect) => (input) =>
    Effect.tryPromise({
      try: () => verifiedChallengeCountOn(runner(db), dialect, input),
      catch: databaseError('Failed to read the verified codes of a signer'),
    }).pipe(
      Effect.map((verified) => verified > 0),
      Effect.withSpan('signatures.read-verified-code', { attributes: { channel: input.channel } })
    ),

  consumeVerified: (db, dialect) => (input) =>
    withPromiseTransaction(
      db,
      async (tx) => {
        const consumed = await consumeChallengeOn(runner(tx), dialect, input)
        if (consumed.length === 0) return false
        await appendChainEventOn(runner(tx), dialect, {
          ...{ requestId: input.requestId, body: input.event, nowMs: input.nowMs },
        })
        return true
      },
      databaseError('Failed to consume a verified code')
    ).pipe(Effect.withSpan('signatures.consume-verified-code')),

  issueWithinBudgets: (db, dialect) => (input) =>
    withPromiseTransaction(
      db,
      (tx) =>
        issueChallengeWithinBudgetsOn(runner(tx), dialect, {
          ...{ requestId: input.requestId, challenge: input.challenge, refuse: input.refuse },
          addressIdentifier: signingAddressIdentifier(input.event, addressDigest(input.address)),
          ...{ nowMs: input.nowMs, sinceMs: input.sinceMs, untilMs: input.untilMs },
        }),
      databaseError('Failed to record a code')
    ).pipe(
      Effect.withSpan('signatures.record-code', {
        attributes: { channel: input.challenge.channel },
      })
    ),

  expireAtBirth: (db, dialect) => (input) =>
    withPromiseTransaction(
      db,
      (tx) => expireChallengeAtBirthOn(runner(tx), dialect, input),
      databaseError('Failed to expire an undelivered code')
    ).pipe(Effect.withSpan('signatures.expire-undelivered-code')),

  find: (db, dialect) => (challengeId) =>
    Effect.tryPromise({
      try: () => challengeRowOn(runner(db), dialect, challengeId),
      catch: databaseError('Failed to read a code'),
    }).pipe(
      Effect.map((row) =>
        row === undefined
          ? undefined
          : {
              id: String(row['id']),
              signerId: String(row['signer_id']),
              channel: String(row['channel']) as SignatureCodeChannel,
              codeHmac: String(row['code_hmac']),
              expiresAtMs: epochOf(row['expires_at']) ?? 0,
              consumed: epochOf(row['consumed_at']) !== undefined,
              documentHash: optionalString(row['document_hash']),
            }
      ),
      Effect.withSpan('signatures.read-code')
    ),

  countTry: (db, dialect) => (input) =>
    Effect.tryPromise({
      try: async () => {
        await countChallengeTryOn(runner(db), dialect, input.challengeId)
        const rows = await challengeStandingOn(runner(db), dialect, input)
        return Number(rows[0]?.['attempts'] ?? 0)
      },
      catch: databaseError('Failed to count a code try'),
    }).pipe(Effect.withSpan('signatures.count-code-try')),

  addressEvents: (db, dialect) => (input) =>
    Effect.tryPromise({
      try: () =>
        addressEventCountOn(runner(db), dialect, {
          identifier: signingAddressIdentifier(input.event, addressDigest(input.address)),
          sinceMs: input.sinceMs,
          nowMs: input.nowMs,
        }),
      catch: databaseError('Failed to read an address budget'),
    }).pipe(
      Effect.withSpan('signatures.read-address-budget', { attributes: { event: input.event } })
    ),

  recordAddressEvent: (db, dialect) => (input) =>
    Effect.tryPromise({
      try: () =>
        insertAddressEventOn(runner(db), dialect, {
          id: crypto.randomUUID(),
          identifier: signingAddressIdentifier(input.event, addressDigest(input.address)),
          nowMs: input.nowMs,
          untilMs: input.untilMs,
        }),
      catch: databaseError('Failed to count against an address budget'),
    }).pipe(
      Effect.asVoid,
      Effect.withSpan('signatures.record-address-budget', { attributes: { event: input.event } })
    ),
})
