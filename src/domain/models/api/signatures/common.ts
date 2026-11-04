/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { looseIsoDateTime, uuid } from '@/domain/kernel/config-parsing/formats'
import { optionalField } from '@/domain/kernel/config-parsing/optional-field'

/**
 * The shapes every signing contract shares: how a signature is stored, who the
 * engine says signed it, a request's status, and what a signing page reads.
 *
 * A stored signature (version 2) carries no contact detail and no network data:
 * addresses, phone numbers and IP addresses live in the evidence tables only,
 * so a record read, an export of the table or a backup of it never carries
 * them. A value stored before version 2 has no `version`; it is read as
 * `client-asserted` and never rewritten.
 */

/** How the engine knows who signed. */
export const SIGNATURE_IDENTITY_KINDS = [
  'account',
  'email-otp',
  'sms-otp',
  'imported',
  'anonymous',
] as const

/** A SHA-256 digest, lowercase hex, described where it is used. */
export const sha256Hex = (description: string) =>
  Schema.String.annotate({ description }).pipe(Schema.check(Schema.isPattern(/^[0-9a-f]{64}$/)))

export const signatureIdentitySchema = Schema.Struct({
  kind: Schema.Literals(SIGNATURE_IDENTITY_KINDS).annotate({
    description:
      'How the signer was identified: a signed-in account, a code sent by email, a code sent by text message, a value imported by seed or import, or nothing beyond holding the page',
  }),
  userId: optionalField(
    Schema.String.annotate({ description: 'The account id, when kind is account' })
  ),
}).annotate({ identifier: 'SignatureIdentity' })

/** @public */
export type SignatureIdentity = typeof signatureIdentitySchema.Type

export const signatureMethodSchema = Schema.Literals(['drawn', 'typed']).annotate({
  description: 'Whether the mark was drawn in the well or typed as a name',
})

/**
 * A signature as the engine stores it in a `signature` field (version 2).
 * Every part is authored by the server; the client supplies only the drawing
 * (or the typed name) and its consent.
 */
export const signatureValueV2Schema = Schema.Struct({
  version: Schema.Literal(2).annotate({ description: 'Shape version of the stored value' }),
  evidenceId: optionalField(
    uuid({
      description:
        'Id of the evidence entry recording this signature; absent on a value written by seed or import',
    })
  ),
  image: Schema.String.annotate({
    description: 'Storage key of the PNG of the mark, under the evidence namespace',
  }),
  signerName: Schema.String.annotate({ description: 'Name of the signer as shown to her' }),
  signedAt: looseIsoDateTime({ description: 'Server instant of signing, ISO 8601 UTC' }),
  statement: Schema.String.annotate({
    description: 'The statement exactly as shown to the signer, after interpolation',
  }),
  method: signatureMethodSchema,
  documentHash: optionalField(
    sha256Hex('Fingerprint of the frozen document signed, when the signature is part of a flow')
  ),
  identity: signatureIdentitySchema,
}).annotate({ identifier: 'SignatureValueV2' })

/** @public */
export type SignatureValueV2 = typeof signatureValueV2Schema.Type

/**
 * A signature as a read returns it: a version 2 value, or an older value
 * labelled `client-asserted` because the browser composed it.
 */
export const signatureValueReadSchema = Schema.Union([
  signatureValueV2Schema,
  Schema.Struct({
    image: Schema.String.annotate({ description: 'Storage key of the PNG of the mark' }),
    signerName: Schema.String.annotate({ description: 'Name the client sent' }),
    signedAt: Schema.String.annotate({ description: 'Instant stored with the value' }),
    statement: Schema.String.annotate({ description: 'Statement the client sent' }),
    method: signatureMethodSchema,
    provenance: Schema.Literal('client-asserted').annotate({
      description:
        'Derived on read for a value stored before version 2: its parts were composed by the client',
    }),
  }).annotate({ identifier: 'SignatureValueClientAsserted' }),
]).annotate({ identifier: 'SignatureValueRead' })

/** Every status a signing request takes. */
export const SIGNATURE_REQUEST_STATUSES = [
  'sent',
  'in-progress',
  'sealing',
  'completed',
  'declined',
  'cancelled',
  'expired',
] as const

export const signatureRequestStatusSchema = Schema.Literals(SIGNATURE_REQUEST_STATUSES).annotate({
  description:
    'Status of a request: sent, in-progress (one signer or more has signed), sealing (every signer has signed, the signed document is being produced), completed, declined, cancelled or expired',
})

/** Where a signer stands in her request. */
export const signerStatusSchema = Schema.Literals([
  'waiting',
  'sent',
  'signed',
  'declined',
]).annotate({
  description: 'waiting (her turn has not come), sent (her link is open), signed, or declined',
})

/** A verification channel. */
export const signatureChannelSchema = Schema.Literals(['email', 'sms']).annotate({
  description: 'Verification channel: a code by email or by text message',
})

/**
 * What components of a signing page read as `$signing`. It is built from the
 * request the signing session names, never from the live record, except the
 * fields the flow lists in `surface.fields`.
 */
export const signingContextSchema = Schema.Struct({
  request: Schema.Struct({
    id: uuid({ description: 'Request id' }),
    flow: Schema.String.annotate({ description: 'Name of the signing flow' }),
    status: signatureRequestStatusSchema,
    expiresAt: looseIsoDateTime({ description: 'When unused links stop working' }),
  }),
  signer: Schema.Struct({
    name: Schema.String.annotate({ description: 'Signer name within the flow' }),
    displayName: Schema.String.annotate({ description: 'Name shown to the signer' }),
    status: signerStatusSchema,
  }),
  statement: Schema.String.annotate({
    description: 'The statement as frozen for this signer, in her language',
  }),
  document: Schema.Struct({
    url: Schema.String.annotate({
      description: 'Address of the frozen document, valid for this signing session only',
    }),
    hash: sha256Hex('SHA-256 digest, 64 lowercase hexadecimal characters'),
    pages: Schema.Finite.annotate({ description: 'Number of pages of the frozen document' }),
  }),
  verification: Schema.Struct({
    required: Schema.Array(signatureChannelSchema).annotate({
      description: 'Channels the flow requires, in the order they are asked',
    }),
    verified: Schema.Array(signatureChannelSchema).annotate({
      description: 'Channels already verified in this session',
    }),
  }),
  record: Schema.Record(Schema.String, Schema.Unknown).annotate({
    description: 'The record fields listed in surface.fields, and no other',
  }),
}).annotate({ identifier: 'SigningContext' })

/** @public */
export type SigningContext = typeof signingContextSchema.Type
