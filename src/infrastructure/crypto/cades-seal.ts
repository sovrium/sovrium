/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The CMS `SignedData` of the organisation seal: the `/Contents` of a PAdES
 * signature with `/SubFilter /ETSI.CAdES.detached`.
 *
 * Detached over `id-data`: the content is the PDF's two byte ranges, of which
 * the caller hands the SHA-256. The signed attributes are exactly the three a
 * PAdES baseline signature carries — `content-type`, `message-digest` and
 * `signing-certificate-v2` (the hash of the seal certificate, so the
 * certificate cannot be swapped) — and NOT `signing-time`: PAdES puts the
 * claimed time in the signature dictionary's `/M`, and an outside timestamp
 * is what proves one. They are signed as a DER `SET OF`, sorted by encoding,
 * and embedded as `[0] IMPLICIT` in that same order.
 *
 * The key signs with SHA-256: RSA with PKCS#1 v1.5, ECDSA with its DER
 * signature (`dsaEncoding: 'der'`). Every certificate of the chain travels in
 * the `certificates` set, leaf first.
 *
 * Level B-T adds one unsigned attribute, `signature-time-stamp-token`
 * (1.2.840.113549.1.9.16.2.14): an RFC 3161 token over the SHA-256 of the
 * signature value. The signature is computed first, so {@link prepareSeal}
 * returns it with a function that assembles the CMS with or without the
 * token the caller fetched for it.
 */

import { createHash, createPrivateKey, sign, X509Certificate } from 'node:crypto'
import {
  arrayBufferOf,
  asn1Modules,
  compareOctets,
  derObjectIdentifier,
  derSetOf,
  OID,
  type Asn1Modules,
} from '@/domain/models/app/signatures/signature-der-service'
import type { SealMaterial } from '@/domain/models/process-env/signatures'
import type { Attribute } from '@peculiar/asn1-cms'

/** A seal signature over one digest, ready to be wrapped in its CMS. */
export interface PreparedSeal {
  /** The raw signature value: what a B-T timestamp is taken over. */
  readonly signatureValue: Uint8Array
  /** SHA-256 of the seal certificate (DER), lowercase hexadecimal. */
  readonly certificateSha256: string
  /** The DER `ContentInfo` of the seal, with the timestamp token when given. */
  readonly toCms: (timestampToken?: Uint8Array) => Uint8Array
}

const sha256 = (bytes: Uint8Array): Uint8Array =>
  new Uint8Array(createHash('sha256').update(bytes).digest())

/** The DER of a PEM certificate. */
export const certificateDerOf = (pem: string): Uint8Array =>
  new Uint8Array(new X509Certificate(pem).raw)

/** The three signed attributes, sorted as the DER `SET OF` that is signed. */
const signedAttributes = (modules: Asn1Modules, digest: Uint8Array, leafDer: Uint8Array) => {
  const { schema, cms, ess } = modules
  const attributes = [
    new cms.Attribute({
      attrType: OID.contentType,
      attrValues: [arrayBufferOf(derObjectIdentifier(OID.data))],
    }),
    new cms.Attribute({
      attrType: OID.messageDigest,
      attrValues: [schema.AsnConvert.serialize(new schema.OctetString(digest))],
    }),
    new cms.Attribute({
      attrType: OID.signingCertificateV2,
      attrValues: [
        schema.AsnConvert.serialize(
          new ess.SigningCertificateV2({
            // hashAlgorithm left out: its DEFAULT is SHA-256, which DER forbids spelling.
            certs: [new ess.ESSCertIDv2({ certHash: new schema.OctetString(sha256(leafDer)) })],
          })
        ),
      ],
    }),
  ]
  return attributes
    .map((attribute) => ({
      attribute,
      der: new Uint8Array(schema.AsnConvert.serialize(attribute)),
    }))
    .toSorted((left, right) => compareOctets(left.der, right.der))
}

/** What the CMS of a seal is assembled from. */
interface SealParts {
  readonly modules: Asn1Modules
  readonly chain: readonly Uint8Array[]
  readonly leafDer: Uint8Array
  readonly attributes: readonly Attribute[]
  readonly elliptic: boolean
  readonly signatureValue: Uint8Array
}

/** The signer's `SignerInfo`, with the timestamp token as an unsigned attribute when given. */
const signerInfoOf = (parts: SealParts, timestampToken: Uint8Array | undefined) => {
  const { schema, x509, cms } = parts.modules
  const leaf = schema.AsnConvert.parse(parts.leafDer, x509.Certificate)
  return new cms.SignerInfo({
    version: 1,
    sid: new cms.SignerIdentifier({
      issuerAndSerialNumber: new cms.IssuerAndSerialNumber({
        issuer: leaf.tbsCertificate.issuer,
        serialNumber: leaf.tbsCertificate.serialNumber,
      }),
    }),
    digestAlgorithm: new x509.AlgorithmIdentifier({ algorithm: OID.sha256 }),
    signedAttrs: [...parts.attributes],
    signatureAlgorithm: new x509.AlgorithmIdentifier(
      parts.elliptic
        ? { algorithm: OID.ecdsaWithSha256 }
        : { algorithm: OID.sha256WithRsa, parameters: arrayBufferOf(Uint8Array.of(0x05, 0x00)) }
    ),
    signature: new schema.OctetString(parts.signatureValue),
    ...(timestampToken === undefined
      ? {}
      : {
          unsignedAttrs: [
            new cms.Attribute({
              attrType: OID.signatureTimeStampToken,
              attrValues: [arrayBufferOf(timestampToken)],
            }),
          ],
        }),
  })
}

/** The DER `ContentInfo` of the seal. */
const contentInfoOf = (parts: SealParts, timestampToken: Uint8Array | undefined): Uint8Array => {
  const { schema, x509, cms } = parts.modules
  const signedData = new cms.SignedData({
    version: 1,
    digestAlgorithms: new cms.DigestAlgorithmIdentifiers([
      new x509.AlgorithmIdentifier({ algorithm: OID.sha256 }),
    ]),
    encapContentInfo: new cms.EncapsulatedContentInfo({ eContentType: OID.data }),
    certificates: new cms.CertificateSet(
      parts.chain.map(
        (der) =>
          new cms.CertificateChoices({
            certificate: schema.AsnConvert.parse(der, x509.Certificate),
          })
      )
    ),
    signerInfos: new cms.SignerInfos([signerInfoOf(parts, timestampToken)]),
  })
  return new Uint8Array(
    schema.AsnConvert.serialize(
      new cms.ContentInfo({
        contentType: OID.signedData,
        content: schema.AsnConvert.serialize(signedData),
      })
    )
  )
}

/** Sign `digest` (SHA-256 of the signed byte ranges) with the seal in `material`. */
export const prepareSeal = async (
  material: SealMaterial,
  digest: Uint8Array
): Promise<PreparedSeal> => {
  const modules = await asn1Modules()
  const chain = material.chainPem.map(certificateDerOf)
  const leafDer = chain[0]
  if (leafDer === undefined) throw new Error('The seal certificate chain is empty')
  const key = createPrivateKey(material.keyPem)
  const elliptic = key.asymmetricKeyType === 'ec'
  const encoded = signedAttributes(modules, digest, leafDer)
  const signedBytes = derSetOf(encoded.map((entry) => entry.der))
  const signatureValue = new Uint8Array(
    sign('sha256', signedBytes, elliptic ? { key, dsaEncoding: 'der' } : key)
  )
  const parts: SealParts = {
    ...{ modules, chain, leafDer, elliptic, signatureValue },
    attributes: encoded.map((entry) => entry.attribute),
  }
  return {
    signatureValue,
    certificateSha256: Buffer.from(sha256(leafDer)).toString('hex'),
    toCms: (timestampToken) => contentInfoOf(parts, timestampToken),
  }
}
