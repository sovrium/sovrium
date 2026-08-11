/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { computeHmacSignature } from './signature'
import type { Webhook } from '@/domain/models/app/tables/webhooks'

/**
 * Resolve a `$env.` reference to its environment-variable value. A bare
 * string (no `$env.` prefix) is returned verbatim. Unset variables resolve
 * to an empty string so a missing secret never crashes delivery.
 */
const resolveEnvRef = (value: string): string =>
  value.startsWith('$env.') ? (process.env[value.slice('$env.'.length)] ?? '') : value

/**
 * Build the authentication headers for an outgoing webhook delivery from the
 * webhook's `auth` configuration.
 *
 * - `hmac`: computes a `<algorithm>=<hex>` signature of the request `body`
 *   and places it under the configured `header` (default `X-Signature`,
 *   default algorithm `sha256`).
 * - `apiKey`: places the static key under the configured `header`
 *   (default `X-Api-Key`).
 * - `bearer`: places `Bearer <token>` under `Authorization`.
 *
 * Secrets/keys/tokens support `$env.` references, resolved at delivery time.
 * A webhook with no `auth` produces no headers.
 *
 * @public
 */
export const buildAuthHeaders = async (
  webhook: Webhook,
  body: string
): Promise<Record<string, string>> => {
  const { auth } = webhook
  if (!auth) return {}

  if (auth.type === 'hmac') {
    const algorithm = auth.algorithm ?? 'sha256'
    const signature = await computeHmacSignature(body, resolveEnvRef(auth.secret), algorithm)
    return { [auth.header ?? 'X-Signature']: signature }
  }

  if (auth.type === 'apiKey') {
    return { [auth.header ?? 'X-Api-Key']: resolveEnvRef(auth.key) }
  }

  return { Authorization: `Bearer ${resolveEnvRef(auth.token)}` }
}
