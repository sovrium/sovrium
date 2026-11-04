/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What `sovrium signature verify` concludes about a signing export, with no
 * server involved: the export is one JSON document (`export.ts`), its evidence
 * file and every file it covers, each with its role, its SHA-256 and its bytes.
 *
 * The checks run in the contract's order (`VERIFY_CHECKS`):
 *
 * - `manifest` — the document is an export of a version this reader knows;
 * - `files` — each file's bytes hash to the SHA-256 recorded beside them;
 * - `chain` — the events are one unbroken hash chain, and the head is its last hash;
 * - `document` — the frozen document's bytes hash to the fingerprint every
 *   signer signed (`absent` for a signature captured on a record, which signs
 *   a statement and no document);
 * - `signatures` — every signing event names a signer of the request, was
 *   given on that fingerprint, and the mark it names is in the export; a
 *   commitment a reader opens (her name, her address) must open;
 * - `seal`, `timestamp` — `absent` when the request carries none. When it
 *   carries one, the file's copy must match the chain's record of it (the
 *   `sealed` event, the `completed` event's head timestamp), and the
 *   cryptographic checks the caller ran decide the line: `pass`, `untrusted`
 *   (it verifies, but its certificate leads to no root the reader trusts) or
 *   `fail`. A caller that ran none gets a failure, never a pass unchecked.
 *
 * The export is valid exactly when no check fails.
 *
 * Pure: the caller reads the file and prints the report.
 */

import { Buffer } from 'node:buffer'
import { decodeSafe } from '@/domain/kernel/config-parsing/decode'
import {
  exportManifestSchema,
  type ExportManifest,
  type VerifyReport,
} from '@/domain/models/api/signatures/export'
import { opensCommitment, sha256Hex, verifyChainEvents } from './signature-evidence-chain-service'
import type { ChainedSignatureEvent } from './signature-evidence-chain-service'

/** One check's line in the report. */
type VerifyCheckLine = VerifyReport['checks'][number]

/** One personal datum a reader holds, to open the commitment the evidence keeps of it. */
export interface CommitmentOpening {
  readonly signer: string
  readonly field: string
  readonly value: string
  readonly salt: string
}

const pass = (check: VerifyCheckLine['check']): VerifyCheckLine => ({ check, outcome: 'pass' })
const absent = (check: VerifyCheckLine['check']): VerifyCheckLine => ({ check, outcome: 'absent' })
const fail = (check: VerifyCheckLine['check'], detail: string): VerifyCheckLine => ({
  ...{ check, outcome: 'fail' },
  detail,
})

/** The bytes a file of the export carries. */
const fileBytes = (file: ExportManifest['files'][number]): Uint8Array =>
  Buffer.from(file.contentBase64, 'base64')

/** The event key that anchors a file of each role in the chain: its SHA-256 as the event recorded it. */
const ANCHOR_KEY: Readonly<Record<ExportManifest['files'][number]['role'], string>> = {
  'frozen-document': 'documentHash',
  'signed-document': 'signedDocumentSha256',
  proof: 'proofSha256',
  mark: 'markSha256',
}

/** Every digest the chain records under `key`. */
const anchoredDigests = (manifest: ExportManifest, key: string): ReadonlySet<string> =>
  new Set(
    manifest.evidence.events
      .map((event) => event.data[key])
      .filter((value): value is string => typeof value === 'string')
  )

/**
 * Every file is what its own digest says AND what the chain recorded when it
 * was written: a file whose bytes and digest were both replaced in the export
 * still fails, since no event of the chain names the new digest.
 */
const filesCheck = (manifest: ExportManifest): VerifyCheckLine => {
  const paths = manifest.files.map((file) => file.path)
  if (new Set(paths).size !== paths.length) return fail('files', 'two files share one path')
  const altered = manifest.files.find((file) => sha256Hex(fileBytes(file)) !== file.sha256)
  if (altered !== undefined) return fail('files', `${altered.path} does not match its SHA-256`)
  const unanchored = manifest.files.find(
    (file) => !anchoredDigests(manifest, ANCHOR_KEY[file.role]).has(file.sha256)
  )
  return unanchored === undefined
    ? pass('files')
    : fail('files', `${unanchored.path} is not the file the evidence recorded`)
}

const chainCheck = (manifest: ExportManifest): VerifyCheckLine => {
  const { events, head } = manifest.evidence
  const verdict = verifyChainEvents(
    manifest.evidence.request.id,
    events as readonly ChainedSignatureEvent[]
  )
  if (!verdict.valid) return fail('chain', verdict.detail)
  return events.at(-1)?.hash === head.hash
    ? pass('chain')
    : fail('chain', 'the head is not the hash of the last event')
}

/**
 * A request signs a document when one of its events names the document's
 * fingerprint: the chain says so, so dropping the file cannot turn the check
 * into `absent`.
 */
const signsADocument = (manifest: ExportManifest): boolean =>
  manifest.evidence.events.some((event) => typeof event.data['documentHash'] === 'string')

const documentCheck = (manifest: ExportManifest): VerifyCheckLine => {
  const { document } = manifest.evidence
  const frozen = manifest.files.filter((file) => file.role === 'frozen-document')
  if (frozen.length === 0) {
    return signsADocument(manifest)
      ? fail('document', 'the frozen document is missing from the export')
      : absent('document')
  }
  return frozen.every((file) => sha256Hex(fileBytes(file)) === document.hash)
    ? pass('document')
    : fail('document', 'the frozen document is not the one the signers were shown')
}

const stringIn = (data: Readonly<Record<string, unknown>>, key: string): string | undefined => {
  const value = data[key]
  return typeof value === 'string' ? value : undefined
}

/** The first break among the signing events, or `undefined`. */
const signingEventBreak = (manifest: ExportManifest): string | undefined => {
  const { evidence } = manifest
  const signers = new Set(evidence.signers.map((signer) => signer.name))
  const marks = new Set(
    manifest.files.filter((file) => file.role === 'mark').map((file) => sha256Hex(fileBytes(file)))
  )
  return evidence.events
    .filter((event) => event.type === 'signed')
    .map((event) => {
      if (event.signer === undefined || !signers.has(event.signer)) {
        return `event ${event.seq} names no signer of the request`
      }
      const signedHash = stringIn(event.data, 'documentHash')
      if (signedHash !== undefined && signedHash !== evidence.document.hash) {
        return `event ${event.seq} was given on another document`
      }
      const mark = stringIn(event.data, 'markSha256')
      if (mark !== undefined && !marks.has(mark)) return `the mark of event ${event.seq} is missing`
      return undefined
    })
    .find((found) => found !== undefined)
}

/** Every commitment the evidence holds for `signer`: her contact, and each event's. */
const commitmentsOf = (manifest: ExportManifest, signer: string): ReadonlySet<string> => {
  const { evidence } = manifest
  const contact = evidence.signers.find((entry) => entry.name === signer)?.contactCommitment
  const fromEvents = evidence.events
    .filter((event) => event.signer === signer)
    .flatMap((event) => {
      const { commitments } = event.data
      return typeof commitments === 'object' && commitments !== null
        ? Object.values(commitments as Readonly<Record<string, unknown>>)
        : []
    })
    .filter((value): value is string => typeof value === 'string')
  return new Set([...(contact === undefined ? [] : [contact]), ...fromEvents])
}

/** The first opening that opens no commitment of its signer, or `undefined`. */
const openingBreak = (
  manifest: ExportManifest,
  openings: readonly CommitmentOpening[]
): string | undefined => {
  const unopened = openings.find(
    (opening) =>
      ![...commitmentsOf(manifest, opening.signer)].some((commitment) =>
        opensCommitment(commitment, opening)
      )
  )
  return unopened === undefined
    ? undefined
    : `the ${unopened.field} given for ${unopened.signer} opens no commitment of the evidence`
}

const signaturesCheck = (
  manifest: ExportManifest,
  openings: readonly CommitmentOpening[]
): VerifyCheckLine => {
  const detail = signingEventBreak(manifest) ?? openingBreak(manifest, openings)
  return detail === undefined ? pass('signatures') : fail('signatures', detail)
}

const UNCHECKED = 'present, and this verifier was given no way to check it'

/**
 * The seal and timestamp lines a cryptographic checker worked out for one
 * export (`signature-export-crypto-service.ts`): each
 * `pass`, `untrusted` or `fail`. The domain decides when they are due; the
 * checker decides what they say.
 */
export interface CryptographicCheckLines {
  readonly seal?: VerifyCheckLine | undefined
  readonly timestamp?: VerifyCheckLine | undefined
}

/** The `sealed` event of the chain, the authoritative record of a seal. */
const sealedEventOf = (manifest: ExportManifest) =>
  manifest.evidence.events.find((event) => event.type === 'sealed')

/** The head timestamp the `completed` event recorded, the authoritative record of a timestamp. */
export const recordedHeadTimestamp = (
  manifest: ExportManifest
):
  | { readonly authority: string; readonly token: string; readonly anchoredHash: string }
  | undefined => {
  const stamp = manifest.evidence.events.find((event) => event.type === 'completed')?.data[
    'timestamp'
  ]
  if (typeof stamp !== 'object' || stamp === null) return undefined
  const { authority, token, anchoredHash } = stamp as Readonly<Record<string, unknown>>
  return typeof authority === 'string' &&
    typeof token === 'string' &&
    typeof anchoredHash === 'string'
    ? { authority, token, anchoredHash }
    : undefined
}

/**
 * The seal: absent when neither the chain nor the file names one; a file
 * whose `seal` disagrees with the chain's `sealed` event fails; otherwise the
 * checker's line, or a failure when no checker ran.
 */
const sealCheck = (manifest: ExportManifest, lines: CryptographicCheckLines): VerifyCheckLine => {
  const event = sealedEventOf(manifest)
  const { seal } = manifest.evidence
  if (event === undefined && seal === undefined) return absent('seal')
  if (
    event === undefined ||
    seal === undefined ||
    event.data['certificateSha256'] !== seal.certificateSha256 ||
    String(event.data['level']).toUpperCase() !== seal.level
  ) {
    return fail('seal', 'the seal the file names is not the one the chain recorded')
  }
  return lines.seal ?? fail('seal', `the seal is ${UNCHECKED}`)
}

/** The timestamp of the chain head, judged the same way against the `completed` event. */
const timestampCheck = (
  manifest: ExportManifest,
  lines: CryptographicCheckLines
): VerifyCheckLine => {
  const recorded = recordedHeadTimestamp(manifest)
  const { timestamp } = manifest.evidence.head
  if (recorded === undefined && timestamp === undefined) return absent('timestamp')
  if (recorded === undefined || timestamp?.token !== recorded.token) {
    return fail('timestamp', 'the timestamp the file names is not the one the chain recorded')
  }
  return lines.timestamp ?? fail('timestamp', `the timestamp is ${UNCHECKED}`)
}

/** The report of an export that did not decode: the manifest fails, nothing else is checked. */
const undecodedReport = (detail: string): VerifyReport => ({
  ...{ valid: false, requestId: '', events: 0, erasures: 0 },
  checks: [
    fail('manifest', detail),
    ...(['files', 'chain', 'document', 'signatures', 'seal', 'timestamp'] as const).map((check) =>
      fail(check, 'not checked: the export did not decode')
    ),
  ],
})

/**
 * How deep an event's details may nest. The engine writes flat details; a
 * deeper document is hostile, and is refused before the chain is hashed, whose
 * canonical spelling recurses once per level.
 */
const MAX_DATA_DEPTH = 32

/** Whether `value` nests deeper than `limit` levels of arrays and objects. */
const nestsDeeperThan = (value: unknown, limit: number): boolean => {
  if (typeof value !== 'object' || value === null) return false
  if (limit === 0) return true
  return Object.values(value).some((member) => nestsDeeperThan(member, limit - 1))
}

/**
 * Verify `document`, the parsed export, opening each of `openings` against
 * the commitments it holds. Never throws: a document that is not an export
 * fails the `manifest` check.
 */
export const verifySignatureExport = (
  document: unknown,
  openings: readonly CommitmentOpening[] = [],
  lines: CryptographicCheckLines = {}
): VerifyReport => {
  const decoded = decodeSafe(exportManifestSchema)(document)
  if (!decoded.success) return undecodedReport(decoded.error.message)
  const manifest = decoded.data
  if (manifest.evidence.events.some((event) => nestsDeeperThan(event.data, MAX_DATA_DEPTH))) {
    return undecodedReport(`an event's details nest deeper than ${MAX_DATA_DEPTH} levels`)
  }
  const checks = [
    pass('manifest'),
    filesCheck(manifest),
    chainCheck(manifest),
    documentCheck(manifest),
    signaturesCheck(manifest, openings),
    sealCheck(manifest, lines),
    timestampCheck(manifest, lines),
  ]
  const { events } = manifest.evidence
  return {
    // `untrusted` is not a failure: the cryptography held, the trust is the reader's to give.
    valid: checks.every((line) => line.outcome !== 'fail'),
    requestId: manifest.evidence.request.id,
    events: events.length,
    erasures: events.filter((event) => event.type === 'erased').length,
    checks,
  }
}
