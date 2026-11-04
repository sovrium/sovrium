/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `SignatureRequestRepository` over the evidence tables, on either engine.
 *
 * Each move runs in one transaction that opens with its conditional
 * transition (`signature-request-queries.ts`): the transition takes the
 * request row's lock, so the chain head read after it is the head every other
 * move waits behind, and the event appended next takes the following `seq`.
 * A signature rides the transaction of the record write that stores it
 * (`SignatureEvidenceScope`), which also holds the record row's lock: two
 * signers of one record are serialised by their own writes.
 *
 * Personal data is kept in `signature_subjects` only: the send keeps each
 * signer's display name and address, with the salts that open the
 * commitments the chain records; a signature keeps her network address and
 * browser the same way.
 */

import { Effect } from 'effect'
import {
  SignatureRequestAlreadyOpen,
  SignatureRequestRepository,
  SigningSessionClosed,
  type InvitedSigner,
  type OpenSignatureRequestInput,
  type SigningSession,
} from '@/application/ports/repositories/signatures/signature-request-repository'
import { DatabaseError } from '@/domain/errors'
import { subjectCommitment } from '@/domain/models/app/signatures/signature-evidence-chain-service'
import { layerOverDatabase, type Dialect } from '@/infrastructure/database/drizzle/layer'
import { issueDeliveryLinksOn } from '@/infrastructure/database/signature-delivery-queries'
import {
  appendChainEventOn,
  insertSubjectOn,
} from '@/infrastructure/database/signature-evidence-queries'
import {
  recentRequestRowsOn,
  signersOfRequestsOn,
} from '@/infrastructure/database/signature-request-list-queries'
import {
  declineSignerOn,
  endRequestFromOn,
  hasUnendedRequestOn,
  insertRequestOn,
  insertSignerOn,
  OPEN_REQUEST_STATUSES,
  overdueRequestIdsOn,
  requestRowOn,
  sealingRequestIdsOn,
  signingSessionBySignerOn,
  signingSessionOn,
  subjectsOfSignerOn,
  unendedRequestOn,
} from '@/infrastructure/database/signature-request-queries'
import {
  contactCommitmentsOf,
  freshSalt,
  requestOf,
  sentContactOf,
  sessionOf,
  signerOf,
} from '@/infrastructure/database/signature-request-rows'
import { signWithOn } from '@/infrastructure/database/signature-request-sign-with'
import { withPromiseTransaction } from '@/infrastructure/database/transaction'
import { hashAccessToken, issueAccessToken } from '@/infrastructure/forms/access-token'
import type { PortableDb } from '@/infrastructure/database/drizzle/db'
import type { RawSqlRunner } from '@/infrastructure/database/sql/dialect-execute'

const runner = (db: PortableDb | unknown): Readonly<RawSqlRunner> => db as Readonly<RawSqlRunner>

const databaseError = (message: string) => (cause: unknown) => new DatabaseError(message, cause)

/** A transaction failure: a refusal it threw on purpose, or a database error. */
const failureOf =
  (message: string) =>
  (cause: unknown): DatabaseError | SigningSessionClosed | SignatureRequestAlreadyOpen =>
    cause instanceof SigningSessionClosed || cause instanceof SignatureRequestAlreadyOpen
      ? cause
      : new DatabaseError(message, cause)

/**
 * Keep a decline's reason on a subject row of the signer, under a fresh salt;
 * the commitment the `declined` event records in its place, or nothing when
 * she gave none. Her erasure deletes the row, and the reason with it.
 */
const recordDeclineReasonOn = async (
  tx: Readonly<RawSqlRunner>,
  dialect: Dialect,
  input: { readonly session: SigningSession; readonly nowMs: number; readonly reason?: string }
): Promise<{ readonly commitments?: { readonly reason: string } }> => {
  const { reason, session } = input
  if (reason === undefined || reason === '') return {}
  const salt = freshSalt()
  await insertSubjectOn(tx, dialect, {
    ...{ requestId: session.request.id, signerId: session.signerId },
    subject: { reason, salts: { reason: salt } },
    createdAtMs: input.nowMs,
  })
  return { commitments: { reason: subjectCommitment('reason', reason, salt) } }
}

/** Insert one signer of a request being opened, with her contact; her invitation when invited now. */
const insertOneSigner = async (
  tx: Readonly<RawSqlRunner>,
  dialect: Dialect,
  input: OpenSignatureRequestInput,
  signer: OpenSignatureRequestInput['signers'][number]
): Promise<InvitedSigner | undefined> => {
  const issued = input.invited.includes(signer.position) ? issueAccessToken() : undefined
  const signerId = crypto.randomUUID()
  await insertSignerOn(tx, dialect, {
    ...{ id: signerId, requestId: input.requestId, signerName: signer.name },
    ...{ position: signer.position, fieldName: signer.field, identityKind: input.identityKind },
    ...{ tokenHash: issued?.hash, tokenExpiresAtMs: input.expiresAtMs },
    createdAtMs: input.nowMs,
  })
  await insertSubjectOn(tx, dialect, {
    ...{ requestId: input.requestId, signerId },
    subject: {
      ...{ name: signer.displayName, email: signer.email, phone: signer.phone },
      salts: { name: freshSalt(), contact: freshSalt() },
    },
    createdAtMs: input.nowMs,
  })
  return issued === undefined
    ? undefined
    : {
        name: signer.name,
        email: signer.email,
        displayName: signer.displayName,
        token: issued.token,
      }
}

/** Open one request in one transaction; the invited signers with their tokens. */
const openRequest = async (
  tx: Readonly<RawSqlRunner>,
  dialect: Dialect,
  input: OpenSignatureRequestInput
): Promise<readonly InvitedSigner[]> => {
  const existing = await unendedRequestOn(tx, dialect, input)
  if (existing !== undefined) {
    throw new SignatureRequestAlreadyOpen({ requestId: String(existing['id']) })
  }
  await insertRequestOn(tx, dialect, {
    ...{ id: input.requestId, flowName: input.flowName, tableName: input.tableName },
    ...{ recordId: input.recordId, signingOrder: input.order, statements: input.statements },
    ...{ documentHash: input.documentHash, documentKey: input.documentKey },
    ...{ createdAtMs: input.nowMs, expiresAtMs: input.expiresAtMs },
  })
  const invited = await input.signers.reduce<Promise<readonly InvitedSigner[]>>(
    async (previous, signer) => {
      const done = await previous
      const one = await insertOneSigner(tx, dialect, input, signer)
      return one === undefined ? done : [...done, one]
    },
    Promise.resolve([])
  )
  await appendChainEventOn(tx, dialect, {
    requestId: input.requestId,
    body: input.sentEvent,
    nowMs: input.nowMs,
  })
  return invited
}

export const SignatureRequestRepositoryLive = layerOverDatabase(SignatureRequestRepository, {
  open: (db, dialect) => (input) =>
    withPromiseTransaction(
      db,
      (tx) => openRequest(runner(tx), dialect, input),
      failureOf('Failed to open a signature request')
    ).pipe(
      Effect.catchTag('SigningSessionClosed', (closed) =>
        Effect.fail(new DatabaseError('Unexpected signing refusal while opening', closed))
      ),
      Effect.withSpan('signatures.open-request', { attributes: { flow: input.flowName } })
    ),

  read: (db, dialect) => (requestId) =>
    Effect.tryPromise({
      try: () => requestRowOn(runner(db), dialect, requestId),
      catch: databaseError('Failed to read a signature request'),
    }).pipe(
      Effect.map((row) => (row === undefined ? undefined : requestOf(row))),
      Effect.withSpan('signatures.read-request-row')
    ),

  signers: (db, dialect) => (requestId) =>
    Effect.tryPromise({
      try: () => signersOfRequestsOn(runner(db), dialect, [requestId]),
      catch: databaseError('Failed to read the signers of a signature request'),
    }).pipe(
      Effect.map((rows) => rows.map(signerOf)),
      Effect.withSpan('signatures.read-request-signers')
    ),

  recent: (db, dialect) => (limit) =>
    Effect.tryPromise({
      try: async () => {
        const requests = await recentRequestRowsOn(runner(db), dialect, limit)
        const ids = requests.map((row) => String(row['id']))
        const signers = Map.groupBy(await signersOfRequestsOn(runner(db), dialect, ids), (signer) =>
          String(signer['request_id'])
        )
        return requests.map((row) => ({
          ...requestOf(row),
          signers: (signers.get(String(row['id'])) ?? []).map(signerOf),
        }))
      },
      catch: databaseError('Failed to list the signature requests'),
    }).pipe(Effect.withSpan('signatures.list-recent-requests')),

  unended: (db, dialect) => (input) =>
    Effect.tryPromise({
      try: async () => {
        const found = await unendedRequestOn(runner(db), dialect, input)
        return found === undefined
          ? undefined
          : requestRowOn(runner(db), dialect, String(found['id']))
      },
      catch: databaseError('Failed to read the open request of a record'),
    }).pipe(
      Effect.map((row) => (row === undefined ? undefined : requestOf(row))),
      Effect.withSpan('signatures.read-unended-request')
    ),

  hasUnended: (db, dialect) => (input) =>
    Effect.tryPromise({
      try: () => hasUnendedRequestOn(runner(db), dialect, input),
      catch: databaseError('Failed to tell whether a record has an open request'),
    }).pipe(Effect.withSpan('signatures.has-unended-request')),

  session: (db, dialect) => (token) =>
    Effect.tryPromise({
      try: () => signingSessionOn(runner(db), dialect, hashAccessToken(token)),
      catch: databaseError('Failed to read a signing session'),
    }).pipe(
      Effect.map((row) => (row === undefined ? undefined : sessionOf(row))),
      Effect.withSpan('signatures.read-signing-session')
    ),

  sessionOfSigner: (db, dialect) => (signerId) =>
    Effect.tryPromise({
      try: () => signingSessionBySignerOn(runner(db), dialect, signerId),
      catch: databaseError('Failed to read a signing session'),
    }).pipe(
      Effect.map((row) => (row === undefined ? undefined : sessionOf(row))),
      Effect.withSpan('signatures.read-signing-session-of-signer')
    ),

  signWith: signWithOn,

  decline: (db, dialect) => (input) =>
    Effect.gen(function* () {
      const contact = sentContactOf(
        yield* Effect.tryPromise({
          try: () => subjectsOfSignerOn(runner(db), dialect, input.session.signerId),
          catch: databaseError('Failed to read the contact of a signer'),
        })
      )
      const { contactCommitment } = contactCommitmentsOf(contact)
      return yield* withPromiseTransaction(
        db,
        async (tx) => {
          const on = runner(tx)
          const requestId = input.session.request.id
          if ((await declineSignerOn(on, dialect, input.session.signerId)).length === 0) {
            throw new SigningSessionClosed({ reason: 'already-signed' })
          }
          const ended = await endRequestFromOn(on, dialect, {
            ...{ requestId, from: OPEN_REQUEST_STATUSES, status: 'declined' },
            ...{ endedAtMs: input.nowMs, keepUntilMs: input.keepUntilMs },
          })
          if (ended.length === 0) throw new SigningSessionClosed({ reason: 'ended' })
          const commitments = await recordDeclineReasonOn(on, dialect, input)
          return appendChainEventOn(on, dialect, {
            requestId,
            body: {
              ...input.event,
              data: { ...input.event.data, contactCommitment, ...commitments },
            },
            nowMs: input.nowMs,
          })
        },
        failureOf('Failed to decline a signature request')
      ).pipe(
        Effect.catchTag('SignatureRequestAlreadyOpen', (open) =>
          Effect.fail(new DatabaseError('Unexpected open request while declining', open))
        )
      )
    }).pipe(Effect.withSpan('signatures.decline-request')),

  end: (db, dialect) => (input) =>
    withPromiseTransaction(
      db,
      async (tx) => {
        const on = runner(tx)
        const ended = await endRequestFromOn(on, dialect, {
          ...{ requestId: input.requestId, from: input.from, status: input.status },
          ...{ endedAtMs: input.nowMs, keepUntilMs: input.keepUntilMs },
          sealLevel: input.sealLevel,
        })
        if (ended.length === 0) return undefined
        // One after the other: each takes the head the previous one left.
        await (input.before ?? []).reduce(
          (previous, body) =>
            previous.then(() =>
              appendChainEventOn(on, dialect, {
                ...{ requestId: input.requestId, body, nowMs: input.nowMs },
              })
            ),
          Promise.resolve<unknown>(undefined)
        )
        return appendChainEventOn(on, dialect, {
          ...{ requestId: input.requestId, body: input.event, nowMs: input.nowMs },
        })
      },
      databaseError('Failed to end a signature request')
    ).pipe(Effect.withSpan('signatures.end-request', { attributes: { status: input.status } })),

  overdue: (db, dialect) => (nowMs) =>
    Effect.tryPromise({
      try: () => overdueRequestIdsOn(runner(db), dialect, nowMs),
      catch: databaseError('Failed to list the overdue signature requests'),
    }).pipe(Effect.withSpan('signatures.list-overdue-requests')),

  issueDeliveryLinks: (db, dialect) => (input) =>
    withPromiseTransaction(
      db,
      (tx) => issueDeliveryLinksOn(runner(tx), dialect, input),
      databaseError('Failed to issue the delivery links of a signature request')
    ).pipe(Effect.withSpan('signatures.issue-delivery-links')),

  sealing: (db, dialect) =>
    Effect.tryPromise({
      try: () => sealingRequestIdsOn(runner(db), dialect),
      catch: databaseError('Failed to list the signature requests being sealed'),
    }).pipe(Effect.withSpan('signatures.list-sealing-requests')),
})
