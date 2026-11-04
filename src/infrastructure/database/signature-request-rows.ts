/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The rows of a signing request, read back into the shapes the lifecycle
 * port speaks, and the contact commitments a move takes from the subject row
 * the send wrote. Pure over the rows the queries answer.
 */

import {
  contactCommitmentValue,
  subjectCommitment,
} from '@/domain/models/app/signatures/signature-evidence-chain-service'
import { isoOfStoredInstant } from './signature-evidence-queries'
import type {
  SignatureRequestRow,
  SignatureRequestSignerRow,
  SigningSession,
} from '@/application/ports/repositories/signatures/signature-request-repository'
import type { StoredRequestStatus } from '@/domain/models/app/signatures/signature-request-service'

type Row = Readonly<Record<string, unknown>>

/** 16 random bytes, hex: one salt. */
export const freshSalt = (): string =>
  Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('hex')

export const optionalString = (value: unknown): string | undefined =>
  value === null || value === undefined ? undefined : String(value)

/** A jsonb cell on PostgreSQL, JSON text on SQLite, as an object. */
const objectOf = (value: unknown): Readonly<Record<string, unknown>> => {
  const parsed = typeof value === 'string' ? (JSON.parse(value) as unknown) : value
  return typeof parsed === 'object' && parsed !== null
    ? (parsed as Readonly<Record<string, unknown>>)
    : {}
}

const stringsOf = (value: unknown): Readonly<Record<string, string>> =>
  Object.fromEntries(Object.entries(objectOf(value)).map(([key, text]) => [key, String(text)]))

export const requestOf = (row: Row): SignatureRequestRow => ({
  ...{ id: String(row['id']), flowName: String(row['flow_name']) },
  ...{ tableName: String(row['table_name']), recordId: String(row['record_id']) },
  status: String(row['status']) as StoredRequestStatus,
  order: row['signing_order'] === 'parallel' ? 'parallel' : 'sequential',
  statements: stringsOf(row['statements']),
  documentHash: optionalString(row['document_hash']),
  documentKey: optionalString(row['document_key']),
  sealLevel: optionalString(row['seal_level']) ?? 'none',
  createdAt: isoOfStoredInstant(row['created_at']) ?? '',
  expiresAt: isoOfStoredInstant(row['expires_at']),
  completedAt: isoOfStoredInstant(row['completed_at']),
  keepUntil: isoOfStoredInstant(row['keep_until']),
})

/** One signer row, with the display name the send kept for her when the read joined it. */
export const signerOf = (row: Row): SignatureRequestSignerRow => ({
  ...{ id: String(row['id']), name: String(row['signer_name']) },
  ...{ position: Number(row['position']), status: String(row['status']) },
  field: optionalString(row['field_name']),
  displayName: optionalString(row['display_name']),
  signedAt: isoOfStoredInstant(row['signed_at']),
})

export const sessionOf = (row: Row): SigningSession => ({
  ...{ signerId: String(row['signer_id']), signerName: String(row['signer_name']) },
  ...{ position: Number(row['position']), signerStatus: String(row['signer_status']) },
  field: optionalString(row['field_name']),
  identityKind: String(row['identity_kind']),
  tokenExpiresAt: isoOfStoredInstant(row['token_expires_at']),
  request: requestOf({ ...row, id: row['request_id'] }),
})

/** The contact a send recorded for a signer: her name and address, with their salts. */
export interface SentContact {
  readonly name?: string | undefined
  readonly email?: string | undefined
  readonly phone?: string | undefined
  readonly salts: Readonly<Record<string, string>>
}

export const sentContactOf = (rows: readonly Row[]): SentContact => {
  const sent = rows.find((row) => row['email'] !== null && row['email'] !== undefined) ?? rows[0]
  return sent === undefined
    ? { salts: {} }
    : {
        name: optionalString(sent['name']),
        email: optionalString(sent['email']),
        phone: optionalString(sent['phone']),
        salts: stringsOf(sent['salts']),
      }
}

/** The commitments the chain records of a signer's contact, from the salts the send drew. */
export const contactCommitmentsOf = (contact: SentContact) => ({
  contactCommitment: subjectCommitment(
    'contact',
    contactCommitmentValue({ email: contact.email, phone: contact.phone }),
    contact.salts['contact'] ?? ''
  ),
  ...(contact.name === undefined || contact.salts['name'] === undefined
    ? {}
    : { name: subjectCommitment('name', contact.name, contact.salts['name']) }),
})
