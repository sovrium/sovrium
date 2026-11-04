/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The two messages of an RFC 3161 exchange: the `TimeStampReq` this server
 * sends and the `TimeStampResp` it accepts.
 *
 * A request carries the SHA-256 imprint to stamp, a fresh random nonce and
 * `certReq: true`, so the token names the authority's certificate and can be
 * checked offline later. A response is accepted only when its status grants
 * a token (`granted` or `grantedWithMods`), the token is a valid signed
 * structure from a certificate allowed to stamp time, its `TSTInfo` stamps
 * exactly the imprint asked for, and it echoes the nonce sent: a token
 * replayed from another exchange, or stamping other bytes, is refused.
 */

import { randomBytes } from 'node:crypto'
import {
  verifyTimestampToken,
  type Checked,
} from '@/domain/models/app/signatures/signature-cms-service'
import {
  asn1Modules,
  OID,
  arrayBufferOf,
} from '@/domain/models/app/signatures/signature-der-service'

/** One timestamp request, with the nonce its answer must echo. */
export interface TimestampQuery {
  readonly der: Uint8Array
  readonly nonce: Uint8Array
}

/** Eight random octets read as a positive INTEGER (its top bit clear, never zero). */
const freshNonce = (): Uint8Array => {
  const bytes = new Uint8Array(randomBytes(8))
  return Uint8Array.from(bytes, (octet, index) => (index === 0 ? (octet & 0x7f) | 0x01 : octet))
}

/** A `TimeStampReq` for the SHA-256 `imprint`. */
export const timestampQuery = async (imprint: Uint8Array): Promise<TimestampQuery> => {
  const { schema, x509, tsp } = await asn1Modules()
  const nonce = freshNonce()
  const request = new tsp.TimeStampReq({
    version: 1,
    messageImprint: new tsp.MessageImprint({
      hashAlgorithm: new x509.AlgorithmIdentifier({ algorithm: OID.sha256 }),
      hashedMessage: new schema.OctetString(imprint),
    }),
    nonce: arrayBufferOf(nonce),
    certReq: true,
  })
  return { der: new Uint8Array(schema.AsnConvert.serialize(request)), nonce }
}

/** The status values that grant a token. */
const GRANTED = new Set([0, 1])

/** Leading zero octets dropped, so two spellings of one INTEGER compare equal. */
const integerOctets = (bytes: Uint8Array): string => {
  const first = bytes.findIndex((octet) => octet !== 0)
  return Buffer.from(first === -1 ? [] : bytes.subarray(first)).toString('hex')
}

/** The nonce the token of `token` (a `TimeStampToken`, DER) echoes, as hexadecimal. */
const echoedNonce = async (token: Uint8Array): Promise<string | undefined> => {
  const { schema, cms, tsp } = await asn1Modules()
  const info = schema.AsnConvert.parse(token, cms.ContentInfo)
  const signedData = schema.AsnConvert.parse(info.content, cms.SignedData)
  const content = signedData.encapContentInfo.eContent?.single?.buffer
  if (content === undefined) return undefined
  const { nonce } = schema.AsnConvert.parse(content, tsp.TSTInfo)
  return nonce === undefined ? undefined : integerOctets(new Uint8Array(nonce))
}

/** The token a `TimeStampResp` grants, as DER, or why it grants none. */
const grantedToken = async (responseDer: Uint8Array): Promise<Checked<Uint8Array>> => {
  const { schema, tsp } = await asn1Modules()
  const response = schema.AsnConvert.parse(responseDer, tsp.TimeStampResp)
  if (!GRANTED.has(response.status.status) || response.timeStampToken === undefined) {
    return { ok: false, reason: `the authority refused (status ${response.status.status})` }
  }
  return { ok: true, value: new Uint8Array(schema.AsnConvert.serialize(response.timeStampToken)) }
}

/** The token of `responseDer`, answering `query` for `imprint`, or why it is refused. */
export const timestampTokenOf = async (
  responseDer: Uint8Array,
  query: TimestampQuery,
  imprint: Uint8Array
): Promise<Checked<Uint8Array>> => {
  try {
    const token = await grantedToken(responseDer)
    if (!token.ok) return token
    const checked = await verifyTimestampToken(token.value, imprint)
    if (!checked.ok) return checked
    return (await echoedNonce(token.value)) === integerOctets(query.nonce)
      ? token
      : { ok: false, reason: 'the token does not echo the nonce of this request' }
  } catch (error) {
    return {
      ok: false,
      reason: `the answer is not a timestamp response: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}
