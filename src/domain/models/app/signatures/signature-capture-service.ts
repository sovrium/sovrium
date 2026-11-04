/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What the server decides when a signature is captured: whether the drawing it
 * was sent is an image it will keep, which statement the signer was shown, where
 * the image is kept, and the value stored in the `signature` field.
 *
 * The client sends PNG bytes, its consent, a typed name, the page the pad was
 * shown on and the digest of the statement it read. Everything else in the
 * stored value is authored here: the statement comes from the page's own
 * declaration resolved against the record, never from the request; the instant
 * and the evidence id are the server's.
 *
 * Pure: the caller reads the record, the clock and the bytes.
 */

import { createHash } from 'node:crypto'
import { pictureDimensions } from '@/domain/kernel/identity/picture-dimensions'
import {
  MAX_SIGNATURE_IMAGE_BYTES,
  MAX_SIGNATURE_IMAGE_HEIGHT,
  MAX_SIGNATURE_IMAGE_WIDTH,
} from '@/domain/models/api/signatures/sign'
import type { SignatureValueV2 } from '@/domain/models/api/signatures/common'

/** The storage namespace every captured signature image is kept under. */
export const SIGNATURE_EVIDENCE_KEY_PREFIX = 'signature-evidence/'

/**
 * Where a signing request keeps its evidence files: the frozen document, the
 * signed document, the proof file and the signers' marks, each under
 * `signature-evidence/requests/<requestId>/`.
 */
export const SIGNATURE_REQUEST_EVIDENCE_PREFIX = `${SIGNATURE_EVIDENCE_KEY_PREFIX}requests/`

/** The storage key of the evidence file `name` of request `requestId`. */
export const signatureRequestEvidenceKey = (requestId: string, name: string): string =>
  `${SIGNATURE_REQUEST_EVIDENCE_PREFIX}${requestId}/${name}`

/**
 * Whether `key` is evidence a signing request holds, kept until the request's
 * retention ends: never removed by a record purge or an account erasure (nor
 * by the roads {@link isSignatureNamespaceKey} closes), and removed by the
 * retention sweep alone. A leading slash, which no stored key carries,
 * is read as the same key so it cannot slip past.
 *
 * The mark of a signature captured on a record (`signature-evidence/<id>.png`)
 * is not: it belongs to no flow and has no declared retention, so it follows
 * its record and its signer.
 */
export const isSignatureEvidenceKey = (key: string): boolean =>
  key.replace(/^\/+/, '').startsWith(SIGNATURE_REQUEST_EVIDENCE_PREFIX)

/**
 * Whether `key` is any file of the signature namespace: a signing request's
 * evidence, or the mark of a signature captured on a record. Such a file is
 * written by the signing path alone and leaves with its own lifecycle (the
 * retention sweep, its record's purge, its signer's erasure), never through a
 * road that merely replaces, removes or writes a file: a replaced attachment,
 * the bucket delete route, a `file` step, a document step's output key.
 */
export const isSignatureNamespaceKey = (key: string): boolean =>
  key.replace(/^\/+/, '').startsWith(SIGNATURE_EVIDENCE_KEY_PREFIX)

/**
 * The flow name a signature captured on a record is recorded under: the field
 * it was given in, behind a prefix no declared flow name can carry. Such a
 * request belongs to no flow and declares no retention of its own: its
 * evidence follows its record and its signer.
 */
export const RECORD_CAPTURE_FLOW_PREFIX = 'field:'

/** The flow name of a signature captured on a record's `field`. */
export const recordCaptureFlowName = (field: string): string =>
  `${RECORD_CAPTURE_FLOW_PREFIX}${field}`

/** Whether a request's flow name is that of a signature captured on a record. */
export const isRecordCaptureFlowName = (flowName: string): boolean =>
  flowName.startsWith(RECORD_CAPTURE_FLOW_PREFIX)

/** The storage key of the image of the signature recorded as `evidenceId`. */
export const signatureEvidenceImageKey = (evidenceId: string): string =>
  `${SIGNATURE_EVIDENCE_KEY_PREFIX}${evidenceId}.png`

/** The eight bytes every PNG file opens with. */
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const

/**
 * Whether `bytes` are a PNG the server keeps as a signature: the PNG signature
 * and header, at most {@link MAX_SIGNATURE_IMAGE_BYTES} bytes, and at most
 * {@link MAX_SIGNATURE_IMAGE_WIDTH} by {@link MAX_SIGNATURE_IMAGE_HEIGHT} pixels.
 */
export const isAcceptableSignatureImage = (bytes: Uint8Array): boolean => {
  if (bytes.length === 0 || bytes.length > MAX_SIGNATURE_IMAGE_BYTES) return false
  if (!PNG_MAGIC.every((byte, index) => bytes[index] === byte)) return false
  const size = pictureDimensions(bytes)
  return (
    size !== undefined &&
    size.width <= MAX_SIGNATURE_IMAGE_WIDTH &&
    size.height <= MAX_SIGNATURE_IMAGE_HEIGHT
  )
}

/** The SHA-256 of a statement, lowercase hex: what a page hands its pad, and the pad sends back. */
export const statementDigest = (statement: string): string =>
  createHash('sha256').update(statement, 'utf8').digest('hex')

/**
 * The statement of every `signature-pad` bound to `field` anywhere in `tree`
 * (a page, or the app's component templates), as declared. A pad declaring no
 * statement shows an empty one.
 */
export const padStatementsIn = (tree: unknown, field: string): readonly string[] => {
  if (Array.isArray(tree)) return tree.flatMap((item: unknown) => padStatementsIn(item, field))
  if (tree === null || typeof tree !== 'object') return []
  const node = tree as Readonly<Record<string, unknown>>
  const { statement } = node
  const own =
    node['type'] === 'signature-pad' && node['field'] === field
      ? [typeof statement === 'string' ? statement : '']
      : []
  return [...own, ...Object.values(node).flatMap((value) => padStatementsIn(value, field))]
}

/**
 * The statement the signer was shown: the one of `resolved` (each pad's
 * statement, resolved against the record as it stands) whose digest is
 * `digest`. `undefined` when none is: the page changed since it was read, or
 * never showed that text.
 */
export const statementShown = (resolved: readonly string[], digest: string): string | undefined =>
  resolved.find((statement) => statementDigest(statement) === digest)

/**
 * The name a signing-link signature is stored under: the name she typed, or for
 * a drawn mark the display name her request was sent to her under. Never the
 * flow's key for her place in it (`employee`), which names a role, not a person;
 * empty when the send recorded no name for her.
 */
export const linkSignerName = (input: {
  readonly method: 'drawn' | 'typed'
  readonly typedName?: string | undefined
  readonly displayName?: string | undefined
}): string => (input.method === 'typed' ? input.typedName : input.displayName)?.trim() ?? ''

/**
 * A captured signature as the engine stores it: version 2, its evidence id, and
 * who the engine knows signed (a signed-in account, or nobody beyond the page).
 */
export const capturedSignatureValue = (input: {
  readonly evidenceId: string
  readonly image: string
  readonly signerName: string
  readonly signedAt: string
  readonly statement: string
  readonly method: 'drawn' | 'typed'
  /** The signer's account; absent for a visitor who is not signed in. */
  readonly userId: string | undefined
}): SignatureValueV2 => ({
  version: 2,
  evidenceId: input.evidenceId,
  image: input.image,
  signerName: input.signerName,
  signedAt: input.signedAt,
  statement: input.statement,
  method: input.method,
  identity:
    input.userId === undefined ? { kind: 'anonymous' } : { kind: 'account', userId: input.userId },
})
