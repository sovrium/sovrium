/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { looseIsoDateTime, uuid } from '@/domain/kernel/config-parsing/formats'
import { optionalField } from '@/domain/kernel/config-parsing/optional-field'
import {
  sha256Hex,
  signatureChannelSchema,
  signatureRequestStatusSchema,
  signerStatusSchema,
} from './common'

/**
 * API contract for `GET /api/signatures/requests/:requestId` — where a request
 * stands. Readable by whoever may read the record it is for; anyone else gets
 * 404. It carries no address, phone number or network data.
 */

export const signatureRequestSignerSchema = Schema.Struct({
  name: Schema.String.annotate({ description: 'Signer name within the flow' }),
  displayName: Schema.String.annotate({ description: 'Name shown to the signer' }),
  status: signerStatusSchema,
  signedAt: optionalField(looseIsoDateTime({ description: 'When she signed' })),
  verifiedBy: Schema.Array(signatureChannelSchema).annotate({
    description: 'Channels she verified before signing',
  }),
}).annotate({ identifier: 'SignatureRequestSigner' })

export const signatureRequestResponseSchema = Schema.Struct({
  id: uuid({ description: 'Request id' }),
  flow: Schema.String.annotate({ description: 'Name of the signing flow' }),
  table: Schema.String.annotate({ description: 'Table of the record' }),
  recordId: Schema.String.annotate({ description: 'Id of the record' }),
  status: signatureRequestStatusSchema,
  documentHash: sha256Hex('SHA-256 digest, 64 lowercase hexadecimal characters'),
  sentAt: looseIsoDateTime({ description: 'When the request was sent' }),
  expiresAt: looseIsoDateTime({ description: 'When unused links stop working' }),
  endedAt: optionalField(
    looseIsoDateTime({ description: 'When it completed, was declined, cancelled or expired' })
  ),
  sealed: Schema.Boolean.annotate({
    description: 'Whether the signed document carries the organisation seal',
  }),
  timestamped: Schema.Boolean.annotate({
    description: 'Whether the end of the event log carries a timestamp from an outside authority',
  }),
  signers: Schema.Array(signatureRequestSignerSchema),
}).annotate({ identifier: 'SignatureRequest' })

/** @public */
export type SignatureRequestResponse = typeof signatureRequestResponseSchema.Type
