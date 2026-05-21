/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { computeHmacSignature } from './signature'
import type { Webhook } from '@/domain/models/app/tables/webhooks'

const resolveEnvRef = (value: string): string =>
  value.startsWith('$env.') ? (process.env[value.slice('$env.'.length)] ?? '') : value

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
