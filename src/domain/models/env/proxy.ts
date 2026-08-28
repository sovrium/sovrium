/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Trusted-proxy environment configuration.
 *
 * How many reverse proxies sit between the internet and this process. It is a
 * deployment fact only the operator knows, so it lives in an env var and never
 * in `app.*` schema ([internal ref]: operator concerns are env, app intent is schema).
 *
 * This number is the sole reason the app may believe a forwarding header.
 * Proxies **append** to `X-Forwarded-For`, so a value the client supplied
 * survives as the FIRST entry of the chain — trusting the left of that list
 * lets any caller pick their own rate-limit bucket. The count says how many
 * entries at the RIGHT of the chain were written by infrastructure we control,
 * which is the only part an attacker cannot forge.
 *
 * Default `0` — no proxy trusted, no forwarding header believed, keying falls
 * to the transport peer. The default is deliberately the safe one because the
 * zero-config binary is the primary distribution channel and is the deployment
 * least likely to have an operator who has read this page.
 *
 * | Deployment                       | Value |
 * | -------------------------------- | ----- |
 * | `sovrium` bound directly to a port | `0`   |
 * | Behind Caddy / nginx / Scalingo   | `1`   |
 * | Cloudflare in front of Caddy      | `2`   |
 *
 * Setting this HIGHER than the real number of proxies re-opens the bypass: the
 * resolver would reach past infrastructure-written entries into caller-supplied
 * ones. Setting it LOWER is safe but collapses every client into one bucket.
 *
 * Env var: TRUSTED_PROXY_HOPS
 */
export const TrustedProxyEnvSchema = Schema.Struct({
  hops: Schema.optional(
    Schema.FiniteFromString.pipe(
      Schema.check(
        Schema.isInt(),
        Schema.isGreaterThanOrEqualTo(0),
        Schema.isLessThanOrEqualTo(10)
      ),
      Schema.annotate({
        description:
          'Number of trusted reverse proxies in front of the app (TRUSTED_PROXY_HOPS). Default: 0 (trust no forwarding header).',
        examples: [0, 1, 2],
      })
    )
  ),
})

/**
 * Trust nothing forwarded unless the operator says otherwise.
 */
export const TRUSTED_PROXY_HOPS_DEFAULT = 0

/**
 * Decode `TRUSTED_PROXY_HOPS` into a hop count, applying the default when the
 * operator has not set it.
 *
 * Throws on a present-but-invalid value (non-integer, negative, above 10) so a
 * typo surfaces as a startup failure rather than silently degrading to `0` —
 * a silent `0` on a genuinely proxied deployment would collapse every client
 * into a single rate-limit bucket, which reads as an outage with no cause.
 */
export const parseTrustedProxyHops = (env: NodeJS.ProcessEnv = process.env): number => {
  const decoded = Schema.decodeSync(TrustedProxyEnvSchema)({
    hops: env.TRUSTED_PROXY_HOPS,
  })
  return decoded.hops ?? TRUSTED_PROXY_HOPS_DEFAULT
}
