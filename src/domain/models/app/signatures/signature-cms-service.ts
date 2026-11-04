/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Checking a CMS `SignedData` the way this server writes one, offline: a
 * PAdES seal (detached over a PDF's byte ranges) and an RFC 3161 timestamp
 * token (its `TSTInfo` encapsulated).
 *
 * {@link verifySignedData} checks one signer: the certificate the signer
 * identifier names is in the structure, the `content-type` attribute names
 * the content, `message-digest` is the SHA-256 of that content, a
 * `signing-certificate-v2` attribute (required for a seal) names that same
 * certificate, and the signature over the signed attributes, re-spelled as
 * the DER `SET OF` that was signed, verifies with its key.
 *
 * {@link chainVerdict} then walks the certificates from the signer up, each
 * one's signature checked with its issuer's key, and says whether the walk
 * reaches a certificate the caller trusts. A chain that verifies but ends at
 * a self-signed root nobody named is `untrusted`, never `broken`: the
 * cryptography holds, the trust is the reader's to give.
 *
 * {@link verifyTimestampToken} adds what RFC 3161 asks of a token: the
 * content is a `TSTInfo`, its message imprint is SHA-256 over the bytes the
 * caller expected, and the signing certificate carries the `timeStamping`
 * extended key usage.
 *
 * Pure over its inputs; never throws (a structure that does not parse is a
 * failure with its reason).
 */

import { createHash, verify as verifySignature, X509Certificate } from 'node:crypto'
import { asn1Modules, OID, type Asn1Modules } from './signature-der-service'
import { derObjectIdentifier, derSetOf } from './signature-der-service'
import type { Attribute, SignedData, SignerInfo } from '@peculiar/asn1-cms'
import type { TSTInfo } from '@peculiar/asn1-tsp'

/** A signed structure that checked out, with what a caller reads next. */
export interface VerifiedSignedData {
  readonly signer: X509Certificate
  /** Every certificate the structure carries. */
  readonly certificates: readonly X509Certificate[]
  readonly signatureValue: Uint8Array
  /** The encapsulated content, when the structure carries it. */
  readonly content?: Uint8Array | undefined
  /** The unsigned attribute values by OID. */
  readonly unsignedAttributes: ReadonlyMap<string, readonly Uint8Array[]>
}

/** The outcome of a check: what checked out, or why not. */
export type Checked<A> =
  { readonly ok: true; readonly value: A } | { readonly ok: false; readonly reason: string }

const refused = (reason: string): { readonly ok: false; readonly reason: string } => ({
  ok: false,
  reason,
})

const sha256 = (bytes: Uint8Array): Uint8Array =>
  new Uint8Array(createHash('sha256').update(bytes).digest())

const sameBytes = (left: Uint8Array, right: Uint8Array): boolean =>
  Buffer.from(left).equals(Buffer.from(right))

/** The first value of the signed attribute `oid`, or `undefined`. */
const attributeValue = (
  attributes: readonly Attribute[] | undefined,
  oid: string
): Uint8Array | undefined => {
  const values = attributes?.find((attribute) => attribute.attrType === oid)?.attrValues
  return values?.[0] === undefined ? undefined : new Uint8Array(values[0])
}

/** The certificate the signer identifier names, among `certificates`. */
const signerCertificate = (
  modules: Asn1Modules,
  signerInfo: Readonly<SignerInfo>,
  certificates: readonly { readonly der: Uint8Array; readonly x509: X509Certificate }[]
): X509Certificate | undefined => {
  const { schema, x509 } = modules
  const sid = signerInfo.sid.issuerAndSerialNumber
  if (sid === undefined) return undefined
  const wantedIssuer = Buffer.from(schema.AsnConvert.serialize(sid.issuer))
  const wantedSerial = Buffer.from(sid.serialNumber)
  return certificates.find((certificate) => {
    const parsed = schema.AsnConvert.parse(certificate.der, x509.Certificate).tbsCertificate
    return (
      Buffer.from(schema.AsnConvert.serialize(parsed.issuer)).equals(wantedIssuer) &&
      Buffer.from(parsed.serialNumber).equals(wantedSerial)
    )
  })?.x509
}

/** Whether `signature` over `data` verifies with `certificate`'s key, under `algorithm`. */
const signatureHolds = (
  certificate: X509Certificate,
  algorithm: string,
  data: Uint8Array,
  signature: Uint8Array
): boolean => {
  const key = certificate.publicKey
  if (algorithm === OID.ecdsaWithSha256 && key.asymmetricKeyType === 'ec') {
    return verifySignature('sha256', data, { key, dsaEncoding: 'der' }, signature)
  }
  const rsaAlgorithm = algorithm === OID.sha256WithRsa || algorithm === OID.rsaEncryption
  if (rsaAlgorithm && key.asymmetricKeyType === 'rsa') {
    return verifySignature('sha256', data, key, signature)
  }
  return false
}

/** The signed attributes' own checks: content type, digest, and the certificate they name. */
const attributesBreak = (input: {
  readonly modules: Asn1Modules
  readonly signerInfo: Readonly<SignerInfo>
  readonly contentType: string
  readonly content: Uint8Array
  readonly signerDer: Uint8Array
  readonly requireSigningCertificate: boolean
}): string | undefined => {
  const { schema } = input.modules
  const attributes = input.signerInfo.signedAttrs
  if (attributes === undefined) return 'the signature carries no signed attributes'
  const contentType = attributeValue(attributes, OID.contentType)
  if (
    contentType === undefined ||
    !sameBytes(contentType, derObjectIdentifier(input.contentType))
  ) {
    return 'the content-type attribute does not name the signed content'
  }
  const digest = attributeValue(attributes, OID.messageDigest)
  const digestValue =
    digest === undefined
      ? undefined
      : new Uint8Array(schema.AsnConvert.parse(digest, schema.OctetString).buffer)
  if (digestValue === undefined || !sameBytes(digestValue, sha256(input.content))) {
    return 'the message digest is not the SHA-256 of the signed content'
  }
  const signingCertificate = attributeValue(attributes, OID.signingCertificateV2)
  if (signingCertificate === undefined) {
    return input.requireSigningCertificate
      ? 'the signature does not name its certificate (signing-certificate-v2)'
      : undefined
  }
  // The first ESSCertIDv2 of the attribute must hold the certificate's SHA-256 as its
  // `certHash` OCTET STRING. Read by its spelling (`04 20` and the 32 octets): the
  // schema package refuses an ESSCertIDv2 whose `hashAlgorithm` takes its default.
  const wanted = Uint8Array.from([0x04, 0x20, ...sha256(input.signerDer)])
  return Buffer.from(signingCertificate).includes(Buffer.from(wanted))
    ? undefined
    : 'the signing-certificate attribute names another certificate'
}

/** The unsigned attributes of `signerInfo`, by OID. */
const unsignedOf = (signerInfo: Readonly<SignerInfo>): ReadonlyMap<string, readonly Uint8Array[]> =>
  new Map(
    (signerInfo.unsignedAttrs ?? []).map((attribute) => [
      attribute.attrType,
      attribute.attrValues.map((value) => new Uint8Array(value)),
    ])
  )

/** Parse `contentInfoDer` as a CMS `SignedData`. */
const signedDataOf = (
  modules: Asn1Modules,
  contentInfoDer: Uint8Array
): Readonly<SignedData> | undefined => {
  const { schema, cms } = modules
  const info = schema.AsnConvert.parse(contentInfoDer, cms.ContentInfo)
  return info.contentType === OID.signedData
    ? schema.AsnConvert.parse(info.content, cms.SignedData)
    : undefined
}

/** The certificates of `signedData`, as DER and as `X509Certificate`. */
const certificatesOf = (modules: Asn1Modules, signedData: Readonly<SignedData>) =>
  (signedData.certificates ?? [])
    .map((choice) => choice.certificate)
    .filter((certificate) => certificate !== undefined)
    .map((certificate) => {
      const der = new Uint8Array(modules.schema.AsnConvert.serialize(certificate))
      return { der, x509: new X509Certificate(Buffer.from(der)) }
    })

/** What one signer of a parsed structure is checked with. */
interface SignerUnderCheck {
  readonly signerInfo: Readonly<SignerInfo>
  readonly signer: X509Certificate
  readonly certificates: readonly { readonly der: Uint8Array; readonly x509: X509Certificate }[]
  readonly content: Uint8Array
  readonly encapsulated?: ArrayBuffer | undefined
}

/** The one signer of `signedData` with the content it signs, or why it cannot be checked. */
const signerUnderCheck = (
  modules: Asn1Modules,
  signedData: Readonly<SignedData>,
  detachedContent: Uint8Array | undefined
): Checked<SignerUnderCheck> => {
  const signerInfo = signedData.signerInfos[0]
  if (signerInfo === undefined || signedData.signerInfos.length !== 1) {
    return refused('the structure does not carry exactly one signer')
  }
  if (signerInfo.digestAlgorithm.algorithm !== OID.sha256) {
    return refused('the signature does not use SHA-256')
  }
  const encapsulated = signedData.encapContentInfo.eContent?.single?.buffer
  const content =
    detachedContent ?? (encapsulated === undefined ? undefined : new Uint8Array(encapsulated))
  if (content === undefined) return refused('there is no content to check the signature over')
  const certificates = certificatesOf(modules, signedData)
  const signer = signerCertificate(modules, signerInfo, certificates)
  return signer === undefined
    ? refused('the signer certificate is not in the structure')
    : { ok: true, value: { signerInfo, signer, certificates, content, encapsulated } }
}

/** Check the signed attributes and the signature of one signer under check. */
const checkSigner = (
  modules: Asn1Modules,
  signedData: Readonly<SignedData>,
  checked: SignerUnderCheck,
  requireSigningCertificate: boolean
): Checked<VerifiedSignedData> => {
  const { signerInfo, signer, content, encapsulated } = checked
  const broken = attributesBreak({
    ...{ modules, signerInfo, content, signerDer: new Uint8Array(signer.raw) },
    contentType: signedData.encapContentInfo.eContentType,
    requireSigningCertificate,
  })
  if (broken !== undefined) return refused(broken)
  const signedBytes = derSetOf(
    (signerInfo.signedAttrs ?? []).map(
      (attribute) => new Uint8Array(modules.schema.AsnConvert.serialize(attribute))
    )
  )
  const signatureValue = new Uint8Array(signerInfo.signature.buffer)
  if (
    !signatureHolds(signer, signerInfo.signatureAlgorithm.algorithm, signedBytes, signatureValue)
  ) {
    return refused('the signature does not verify with its certificate')
  }
  return {
    ok: true,
    value: {
      ...{ signer, signatureValue, unsignedAttributes: unsignedOf(signerInfo) },
      certificates: checked.certificates.map((certificate) => certificate.x509),
      content: encapsulated === undefined ? undefined : new Uint8Array(encapsulated),
    },
  }
}

/** The reason an exception gives, as a sentence. */
const parseFailure = (error: unknown): { readonly ok: false; readonly reason: string } =>
  refused(`the structure does not parse: ${error instanceof Error ? error.message : String(error)}`)

/**
 * Check the one signer of the CMS `contentInfoDer`: over `detachedContent`
 * when given, else over the content it encapsulates.
 */
export const verifySignedData = async (input: {
  readonly contentInfoDer: Uint8Array
  readonly detachedContent?: Uint8Array
  readonly requireSigningCertificate: boolean
}): Promise<Checked<VerifiedSignedData>> => {
  try {
    const modules = await asn1Modules()
    const signedData = signedDataOf(modules, input.contentInfoDer)
    if (signedData === undefined) return refused('not a CMS SignedData')
    const checked = signerUnderCheck(modules, signedData, input.detachedContent)
    return checked.ok
      ? checkSigner(modules, signedData, checked.value, input.requireSigningCertificate)
      : checked
  } catch (error) {
    return parseFailure(error)
  }
}

/** Where a certificate chain leads. */
export type ChainVerdict =
  | { readonly kind: 'trusted'; readonly root: X509Certificate }
  | { readonly kind: 'untrusted'; readonly root: X509Certificate }
  | { readonly kind: 'broken'; readonly reason: string }

/** The longest chain this walk follows: a real one is three or four certificates. */
const MAX_CHAIN_LENGTH = 8

/** Whether `certificate` is the same certificate as one of `trusted`. */
const isTrusted = (certificate: X509Certificate, trusted: readonly X509Certificate[]): boolean =>
  trusted.some((anchor) => anchor.fingerprint256 === certificate.fingerprint256)

/**
 * Walk from `leaf` up through `pool` (the certificates the structure carries,
 * then `trusted`), checking each signature with its issuer's key, until a
 * trusted certificate or a self-signed root.
 */
export const chainVerdict = (
  leaf: X509Certificate,
  pool: readonly X509Certificate[],
  trusted: readonly X509Certificate[]
): ChainVerdict => {
  const candidates = [...pool, ...trusted]
  const walk = (current: X509Certificate, depth: number): ChainVerdict => {
    if (isTrusted(current, trusted)) return { kind: 'trusted', root: current }
    if (depth >= MAX_CHAIN_LENGTH) return { kind: 'broken', reason: 'the chain is too long' }
    if (current.issuer === current.subject) {
      return current.verify(current.publicKey)
        ? { kind: 'untrusted', root: current }
        : { kind: 'broken', reason: `${current.subject} is not signed by its own key` }
    }
    const issuer = candidates.find(
      (candidate) =>
        candidate.subject === current.issuer &&
        candidate.fingerprint256 !== current.fingerprint256 &&
        current.verify(candidate.publicKey)
    )
    if (issuer === undefined) {
      return { kind: 'broken', reason: `no certificate of the chain signed ${current.subject}` }
    }
    return walk(issuer, depth + 1)
  }
  return walk(leaf, 0)
}

/** A timestamp token that checked out. */
export interface VerifiedTimestamp {
  readonly genTime: Date
  readonly authority: X509Certificate
  readonly certificates: readonly X509Certificate[]
}

/** Why a token's `TSTInfo` and signer do not stamp `imprint`, or `undefined`. */
const tokenBreak = (
  info: Readonly<TSTInfo>,
  imprint: Uint8Array,
  signer: X509Certificate
): string | undefined => {
  if (info.messageImprint.hashAlgorithm.algorithm !== OID.sha256) {
    return 'the token imprint is not SHA-256'
  }
  if (!sameBytes(new Uint8Array(info.messageImprint.hashedMessage.buffer), imprint)) {
    return 'the token stamps other bytes'
  }
  return (signer.keyUsage ?? []).includes(OID.timeStamping)
    ? undefined
    : 'the token is signed by a certificate not allowed to stamp time'
}

/**
 * Check the RFC 3161 token `tokenDer`: a valid signed structure over a
 * `TSTInfo` whose imprint is SHA-256 `imprint`, signed by a certificate
 * allowed to stamp time.
 */
export const verifyTimestampToken = async (
  tokenDer: Uint8Array,
  imprint: Uint8Array
): Promise<Checked<VerifiedTimestamp>> => {
  const signed = await verifySignedData({
    contentInfoDer: tokenDer,
    requireSigningCertificate: false,
  })
  if (!signed.ok) return signed
  try {
    const modules = await asn1Modules()
    const signedData = signedDataOf(modules, tokenDer)
    if (signedData?.encapContentInfo.eContentType !== OID.tstInfo) {
      return refused('the token does not carry a TSTInfo')
    }
    const { content } = signed.value
    if (content === undefined) return refused('the token carries no TSTInfo')
    const info = modules.schema.AsnConvert.parse(content, modules.tsp.TSTInfo)
    const broken = tokenBreak(info, imprint, signed.value.signer)
    if (broken !== undefined) return refused(broken)
    return {
      ok: true,
      value: {
        genTime: info.genTime,
        authority: signed.value.signer,
        certificates: signed.value.certificates,
      },
    }
  } catch (error) {
    return refused(
      `the token does not parse: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}
