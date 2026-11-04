/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { looseIsoDateTime, uuid } from '@/domain/kernel/config-parsing/formats'
import { optionalField } from '@/domain/kernel/config-parsing/optional-field'
import { appliedQuerySchema, searchTermSchema } from '../../search-term'
import { signatureRequestStatusSchema } from '../../signatures/common'

/**
 * API contract for `GET /api/admin/signatures` — the signing requests the
 * caller may open, as the operator console lists them: those whose table her
 * role and groups may read and whose record is still there. Console readers
 * only; anyone else gets 404.
 *
 * Read-only, and deliberately thin: one row per request, already shaped for a
 * grid cell. The detail of a request, its evidence log and its export are read
 * from the routes that already serve them
 * (`/api/signatures/requests/:requestId`, `/evidence`, `/export`); this list
 * never becomes a second way to read them.
 *
 * What a row never carries: a signer's address or phone number, a link
 * token or its digest, a code or its digest, a salt, the document's
 * fingerprint. A signer appears by her display name and her status only.
 */

/** Query parameters: an optional search over the flow, the record and the signers' names. */
export const adminSignatureRequestsQuerySchema = Schema.Struct({
  q: searchTermSchema,
}).annotate({ identifier: 'AdminSignatureRequestsQuery' })

/** @public */
export type AdminSignatureRequestsQuery = typeof adminSignatureRequestsQuerySchema.Type

/** One signing request, as one row of the console's list. */
export const adminSignatureRequestRowSchema = Schema.Struct({
  id: uuid({ description: 'Request id; the detail page and the evidence routes take it' }),
  flow: Schema.String.annotate({ description: 'Name of the signing flow' }),
  table: Schema.String.annotate({ description: 'Table of the record signed' }),
  recordId: Schema.String.annotate({ description: 'Id of the record signed' }),
  record: Schema.String.annotate({
    description: 'The record as one display string: its table and its id',
    examples: ['contracts · 12'],
  }),
  status: signatureRequestStatusSchema,
  signers: Schema.String.annotate({
    description:
      "Every signer in flow order, as one display string: each signer's display name and her status (waiting, sent, signed or declined)",
    examples: ['Ada Lovelace: sent · Grace Hopper: waiting'],
  }),
  sentAt: looseIsoDateTime({ description: 'When the request was sent' }),
  endedAt: optionalField(
    looseIsoDateTime({ description: 'When it completed, was declined, cancelled or expired' })
  ),
  keepUntil: optionalField(
    looseIsoDateTime({
      description:
        'Until when the evidence is kept, once the request has ended; the length comes from the flow',
    })
  ),
}).annotate({ identifier: 'AdminSignatureRequestRow' })

/** @public */
export type AdminSignatureRequestRow = typeof adminSignatureRequestRowSchema.Type

/** The list, newest request first. */
export const adminSignatureRequestsResponseSchema = Schema.Struct({
  requests: Schema.Array(adminSignatureRequestRowSchema).annotate({
    description: 'Signing requests, newest first',
  }),
  query: appliedQuerySchema,
}).annotate({ identifier: 'AdminSignatureRequests' })

/** @public */
export type AdminSignatureRequestsResponse = typeof adminSignatureRequestsResponseSchema.Type
