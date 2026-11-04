/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The evidence file of a request (`evidence.json`, `evidence.ts`) and the
 * export bundle around it (`export.ts`), assembled from what the evidence
 * tables hold.
 *
 * The events are the chain as stored, read back from their canonical bytes;
 * the signers carry their identity kind, the commitment the chain keeps of
 * their contact details and whether they were erased. Nothing here reads a
 * contact in clear: there is none to read, the chain holds commitments only.
 *
 * Pure: the caller reads the rows and the file bytes.
 */

import { Buffer } from 'node:buffer'
import { canonicalJson } from '@/domain/kernel/format/canonical-json'
import { EVIDENCE_FILE_VERSION, type EvidenceFile } from '@/domain/models/api/signatures/evidence'
import {
  EXPORT_FORMAT,
  EXPORT_FORMAT_VERSION,
  type ExportManifest,
} from '@/domain/models/api/signatures/export'
import { sha256Hex, type ChainedSignatureEvent } from './signature-evidence-chain-service'
import type { SignatureIdentity } from '@/domain/models/api/signatures/common'

/** One signer of a request, as the evidence file names her. */
export interface EvidenceSignerInput {
  readonly name: string
  readonly identityKind: SignatureIdentity['kind']
}

/** What the evidence file of one request is assembled from. */
export interface EvidenceFileInput {
  readonly request: {
    readonly id: string
    readonly flow: string
    /** Why the evidence is kept; absent for a signature captured on a record. */
    readonly basis?: string | undefined
    /** ISO 8601: when the evidence goes; absent for a signature captured on a record. */
    readonly keepUntil?: string | undefined
    /** SHA-256 of the frozen document; absent for a signature given on a statement only. */
    readonly documentHash?: string | undefined
    readonly pages: number
    /** The statement each signer read, by signer name. */
    readonly statements: Readonly<Record<string, string>>
  }
  readonly signers: readonly EvidenceSignerInput[]
  /** The chain, in order. */
  readonly events: readonly ChainedSignatureEvent[]
}

/** The commitment the chain keeps of `signer`'s contact: the first event of hers that records one. */
const contactCommitmentOf = (events: readonly ChainedSignatureEvent[], signer: string): string => {
  const recorded = events
    .filter((event) => event.signer === signer)
    .map((event) => event.data['contactCommitment'])
    .find((value): value is string => typeof value === 'string')
  // A signer whose contact the chain never committed to: the commitment to nothing.
  return recorded ?? sha256Hex('')
}

/** The fingerprint of a request that froze no document: its statements, canonically spelled. */
const statementsFingerprint = (statements: Readonly<Record<string, string>>): string =>
  sha256Hex(canonicalJson(statements))

/** `{ [key]: value }`, or nothing when `value` is undefined. */
const optionalEntry = <K extends string, V>(key: K, value: V | undefined): Partial<Record<K, V>> =>
  value === undefined ? {} : ({ [key]: value } as Partial<Record<K, V>>)

/** The seal the chain's `sealed` event records, as the evidence file names it. */
const sealOf = (events: readonly ChainedSignatureEvent[]): EvidenceFile['seal'] => {
  const data = events.find((event) => event.type === 'sealed')?.data
  const level = data?.['level']
  const certificateSha256 = data?.['certificateSha256']
  if (typeof certificateSha256 !== 'string' || (level !== 'b-b' && level !== 'b-t')) {
    return undefined
  }
  return { level: level === 'b-t' ? 'B-T' : 'B-B', certificateSha256 }
}

/** The timestamp of the chain head the `completed` event records, or none. */
const headTimestampOf = (
  events: readonly ChainedSignatureEvent[]
): EvidenceFile['head']['timestamp'] => {
  const stamp = events.find((event) => event.type === 'completed')?.data['timestamp']
  if (typeof stamp !== 'object' || stamp === null) return undefined
  const { authority, token } = stamp as Readonly<Record<string, unknown>>
  return typeof authority === 'string' && typeof token === 'string'
    ? { authority, token }
    : undefined
}

/**
 * The evidence file of a request. Its `seal` is the one the `sealed` event
 * records, and its head's `timestamp` the one the `completed` event carries:
 * that token stamps the head the chain had when the request completed (named
 * in the event as `anchoredHash`), which every later event links back to.
 */
export const evidenceFileOf = (input: EvidenceFileInput): EvidenceFile => {
  const { request, events } = input
  const erased = new Set(
    events.filter((event) => event.type === 'erased').map((event) => event.signer)
  )
  return {
    version: EVIDENCE_FILE_VERSION,
    request: {
      ...{ id: request.id, flow: request.flow },
      ...(request.basis === undefined ? {} : { basis: request.basis }),
      ...(request.keepUntil === undefined ? {} : { keepUntil: request.keepUntil }),
    },
    document: {
      algorithm: 'sha-256',
      hash: request.documentHash ?? statementsFingerprint(request.statements),
      pages: request.pages,
    },
    statements: request.statements,
    signers: input.signers.map((signer) => ({
      ...{ name: signer.name, identity: { kind: signer.identityKind } },
      contactCommitment: contactCommitmentOf(events, signer.name),
      erased: erased.has(signer.name),
    })),
    events: events.map((event) => ({
      ...{ seq: event.seq, type: event.type, at: event.at },
      ...(event.signer === undefined ? {} : { signer: event.signer }),
      ...{ data: event.data, prevHash: event.prevHash, hash: event.hash },
    })),
    head: {
      hash: events.at(-1)?.hash ?? sha256Hex(''),
      ...optionalEntry('timestamp', headTimestampOf(events)),
    },
    ...optionalEntry('seal', sealOf(events)),
  }
}

/** One file an export carries, with its bytes. */
export interface ExportFileInput {
  readonly path: string
  readonly role: ExportManifest['files'][number]['role']
  readonly bytes: Uint8Array
}

/** The export bundle of `evidence` and the files it covers, each hashed as it stands. */
export const exportManifestOf = (
  evidence: EvidenceFile,
  files: readonly ExportFileInput[]
): ExportManifest => ({
  ...{ format: EXPORT_FORMAT, version: EXPORT_FORMAT_VERSION },
  evidence,
  files: files.map((file) => ({
    ...{ path: file.path, role: file.role, sha256: sha256Hex(file.bytes) },
    contentBase64: Buffer.from(file.bytes).toString('base64'),
  })),
})
