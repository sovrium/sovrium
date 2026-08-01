/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const TrustedProxyEnvSchema = Schema.Struct({
  hops: Schema.optional(
    Schema.NumberFromString.pipe(
      Schema.int(),
      Schema.greaterThanOrEqualTo(0),
      Schema.lessThanOrEqualTo(10),
      Schema.annotations({
        description:
          'Number of trusted reverse proxies in front of the app (TRUSTED_PROXY_HOPS). Default: 0 (trust no forwarding header).',
        examples: [0, 1, 2],
      })
    )
  ),
})

export const TRUSTED_PROXY_HOPS_DEFAULT = 0

export const parseTrustedProxyHops = (env: NodeJS.ProcessEnv = process.env): number => {
  const decoded = Schema.decodeUnknownSync(TrustedProxyEnvSchema)({
    hops: env.TRUSTED_PROXY_HOPS,
  })
  return decoded.hops ?? TRUSTED_PROXY_HOPS_DEFAULT
}
