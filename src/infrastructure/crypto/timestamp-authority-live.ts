/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `TimestampAuthority` over `SIGNATURE_TSA_URL`: one RFC 3161 POST per stamp.
 *
 * The URL is the operator's own (no default), so the request goes straight
 * out rather than through `guardedFetch`, which would refuse a timestamp
 * authority on the operator's private network and, worse, rewrite a POST into
 * a GET on a redirect. A redirect is refused outright (`redirect: 'error'`):
 * a timestamp request is answered where it was sent, or not at all. The
 * exchange is bounded in time (no headers, or a body that stalls, within
 * {@link TSA_TIMEOUT_MS} aborts it) and in size, and the answer is checked
 * before it is returned (`rfc3161-messages.ts`): status, imprint, nonce and
 * the certificate that signed it.
 */

import { Effect, Layer } from 'effect'
import { ProcessEnv } from '@/application/ports/services/process-env'
import {
  TimestampAuthority,
  TimestampFailure,
} from '@/application/ports/services/timestamp-authority'
import { parseSignatureEnv } from '@/domain/models/process-env/signatures'
import { withFetchStallTimeout } from '@/infrastructure/egress/with-fetch-timeout'
import { timestampQuery, timestampTokenOf } from './rfc3161-messages'

/** How long an authority may take to answer, or pause while answering. */
const TSA_TIMEOUT_MS = 10_000

/** The largest answer read: a token with its certificate chain is a few kilobytes. */
const MAX_TSA_RESPONSE_BYTES = 256 * 1024

/** The configured authority URL, or `undefined`. */
const authorityUrl = Effect.map(ProcessEnv, (env) => {
  const parsed = parseSignatureEnv(env)
  return parsed.ok ? parsed.config.tsaUrl : undefined
})

/** The body of `response`, refused past {@link MAX_TSA_RESPONSE_BYTES}. */
const boundedBody = async (response: Response): Promise<Uint8Array> => {
  if (!response.ok) throw new Error(`the authority answered HTTP ${String(response.status)}`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.length > MAX_TSA_RESPONSE_BYTES) throw new Error('the authority answer is too large')
  return bytes
}

/** Ask `url` to stamp `imprint`; the checked token. */
const stampAt = async (url: string, imprint: Uint8Array): Promise<Uint8Array> => {
  const query = await timestampQuery(imprint)
  const answer = await withFetchStallTimeout(
    url,
    {
      method: 'POST',
      headers: { 'content-type': 'application/timestamp-query' },
      body: Buffer.from(query.der),
      redirect: 'error',
    },
    TSA_TIMEOUT_MS,
    boundedBody
  )
  const token = await timestampTokenOf(answer, query, imprint)
  if (!token.ok) throw new Error(token.reason)
  return token.value
}

export const TimestampAuthorityLive = Layer.succeed(
  TimestampAuthority,
  TimestampAuthority.of({
    authority: authorityUrl,
    stamp: Effect.fn('signatures.timestamp')(function* (imprint: Uint8Array) {
      const url = yield* authorityUrl
      if (url === undefined) {
        return yield* new TimestampFailure({ message: 'No timestamp authority is configured' })
      }
      return yield* Effect.tryPromise({
        try: () => stampAt(url, imprint),
        catch: (cause) =>
          new TimestampFailure({
            message: `The timestamp authority gave no usable token: ${cause instanceof Error ? cause.message : String(cause)}`,
            cause,
          }),
      })
    }),
  })
)
