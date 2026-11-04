/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `captureSignature` — the one writer of a value into a `signature` field.
 *
 * A signed-in person signs a record's field from a `signature-pad`. She sends
 * her consent, the drawing as PNG bytes (or a typed name), the page the pad was
 * shown on and the digest of the statement she read. The server authors the
 * rest:
 *
 * 1. consent is required (`CONSENT_REQUIRED`);
 * 2. the record is read as she may read it, and the statement is resolved from
 *    every pad of that page bound to the field, against the record as it stands
 *    now; one must hash to her digest, or the page changed (`STATEMENT_CHANGED`);
 * 3. the image is checked (a PNG within the size and dimension limits,
 *    `IMAGE_INVALID`) and stored create-only under the evidence namespace, in
 *    the bucket the field resolves to, recorded as her upload;
 * 4. the value is version 2, stamped with the server's instant and a new
 *    evidence id, and identified by her account;
 * 5. it is written through the ordinary update road, so the write-once rule,
 *    the compare-and-set that settles two first signatures racing, the
 *    automations and the webhooks all apply.
 *
 * Who may sign (the field's write permission) is the route's to judge before
 * this runs. The evidence entry is the {@link SignatureEvidenceRecorder}'s to
 * write when one is provided, inside the update's own transaction: the value
 * and its evidence commit together or not at all.
 */

import { Data, Effect, Option } from 'effect'
import { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import { SignatureEvidenceRecorder } from '@/application/ports/services/signature-evidence-recorder'
import { StorageService } from '@/application/ports/services/storage-service'
import { recordWriteRequester } from '@/application/use-cases/tables/record-create-orchestration'
import { updateRecordWithSideEffects } from '@/application/use-cases/tables/record-write-roads'
import { engineAuthoredSignature } from '@/application/use-cases/tables/signature-write-once-check'
import { NotFoundError } from '@/domain/errors'
import { SYSTEM_BUCKET_NAME } from '@/domain/models/app/buckets/bucket-identity'
import { resolveFieldBucket } from '@/domain/models/app/buckets/field-bucket'
import { substituteRecordVars } from '@/domain/models/app/pages/substitute-record-vars'
import {
  capturedSignatureValue,
  isAcceptableSignatureImage,
  padStatementsIn,
  signatureEvidenceImageKey,
  statementShown,
} from '@/domain/models/app/signatures/signature-capture-service'
import { sha256Hex } from '@/domain/models/app/signatures/signature-evidence-chain-service'
import { nowInstant } from './signature-request-effects'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { LinkReader } from '@/application/use-cases/tables/linked-row-visibility'
import type { SignatureValueV2 } from '@/domain/models/api/signatures/common'
import type { App } from '@/domain/models/app'

/** A refusal the signer can act on, by its contract code. */
export class SignatureCaptureRefusal extends Data.TaggedError('SignatureCaptureRefusal')<{
  readonly code: 'CONSENT_REQUIRED' | 'IMAGE_INVALID' | 'STATEMENT_CHANGED'
  readonly message: string
}> {}

/** One signature, as the signer gave it and the route decoded it. */
export interface CaptureSignatureInput {
  readonly app: App
  readonly session: Readonly<UserSession>
  readonly userRole: string
  readonly userGroups: readonly string[]
  readonly tableName: string
  readonly recordId: string
  readonly field: string
  readonly consent: boolean
  readonly method: 'drawn' | 'typed'
  /** The name she typed, when `method` is `typed`. */
  readonly typedName?: string | undefined
  /** The PNG of the mark; required when `method` is `drawn`. */
  readonly image?: Uint8Array | undefined
  /** The declared page the pad was shown on. */
  readonly page: string
  /** SHA-256 of the statement as she read it. */
  readonly statementDigest: string
  readonly linkReader?: LinkReader | undefined
  readonly origin?: string | undefined
  /** Forgets derived variants of a stored file the write replaced (none for a signature). */
  readonly forgetDerivedVariants: (key: string) => void
  /** The request's network address and browser, kept as evidence (committed, never in the cell). */
  readonly network?:
    { readonly ipAddress?: string | undefined; readonly userAgent?: string | undefined } | undefined
}

const refuse = (code: SignatureCaptureRefusal['code'], message: string) =>
  Effect.fail(new SignatureCaptureRefusal({ code, message }))

/** The record she may read, or the uniform not-found. */
const readableRecord = (input: CaptureSignatureInput) =>
  Effect.gen(function* () {
    const repo = yield* TableRepository
    const row = yield* repo.getRecord(input.session, input.tableName, input.recordId)
    return row === null
      ? yield* Effect.fail(new NotFoundError('Record not found', input.recordId))
      : row
  })

/** The statement she was shown, resolved by the server from the page she names. */
const shownStatement = (input: CaptureSignatureInput, record: Readonly<Record<string, unknown>>) =>
  Effect.gen(function* () {
    const page = input.app.pages?.find((candidate) => candidate.name === input.page)
    if (page === undefined) return yield* Effect.fail(new NotFoundError('Page not found'))
    // A pad may sit in the page itself or in a component template it places.
    const resolved = [
      ...padStatementsIn(page, input.field),
      ...padStatementsIn(input.app.components, input.field),
    ].map((declared) => substituteRecordVars(declared, record))
    const statement = statementShown(resolved, input.statementDigest)
    return statement === undefined
      ? yield* refuse('STATEMENT_CHANGED', 'The statement changed since the page was read')
      : statement
  })

/** The checked image, or none for a typed signature that sent none. */
const checkedImage = (input: CaptureSignatureInput) => {
  const { image } = input
  if (image === undefined && input.method === 'typed') return Effect.succeed(image)
  return image !== undefined && isAcceptableSignatureImage(image)
    ? Effect.succeed(image)
    : refuse('IMAGE_INVALID', 'The signature must be a PNG within the size and dimension limits')
}

/** Store the image create-only under the evidence key; its key, or `''` when there is none. */
const storeImage = (
  input: CaptureSignatureInput,
  image: Uint8Array | undefined,
  evidenceId: string
) =>
  Effect.gen(function* () {
    if (image === undefined) return ''
    const storage = yield* StorageService
    const key = signatureEvidenceImageKey(evidenceId)
    const bucket = resolveFieldBucket(input.app, input.tableName, input.field) ?? SYSTEM_BUCKET_NAME
    yield* storage.upload(key, image, 'image/png', {
      ...{ bucket, uploadedById: input.session.userId },
      mode: 'create-only',
    })
    return key
  })

/** Her account's name and address, as the account holds them. */
const accountContactOf = (input: CaptureSignatureInput) =>
  Effect.gen(function* () {
    const auth = yield* AuthRepository
    return yield* auth.findUserContactById(input.session.userId)
  })

/** The name the signature carries: the one she typed, else her account's. */
const signerNameOf = (input: CaptureSignatureInput, accountName: string | undefined): string =>
  input.method === 'typed' && input.typedName !== undefined ? input.typedName : (accountName ?? '')

/**
 * Run `write`, the update storing `value`, with its evidence written in the
 * same transaction when the server provides a recorder; on its own otherwise.
 */
const withEvidence = <A, E, R>(
  input: CaptureSignatureInput,
  evidence: {
    readonly value: SignatureValueV2
    readonly image: Uint8Array | undefined
    readonly email: string | undefined
  },
  write: Effect.Effect<A, E, R>
) =>
  Effect.flatMap(Effect.serviceOption(SignatureEvidenceRecorder), (recorder) =>
    Option.isNone(recorder)
      ? write
      : recorder.value.recordWith(
          {
            ...{ tableName: input.tableName, recordId: input.recordId, field: input.field },
            value: evidence.value,
            markSha256: evidence.image === undefined ? undefined : sha256Hex(evidence.image),
            subject: {
              ...{ email: evidence.email, ipAddress: input.network?.ipAddress },
              userAgent: input.network?.userAgent,
            },
          },
          write
        )
  )

/** Capture one signature into a record's field; resolves the value stored. */
export const captureSignature = (input: CaptureSignatureInput) =>
  Effect.gen(function* () {
    if (!input.consent) {
      return yield* refuse('CONSENT_REQUIRED', 'Agree to the statement before signing')
    }
    const record = yield* readableRecord(input)
    const statement = yield* shownStatement(input, record)
    const image = yield* checkedImage(input)
    const evidenceId = crypto.randomUUID()
    const signedAt = (yield* nowInstant).iso
    const contact = yield* accountContactOf(input)
    const value = capturedSignatureValue({
      ...{ evidenceId, signedAt, statement, method: input.method },
      image: yield* storeImage(input, image, evidenceId),
      signerName: signerNameOf(input, contact?.name),
      userId: input.session.userId,
    })
    const { session, app, tableName, recordId, userRole, userGroups } = input
    const write = updateRecordWithSideEffects({
      ...{ session, app, tableName, recordId, userRole, userGroups },
      fields: { [input.field]: engineAuthoredSignature(value) },
      requester: recordWriteRequester(session.userId, userRole),
      forgetDerivedVariants: input.forgetDerivedVariants,
      ...(input.linkReader === undefined ? {} : { linkReader: input.linkReader }),
      ...(input.origin === undefined ? {} : { origin: input.origin }),
    })
    yield* withEvidence(input, { value, image, email: contact?.email }, write)
    return value
  }).pipe(
    Effect.withSpan('signatures.capture-signature', {
      attributes: { tableName: input.tableName, field: input.field },
    })
  )
