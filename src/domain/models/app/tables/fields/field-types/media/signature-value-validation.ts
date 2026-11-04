/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What a `signature` field holds, who may put a value there, and how a read
 * labels it.
 *
 * Only the engine authors a signature. A signed-in person signs through the
 * field's signing route (`captureSignature`), and `sovrium seed` writes the
 * operator's own data as `imported`. Any other write naming the field — the
 * records API, a batch, an upsert, an import over the API, a form mapping, an
 * automation or an agent — is refused ({@link signatureClientWriteRefusal}).
 *
 * A seeded value is the old shape (image, signer, statement, method, and an
 * optional instant) or a version 2 value carried over from an export; it is
 * stored as version 2 with `identity: imported` and no evidence id
 * ({@link importedSignatureValue}).
 *
 * A value stored before version 2 is never rewritten: a read labels it
 * `client-asserted` ({@link signatureForRead}).
 *
 * Pure: the caller decodes nothing and passes the instant.
 */

import { Option, Schema } from 'effect'
import { ValidationError } from '@/domain/errors'
import type { SignatureValueV2 } from '@/domain/models/api/signatures/common'

/** A non-empty text part of a signature. */
const SignaturePart = Schema.String.check(Schema.isNonEmpty())

/** A signature as a seed file supplies it; `signedAt`, when given, is kept. */
const SignatureWriteSchema = Schema.Struct({
  image: SignaturePart,
  signerName: SignaturePart,
  statement: SignaturePart,
  method: Schema.Literals(['drawn', 'typed']),
  signedAt: Schema.optional(Schema.String),
})

/** A stored cell parsed: SQLite holds the JSON as text. */
const parsedCell = (value: unknown): unknown => {
  if (typeof value !== 'string' || !value.startsWith('{')) return value
  try {
    return JSON.parse(value) as unknown
  } catch {
    return value
  }
}

/** The signature `value` describes, or `undefined` when it is not a complete signature. */
const decodeSignatureWrite = (value: unknown) =>
  Option.getOrUndefined(Schema.decodeUnknownOption(SignatureWriteSchema)(value))

/**
 * A seeded signature as it is stored: version 2, `identity: imported`, no
 * evidence id, at the instant the seed gives (else `now`). `undefined` when the
 * value is not a complete signature.
 */
export const importedSignatureValue = (
  value: unknown,
  now: string
): SignatureValueV2 | undefined => {
  const signature = decodeSignatureWrite(parsedCell(value))
  if (signature === undefined) return undefined
  return {
    version: 2,
    image: signature.image,
    signerName: signature.signerName,
    signedAt: signature.signedAt ?? now,
    statement: signature.statement,
    method: signature.method,
    identity: { kind: 'imported' },
  }
}

/**
 * A stored signature as a read returns it: a version 2 value as stored, and an
 * older value — composed by the browser — labelled `provenance:
 * client-asserted`. Anything else is returned as it is.
 */
export const signatureForRead = (value: unknown): unknown => {
  const cell = parsedCell(value)
  if (cell === null || typeof cell !== 'object' || Array.isArray(cell)) return value
  const signature = cell as Readonly<Record<string, unknown>>
  return signature['version'] === undefined
    ? { ...signature, provenance: 'client-asserted' }
    : signature
}

/** Every `signature` column of a table: the columns written only while they are empty. */
export const signatureColumnsOf = (
  fields: readonly { readonly name: string; readonly type: string }[]
): readonly string[] =>
  fields.filter((field) => field.type === 'signature').map((field) => field.name)

/** The refusal of a write that would change a signature already stored. */
export const signatureKeptRefusal = (field: string, record = 0): Readonly<ValidationError> =>
  new ValidationError(`${field} is already signed and cannot be changed`, [
    { record, field, error: 'A signature cannot be changed once stored' },
  ])

/** The refusal of a value that is not a complete signature. */
export const signatureShapeRefusal = (field: string, record = 0): Readonly<ValidationError> =>
  new ValidationError(
    `${field} must hold an image, a signer name, a statement and a method (drawn or typed)`,
    [{ record, field, error: 'A signature needs its image, signer, statement and method' }]
  )

/**
 * The refusal of a value a client wrote into a `signature` field. One answer,
 * whatever the value: a signature is given through the field's signing route.
 */
export const signatureClientWriteRefusal = (field: string, record = 0): Readonly<ValidationError> =>
  new ValidationError(
    `${field} is signed through its signing route and cannot be written directly`,
    [{ record, field, error: 'A signature is given through the signing route only' }]
  )

/** The refusal of a write to a field a signing flow writes as its request moves on. */
export const signatureFlowOutputRefusal = (field: string, record = 0): Readonly<ValidationError> =>
  new ValidationError(`${field} is written by its signing flow and cannot be written directly`, [
    { record, field, error: 'Only the signing flow writes this field' },
  ])

/** The refusal of a write to the document of a signing request that is still open. */
export const signatureDocumentLockedRefusal = (
  field: string,
  record = 0
): Readonly<ValidationError> =>
  new ValidationError(
    `${field} is the document of an open signing request and cannot change until it ends`,
    [{ record, field, error: 'The document of an open signing request cannot change' }]
  )
