/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sendSignatureRequest` — open a signing request for one record of a flow.
 *
 * 1. The record is read as the engine; a record that already has a request of
 *    this flow that has not ended is refused (`request-open`), and so is one
 *    whose document field holds no file (`document-missing`).
 * 2. The document is read (at most one byte past the limit) and put through
 *    the intake: refused when too large, too long, damaged, encrypted,
 *    already signed, active or layered; otherwise rewritten once into the
 *    copy every signer signs, whose SHA-256 is the request's document hash.
 * 3. The copy is stored create-only under the request's evidence key, where
 *    no delete road reaches it before the evidence's retention ends.
 * 4. The statement is resolved once, in the app's default language, against
 *    the record as it stands, and frozen per signer; each signer's address
 *    and name are read from the record once.
 * 5. The request, its signers, their contacts and the `sent` event are
 *    written in one transaction; the first signer (every signer, in parallel)
 *    receives her link by mail; the status `sent` is written into the record.
 *
 * Nothing is mailed and nothing is written for a refused send.
 */

import { Data, Effect } from 'effect'
import { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import { SignatureEvidenceRepository } from '@/application/ports/repositories/signatures/signature-evidence-repository'
import { SignatureRequestRepository } from '@/application/ports/repositories/signatures/signature-request-repository'
import { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import { SignatureDocumentIntake } from '@/application/ports/services/signature-document-intake'
import {
  isStorageObjectTooLarge,
  StorageService,
  UNATTRIBUTED_BUCKET,
} from '@/application/ports/services/storage-service'
import { buildSystemSession } from '@/application/use-cases/automations/build-guest-session'
import { checkSignerPlacements } from '@/application/use-cases/signatures/placement-check'
import { durationToMs } from '@/domain/kernel/time/parse-duration'
import { SYSTEM_BUCKET_NAME } from '@/domain/models/app/buckets/bucket-identity'
import { resolveFieldBucket } from '@/domain/models/app/buckets/field-bucket'
import { defaultLanguageTranslator } from '@/domain/models/app/languages/translation-resolver'
import { substituteRecordVars } from '@/domain/models/app/pages/substitute-record-vars'
import { DEFAULT_SIGNATURE_EXPIRES } from '@/domain/models/app/signatures/signature'
import { signatureRequestEvidenceKey } from '@/domain/models/app/signatures/signature-capture-service'
import { sha256Hex } from '@/domain/models/app/signatures/signature-evidence-chain-service'
import {
  frozenSigners,
  MAX_SIGNATURE_DOCUMENT_BYTES,
  positionsInvitedAtSend,
  signatureFlowNamed,
  signatureTriggerPayload,
  signerWithoutContact,
  signerWithoutPhone,
  signerAccountLinks,
  type FrozenSigner,
  type SignatureSendRefusalCode,
  type SignatureTriggerPayload,
} from '@/domain/models/app/signatures/signature-request-service'
import {
  mailSigningLinks,
  nowInstant,
  writeFlowStatus,
  type FlowRecordWriter,
  type SignatureFlowOf,
} from './signature-request-effects'
import type { App } from '@/domain/models/app'

/** Why a send started no request, by the code a later step reads. */
export class SignatureSendRefusal extends Data.TaggedError('SignatureSendRefusal')<{
  readonly code: SignatureSendRefusalCode
  readonly message: string
}> {}

/** A request just sent: its id, its status, and what its `sent` trigger receives. */
export interface SentSignatureRequest {
  readonly requestId: string
  readonly status: 'sent'
  readonly flow: SignatureFlowOf
  readonly trigger: SignatureTriggerPayload
}

const refuse = (code: SignatureSendRefusalCode, message: string) =>
  Effect.fail(new SignatureSendRefusal({ code, message }))

/** The storage key a single-attachment cell names: the key itself, or a stored file's `key`. */
const storedKeyOf = (cell: unknown): string | undefined => {
  if (typeof cell === 'string') return cell.trim() === '' ? undefined : cell
  if (typeof cell === 'object' && cell !== null) {
    const { key } = cell as { readonly key?: unknown }
    return typeof key === 'string' && key !== '' ? key : undefined
  }
  return undefined
}

/** The record the request is for, read as the engine, and the flow it runs. */
const flowAndRecord = (app: App, flowName: string, recordId: string) =>
  Effect.gen(function* () {
    const flow = signatureFlowNamed(app, flowName)
    if (flow === undefined) {
      return yield* refuse('flow-unknown', `no signing flow is named ${flowName}`)
    }
    const tables = yield* TableRepository
    const record = yield* tables.getRecord(buildSystemSession(), flow.table, recordId)
    if (record === null) {
      return yield* refuse('record-missing', `${flow.table} has no record ${recordId}`)
    }
    return { flow, record }
  })

/** The frozen copy of the record's document, refused as the intake says. */
const frozenDocument = (
  app: App,
  flow: SignatureFlowOf,
  record: Readonly<Record<string, unknown>>
) =>
  Effect.gen(function* () {
    const { field } = flow.document
    const key = storedKeyOf(record[field])
    if (key === undefined) {
      return yield* refuse('document-missing', `${field} holds no document to sign`)
    }
    const storage = yield* StorageService
    const bucket = resolveFieldBucket(app, flow.table, field) ?? SYSTEM_BUCKET_NAME
    const bytes = yield* storage
      .downloadBounded(key, bucket, MAX_SIGNATURE_DOCUMENT_BYTES)
      .pipe(
        Effect.catch((error) =>
          isStorageObjectTooLarge(error)
            ? refuse('document-too-large', 'the document is larger than 25 MiB')
            : refuse('document-missing', `${field} names a file that cannot be read`)
        )
      )
    const intake = yield* SignatureDocumentIntake
    const prepared = yield* intake
      .prepare(bytes)
      .pipe(
        Effect.catchTag('SignatureDocumentRefusal', (refusal) =>
          refuse(refusal.code, refusal.message)
        )
      )
    // Each signer's mark must fit the frozen copy before anything is stored or mailed.
    yield* checkSignerPlacements(flow, prepared.bytes).pipe(
      Effect.catchTags({
        SignaturePlacementRefusal: (refusal) => refuse(refusal.code, refusal.message),
        SignaturePdfFailure: (failure) => refuse('document-malformed', failure.message),
      })
    )
    return prepared
  })

/** What a send freezes from the record: the statement and each signer's contact. */
const frozenFromRecord = (
  app: App,
  flow: SignatureFlowOf,
  record: Readonly<Record<string, unknown>>
) => {
  const resolve = (template: string) => substituteRecordVars(template, record)
  const statement = resolve(defaultLanguageTranslator(app.languages)(flow.statement))
  const signers = frozenSigners(flow, resolve)
  const unreachable = signerWithoutContact(signers)
  if (unreachable !== undefined) {
    return refuse(
      'signer-contact-missing',
      `${unreachable.name} has no address to send her link to`
    )
  }
  const phoneless = signerWithoutPhone(flow, signers)
  return phoneless === undefined
    ? Effect.succeed({ statement, signers })
    : refuse(
        'signer-contact-missing',
        `${phoneless.name} has no phone in international format to text her codes to`
      )
}

/** Store the frozen copy create-only under the request's evidence; its key and fingerprint. */
const storedDocument = (requestId: string, bytes: Uint8Array) =>
  Effect.gen(function* () {
    const documentKey = signatureRequestEvidenceKey(requestId, 'document.pdf')
    yield* (yield* StorageService).upload(documentKey, bytes, 'application/pdf', {
      ...{ bucket: UNATTRIBUTED_BUCKET, uploadedById: undefined, mode: 'create-only' },
    })
    return { documentKey, documentHash: sha256Hex(bytes) }
  })

/** How a flow's signers prove who they are: the first channel they verify, or nothing. */
const identityKindOf = (flow: SignatureFlowOf): 'email-otp' | 'sms-otp' | 'anonymous' => {
  if (flow.verify?.email === true) return 'email-otp'
  return flow.verify?.sms === undefined ? 'anonymous' : 'sms-otp'
}

/** What one send opens: the request row and everything it holds. */
interface Opening {
  readonly flow: SignatureFlowOf
  readonly recordId: string
  readonly requestId: string
  readonly document: { readonly pages: number }
  readonly stored: { readonly documentKey: string; readonly documentHash: string }
  readonly frozen: { readonly statement: string; readonly signers: readonly FrozenSigner[] }
}

/** Open the request in one transaction; the signers it invited. */
const openRequest = (opening: Opening, openMessage: string) =>
  Effect.gen(function* () {
    const { flow, frozen, stored } = opening
    const now = yield* nowInstant
    const expiresAtMs = now.ms + (durationToMs(flow.expires ?? DEFAULT_SIGNATURE_EXPIRES) ?? 0)
    const order = flow.order ?? 'sequential'
    const invited = yield* (yield* SignatureRequestRepository)
      .open({
        ...{ flowName: flow.name, tableName: flow.table, recordId: opening.recordId },
        ...{ requestId: opening.requestId, order, ...stored, nowMs: now.ms, expiresAtMs },
        signers: frozen.signers,
        statements: Object.fromEntries(frozen.signers.map((one) => [one.name, frozen.statement])),
        identityKind: identityKindOf(flow),
        invited: positionsInvitedAtSend(order, frozen.signers.length),
        sentEvent: {
          ...{ type: 'sent', at: now.iso },
          data: {
            ...{ flow: flow.name, order, documentHash: stored.documentHash },
            ...{ pages: opening.document.pages, statementDigest: sha256Hex(frozen.statement) },
            signers: frozen.signers.map((one) => one.name),
            expiresAt: new Date(expiresAtMs).toISOString(),
          },
        },
      })
      .pipe(
        Effect.catchTag('SignatureRequestAlreadyOpen', () => refuse('request-open', openMessage))
      )
    return { invited, expiresAt: new Date(expiresAtMs).toISOString() }
  })

/**
 * Link each signer whose address an account holds to that account, so her
 * signature reaches her data export and her account's erasure. How she
 * proves who she is when she signs does not change.
 */
const linkSignerAccounts = (requestId: string, signers: readonly FrozenSigner[]) =>
  Effect.gen(function* () {
    const emails = signers.map((signer) => signer.email.trim().toLowerCase())
    const accounts = yield* (yield* AuthRepository).findUserIdsByEmails(emails)
    const evidence = yield* SignatureEvidenceRepository
    yield* Effect.forEach(
      signerAccountLinks(signers, accounts),
      (link) => evidence.linkSignerAccount({ requestId, ...link }),
      { discard: true }
    )
  })

/** Send the request of `flowName` for record `recordId`. */
export const sendSignatureRequest = <R>(input: {
  readonly app: App
  readonly flowName: string
  readonly recordId: string
  readonly writer: FlowRecordWriter<R>
}) =>
  Effect.gen(function* () {
    const { app, recordId } = input
    const { flow, record } = yield* flowAndRecord(app, input.flowName, recordId)
    const scope = { flowName: flow.name, tableName: flow.table, recordId }
    const openMessage = `the record already has an open signing request for ${flow.name}`
    if ((yield* (yield* SignatureRequestRepository).unended(scope)) !== undefined) {
      return yield* refuse('request-open', openMessage)
    }
    const document = yield* frozenDocument(app, flow, record)
    const frozen = yield* frozenFromRecord(app, flow, record)
    const requestId = crypto.randomUUID()
    const stored = yield* storedDocument(requestId, document.bytes)
    const opened = yield* openRequest(
      { flow, recordId, requestId, document, stored, frozen },
      openMessage
    )
    yield* linkSignerAccounts(requestId, frozen.signers)
    yield* writeFlowStatus(input.writer, { app, flow, recordId }, 'sent')
    yield* mailSigningLinks({ app, flow, invited: opened.invited, expiresAt: opened.expiresAt })
    return {
      ...{ requestId, status: 'sent' as const, flow },
      trigger: signatureTriggerPayload({ requestId, event: 'sent', status: 'sent' }),
    } satisfies SentSignatureRequest
  }).pipe(Effect.withSpan('signatures.send-request', { attributes: { flow: input.flowName } }))
