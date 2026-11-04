/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { looseIsoDateTime, uuid } from '@/domain/kernel/config-parsing/formats'
import { optionalField } from '@/domain/kernel/config-parsing/optional-field'
import { sha256Hex, signatureIdentitySchema } from './common'

/**
 * API contract for `GET /api/signatures/requests/:requestId/evidence` — the
 * evidence file of a request (`evidence.json`), the authoritative form the
 * proof PDF is printed from.
 *
 * Personal data never appears in clear: each signer's address, phone and
 * network details are present as salted commitments, which open only with the
 * salt kept in the evidence tables. An erasure deletes the salts and appends an
 * `erased` event, so the chain still verifies and the commitments no longer
 * identify anyone. The file has its own `version`, independent of the app.
 */

export const EVIDENCE_FILE_VERSION = 1

/** Every event the log records. */
export const SIGNATURE_EVENT_TYPES = [
  'sent',
  'opened',
  'challenge-sent',
  'challenge-verified',
  'challenge-failed',
  'signed',
  'declined',
  'reminded',
  'cancelled',
  'expired',
  'sealed',
  'completed',
  'delivered',
  'erased',
] as const

export const signatureEventSchema = Schema.Struct({
  seq: Schema.Finite.annotate({ description: 'Position in the chain, from 1' }).pipe(
    Schema.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(1))
  ),
  type: Schema.Literals(SIGNATURE_EVENT_TYPES).annotate({ description: 'What happened' }),
  at: looseIsoDateTime({ description: 'Server instant of the event' }),
  signer: optionalField(Schema.String.annotate({ description: 'Signer the event concerns' })),
  data: Schema.Record(Schema.String, Schema.Unknown).annotate({
    description: 'Event details; personal data only as commitments',
  }),
  prevHash: sha256Hex('Hash of the previous event (64 zeros for the first)'),
  hash: sha256Hex('Hash over the canonical bytes of this event, prevHash included'),
}).annotate({ identifier: 'SignatureEvent' })

export const evidenceSignerSchema = Schema.Struct({
  name: Schema.String.annotate({ description: 'Signer name within the flow' }),
  identity: signatureIdentitySchema,
  contactCommitment: sha256Hex('Salted commitment to the signer’s contact details'),
  erased: Schema.Boolean.annotate({
    description: 'Whether the signer’s salts were erased; the commitment then opens to nothing',
  }),
}).annotate({ identifier: 'EvidenceSigner' })

export const evidenceFileSchema = Schema.Struct({
  version: Schema.Literal(EVIDENCE_FILE_VERSION).annotate({
    description: 'Shape version of the evidence file',
  }),
  request: Schema.Struct({
    id: uuid({ description: 'Request id' }),
    flow: Schema.String.annotate({ description: 'Name of the signing flow' }),
    basis: optionalField(
      Schema.String.annotate({
        description:
          'Why the evidence is kept; absent for a signature captured on a record, which keeps no retention of its own',
      })
    ),
    keepUntil: optionalField(
      looseIsoDateTime({
        description:
          'When the evidence is deleted; absent for a signature captured on a record, whose evidence follows the record and the signer',
      })
    ),
  }),
  document: Schema.Struct({
    algorithm: Schema.Literal('sha-256'),
    hash: sha256Hex('Fingerprint of the frozen document'),
    pages: Schema.Finite.annotate({ description: 'Pages of the frozen document' }),
  }),
  statements: Schema.Record(Schema.String, Schema.String).annotate({
    description: 'The frozen statement per signer name',
  }),
  signers: Schema.Array(evidenceSignerSchema),
  events: Schema.Array(signatureEventSchema),
  head: Schema.Struct({
    hash: sha256Hex('Hash of the last event'),
    timestamp: optionalField(
      Schema.Struct({
        authority: Schema.String.annotate({ description: 'URL of the timestamp authority' }),
        token: Schema.String.annotate({ description: 'RFC 3161 timestamp token, base64' }),
      })
    ),
  }),
  seal: optionalField(
    Schema.Struct({
      level: Schema.Literals(['B-B', 'B-T']).annotate({
        description: 'PAdES baseline level of the seal: B-T when a timestamp is included',
      }),
      certificateSha256: sha256Hex('Fingerprint of the seal certificate'),
    })
  ),
}).annotate({ identifier: 'EvidenceFile' })

/** @public */
export type EvidenceFile = typeof evidenceFileSchema.Type
