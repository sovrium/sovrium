/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createHash, createHmac } from 'node:crypto'

/** The request to sign: what goes on the wire, byte for byte. */
export interface SigV4Request {
  readonly method: string
  readonly url: URL
  /** Headers to sign besides `host` and `x-amz-date`, which are always signed. */
  readonly headers: Readonly<Record<string, string>>
  readonly body: string
}

export interface SigV4Credentials {
  readonly accessKeyId: string
  readonly secretAccessKey: string
  readonly region: string
  readonly service: string
}

const sha256Hex = (value: string): string =>
  createHash('sha256').update(value, 'utf8').digest('hex')

const hmac = (key: Buffer | string, value: string): Buffer =>
  createHmac('sha256', key).update(value, 'utf8').digest()

/** `20261006T101500Z` — the ISO 8601 basic form AWS signs. */
export const toAmzDate = (epochMillis: number): string =>
  new Date(epochMillis)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')

/**
 * The canonical query string: every pair URI-encoded and sorted by name,
 * then by value. Empty for a request without one.
 */
const canonicalQuery = (search: string): string =>
  [...new URLSearchParams(search).entries()]
    .map(([name, value]) => [encodeRfc3986(name), encodeRfc3986(value)] as const)
    .toSorted(([a, av], [b, bv]) => (a === b ? av.localeCompare(bv) : a < b ? -1 : 1))
    .map(([name, value]) => `${name}=${value}`)
    .join('&')

/** `encodeURIComponent`, plus the four characters RFC 3986 reserves and it leaves alone. */
const encodeRfc3986 = (value: string): string =>
  encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  )

/**
 * Sign a request with AWS Signature Version 4, as AWS documents the algorithm:
 * canonical request, string to sign, a signing key derived from the secret
 * through the day, region and service, then the HMAC of the string to sign.
 *
 * Returns the headers to send: `x-amz-date` and `authorization`, merged over the caller's. The secret never travels — only
 * a signature computed from it over these exact bytes.
 *
 * `host` is signed from the URL, which is what `fetch` sends in the `Host`
 * header, port included when it is not the scheme's default.
 */
export const signSigV4 = (
  request: SigV4Request,
  credentials: SigV4Credentials,
  epochMillis: number
): Readonly<Record<string, string>> => {
  const amzDate = toAmzDate(epochMillis)
  const day = amzDate.slice(0, 8)
  const payloadHash = sha256Hex(request.body)
  const toSign: Readonly<Record<string, string>> = {
    ...Object.fromEntries(
      Object.entries(request.headers).map(([name, value]) => [name.toLowerCase(), value])
    ),
    host: request.url.host,
    'x-amz-date': amzDate,
  }
  const names = Object.keys(toSign).toSorted()
  const signedHeaders = names.join(';')
  const canonicalHeaders = names
    .map((name) => `${name}:${(toSign[name] ?? '').trim().replace(/\s+/g, ' ')}\n`)
    .join('')
  const canonicalRequest = [
    request.method.toUpperCase(),
    request.url.pathname === '' ? '/' : request.url.pathname,
    canonicalQuery(request.url.search),
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n')
  const scope = `${day}/${credentials.region}/${credentials.service}/aws4_request`
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256Hex(canonicalRequest)].join('\n')
  const signingKey = hmac(
    hmac(
      hmac(hmac(`AWS4${credentials.secretAccessKey}`, day), credentials.region),
      credentials.service
    ),
    'aws4_request'
  )
  const signature = createHmac('sha256', signingKey).update(stringToSign, 'utf8').digest('hex')
  return {
    ...request.headers,
    'x-amz-date': amzDate,
    authorization: `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  }
}
