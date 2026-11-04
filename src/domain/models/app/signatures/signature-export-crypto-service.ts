/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The cryptographic half of `sovrium signature verify`: the seal of each
 * sealed document and the timestamp of the chain head, checked offline from
 * what the export carries. The domain verifier
 * (`signature-export-verification-service.ts`) decides when these checks are
 * due and whether the file agrees with the chain; this module says what the
 * seal and the timestamp themselves are worth.
 *
 * The seal, for the signed document and the proof file each:
 *
 * - the document's last signature covers the whole file but its own
 *   `/Contents` string;
 * - its CMS verifies over those bytes (`cms-verification.ts`), and names the
 *   certificate the chain's `sealed` event recorded;
 * - at level B-T, it carries a timestamp token over its own signature value,
 *   which verifies;
 * - its certificate chain verifies up to a root, and that root is one the
 *   reader trusts: one of the certificates of `SIGNATURE_SEAL_CERT_CHAIN` when
 *   set. A chain that verifies to a root nobody named is `untrusted`, not
 *   `fail`: a self-signed seal is what a deployment without a public
 *   certificate has.
 *
 * The timestamp of the chain head: the token the `completed` event recorded
 * stamps the hash of an event of the chain (`anchoredHash`), it verifies, its
 * certificate may stamp time, and its chain is judged as the seal's is.
 */

import { Buffer } from 'node:buffer'
import { createHash, type X509Certificate } from 'node:crypto'
import { chainVerdict, verifySignedData, verifyTimestampToken } from './signature-cms-service'
import { OID } from './signature-der-service'
import {
  recordedHeadTimestamp,
  type CryptographicCheckLines,
} from './signature-export-verification-service'
import {
  chainHeadImprint,
  lastPdfSignature,
  sha256Bytes,
  signedSpans,
} from './signature-seal-service'
import type { ExportManifest, VerifyReport } from '@/domain/models/api/signatures/export'

type Line = VerifyReport['checks'][number]

const fileBytes = (file: ExportManifest['files'][number]): Uint8Array =>
  new Uint8Array(Buffer.from(file.contentBase64, 'base64'))

/** The trust verdict of a verified certificate, as a line. */
const trustLine = (input: {
  readonly check: Line['check']
  readonly certificate: X509Certificate
  readonly pool: readonly X509Certificate[]
  readonly trusted: readonly X509Certificate[]
  readonly what: string
}): Line => {
  const { check, certificate, pool, trusted, what } = input
  const verdict = chainVerdict(certificate, pool, trusted)
  if (verdict.kind === 'broken') return { check, outcome: 'fail', detail: verdict.reason }
  if (verdict.kind === 'trusted') return { check, outcome: 'pass' }
  return {
    check,
    outcome: 'untrusted',
    detail: `${what} verifies, but its certificate leads to ${verdict.root.subject.replace(/\n/g, ', ')} (SHA-256 ${verdict.root.fingerprint256}), a root this verifier was not given`,
  }
}

/** Why the seal of one sealed document does not hold, or its trust line. */
const documentSealLine = async (input: {
  readonly name: string
  readonly bytes: Uint8Array
  readonly certificateSha256: string
  readonly level: string
  readonly trusted: readonly X509Certificate[]
}): Promise<Line> => {
  const signature = lastPdfSignature(input.bytes)
  if (signature === undefined) {
    return { check: 'seal', outcome: 'fail', detail: `${input.name} carries no seal` }
  }
  if (!signature.coversWholeFile) {
    return {
      check: 'seal',
      outcome: 'fail',
      detail: `the seal of ${input.name} does not cover the whole file`,
    }
  }
  const checked = await verifySignedData({
    contentInfoDer: signature.cms,
    detachedContent: signedSpans(input.bytes, signature.byteRange),
    requireSigningCertificate: true,
  })
  if (!checked.ok) {
    return { check: 'seal', outcome: 'fail', detail: `${input.name}: ${checked.reason}` }
  }
  const sealer = checked.value.signer
  const fingerprint = createHash('sha256').update(new Uint8Array(sealer.raw)).digest('hex')
  if (fingerprint !== input.certificateSha256) {
    return {
      check: 'seal',
      outcome: 'fail',
      detail: `${input.name} is sealed with another certificate than the one the evidence recorded`,
    }
  }
  if (input.level === 'b-t') {
    const [token] = checked.value.unsignedAttributes.get(OID.signatureTimeStampToken) ?? []
    const stamped =
      token === undefined
        ? undefined
        : await verifyTimestampToken(token, sha256Bytes(checked.value.signatureValue))
    if (stamped === undefined || !stamped.ok) {
      return {
        check: 'seal',
        outcome: 'fail',
        detail: `the seal of ${input.name} lacks the timestamp its level requires`,
      }
    }
  }
  return trustLine({
    ...{ check: 'seal', certificate: sealer, pool: checked.value.certificates },
    ...{ trusted: input.trusted, what: 'The seal' },
  })
}

/** The seal line: every sealed document's seal holds, else the first that does not. */
const sealLine = async (
  manifest: ExportManifest,
  trusted: readonly X509Certificate[]
): Promise<Line | undefined> => {
  const sealed = manifest.evidence.events.find((event) => event.type === 'sealed')
  const certificateSha256 = sealed?.data['certificateSha256']
  if (typeof certificateSha256 !== 'string') return undefined
  const documents = manifest.files.filter(
    (file) => file.role === 'signed-document' || file.role === 'proof'
  )
  if (documents.length === 0) {
    return { check: 'seal', outcome: 'fail', detail: 'the sealed documents are not in the export' }
  }
  const lines = await Promise.all(
    documents.map((file) =>
      documentSealLine({
        ...{ name: file.path, bytes: fileBytes(file), certificateSha256, trusted },
        level: String(sealed?.data['level']),
      })
    )
  )
  return (
    lines.find((line) => line.outcome === 'fail') ??
    lines.find((line) => line.outcome === 'untrusted') ??
    lines[0]
  )
}

/** The timestamp line of the chain head. */
const timestampLine = async (
  manifest: ExportManifest,
  trusted: readonly X509Certificate[]
): Promise<Line | undefined> => {
  const recorded = recordedHeadTimestamp(manifest)
  if (recorded === undefined) return undefined
  const completed = manifest.evidence.events.find((event) => event.type === 'completed')
  const anchored = manifest.evidence.events.some(
    (event) => event.hash === recorded.anchoredHash && event.seq < (completed?.seq ?? 0)
  )
  if (!anchored) {
    return {
      check: 'timestamp',
      outcome: 'fail',
      detail: 'the timestamp stamps no event of this chain',
    }
  }
  const stamped = await verifyTimestampToken(
    new Uint8Array(Buffer.from(recorded.token, 'base64')),
    chainHeadImprint(recorded.anchoredHash)
  )
  if (!stamped.ok) return { check: 'timestamp', outcome: 'fail', detail: stamped.reason }
  return trustLine({
    ...{ check: 'timestamp', certificate: stamped.value.authority },
    ...{ pool: stamped.value.certificates, trusted },
    what: `The timestamp of ${stamped.value.genTime.toISOString()}`,
  })
}

/**
 * The seal and timestamp lines of `manifest`, checked against the roots in
 * `trusted`; a line is left out when the export carries nothing to check.
 */
export const cryptographicCheckLines = async (
  manifest: ExportManifest,
  trusted: readonly X509Certificate[]
): Promise<CryptographicCheckLines> => ({
  seal: await sealLine(manifest, trusted),
  timestamp: await timestampLine(manifest, trusted),
})
