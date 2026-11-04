/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The ASN.1 vocabulary of the organisation seal and the timestamp: the
 * `@peculiar/asn1-*` schema modules, loaded on first use (a server that never
 * seals a document never parses them), the OIDs they name, and the few DER
 * spellings written by hand.
 *
 * Only the schema packages are used. `@peculiar/x509`, `pkijs` and `asn1js`
 * are not: the first drags a dependency-injection runtime in, the second is a
 * whole PKI toolkit where five schemas do. Keys and signatures go through
 * `node:crypto`.
 *
 * By hand: `@peculiar/asn1-schema` has no class for a bare OBJECT IDENTIFIER
 * value (the `content-type` signed attribute is one), and a CMS signer signs
 * its signed attributes as a DER `SET OF` (tag `0x31`) whose members are
 * sorted by their encoding, while the structure embeds them as `[0] IMPLICIT`.
 *
 * Pure: bytes and values in, bytes and values out.
 */

import type * as Asn1Cms from '@peculiar/asn1-cms'
import type * as Asn1Ess from '@peculiar/asn1-ess'
import type * as Asn1Schema from '@peculiar/asn1-schema'
import type * as Asn1Tsp from '@peculiar/asn1-tsp'
import type * as Asn1X509 from '@peculiar/asn1-x509'

/** The modules, once loaded. */
export interface Asn1Modules {
  readonly schema: typeof Asn1Schema
  readonly x509: typeof Asn1X509
  readonly cms: typeof Asn1Cms
  readonly ess: typeof Asn1Ess
  readonly tsp: typeof Asn1Tsp
}

/** Load the five schema modules (cached by the module loader after the first call). */
export const asn1Modules = async (): Promise<Asn1Modules> => {
  const [schema, x509, cms, ess, tsp] = await Promise.all([
    import('@peculiar/asn1-schema'),
    import('@peculiar/asn1-x509'),
    import('@peculiar/asn1-cms'),
    import('@peculiar/asn1-ess'),
    import('@peculiar/asn1-tsp'),
  ])
  return { schema, x509, cms, ess, tsp }
}

/** The OIDs the seal and the timestamp name. */
export const OID = {
  sha256: '2.16.840.1.101.3.4.2.1',
  rsaEncryption: '1.2.840.113549.1.1.1',
  sha256WithRsa: '1.2.840.113549.1.1.11',
  ecdsaWithSha256: '1.2.840.10045.4.3.2',
  contentType: '1.2.840.113549.1.9.3',
  messageDigest: '1.2.840.113549.1.9.4',
  signingCertificateV2: '1.2.840.113549.1.9.16.2.47',
  signatureTimeStampToken: '1.2.840.113549.1.9.16.2.14',
  data: '1.2.840.113549.1.7.1',
  signedData: '1.2.840.113549.1.7.2',
  tstInfo: '1.2.840.113549.1.9.16.1.4',
  timeStamping: '1.3.6.1.5.5.7.3.8',
} as const

/** The DER length octets of a body of `length` bytes. */
const derLength = (length: number): Uint8Array => {
  if (length < 0x80) return Uint8Array.of(length)
  const octets = Array.from({ length: 4 }, (_, index) => (length >> (8 * (3 - index))) & 0xff)
  const significant = octets.slice(octets.findIndex((octet) => octet !== 0))
  return Uint8Array.of(0x80 | significant.length, ...significant)
}

/** One DER tag-length-value. */
export const derTlv = (tag: number, body: Uint8Array): Uint8Array =>
  Uint8Array.from([tag, ...derLength(body.length), ...body])

/** The base-128 octets of one OBJECT IDENTIFIER arc. */
const arcOctets = (arc: number): readonly number[] => {
  const groups = Array.from({ length: 5 }, (_, index) => Math.floor(arc / 128 ** (4 - index)) % 128)
  const first = groups.findIndex((group) => group !== 0)
  const used = first === -1 ? [0] : groups.slice(first)
  return used.map((group, index) => (index < used.length - 1 ? group | 0x80 : group))
}

/** The DER encoding of the OBJECT IDENTIFIER `oid` (dotted decimal). */
export const derObjectIdentifier = (oid: string): Uint8Array => {
  const [first = 0, second = 0, ...rest] = oid.split('.').map(Number)
  return derTlv(0x06, Uint8Array.from([first * 40 + second, ...rest.flatMap(arcOctets)]))
}

/** Compare two encodings as unsigned octet strings, the order DER sorts a `SET OF` in. */
export const compareOctets = (left: Uint8Array, right: Uint8Array): number => {
  const differing = Array.from({ length: Math.min(left.length, right.length) }).findIndex(
    (_, index) => left[index] !== right[index]
  )
  if (differing === -1) return left.length - right.length
  return (left[differing] ?? 0) - (right[differing] ?? 0)
}

/** The DER `SET OF` holding `members`, sorted by their encoding. */
export const derSetOf = (members: readonly Uint8Array[]): Uint8Array =>
  derTlv(0x31, Uint8Array.from(members.toSorted(compareOctets).flatMap((member) => [...member])))

/** An `ArrayBuffer` holding exactly `bytes`, the shape asn1-schema takes for raw values. */
export const arrayBufferOf = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
