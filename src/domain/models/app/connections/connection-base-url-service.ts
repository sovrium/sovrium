/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveEnvInString } from '@/domain/models/app/env-reference-service'

const TOKEN_FIELD_REF = /^\$token\.([a-z_][a-z0-9_]*)/

/**
 * The connection's API root: literal, `$env.VAR`, or `$token.FIELD` read from
 * the fields the provider returned with the stored token. Read by
 * `connection/call` to join an operation's path onto it, and by the `http` and
 * `webhook` actions to know the one origin a connection's credential may go to.
 */
export const resolveBaseUrl = (
  envLookup: Readonly<Record<string, string>> | undefined,
  declared: string | undefined,
  tokenFields: Readonly<Record<string, string>> | undefined
): { readonly ok: true; readonly url: string } | { readonly ok: false; readonly error: string } => {
  const baseUrl = declared ?? ''
  const field = baseUrl.match(TOKEN_FIELD_REF)?.[1]
  if (field !== undefined) {
    const value = tokenFields?.[field]
    return value === undefined || value === ''
      ? { ok: false, error: `the stored token carries no ${field}; reconnect the connection` }
      : { ok: true, url: baseUrl.replace(TOKEN_FIELD_REF, value) }
  }
  return { ok: true, url: resolveEnvInString(baseUrl, envLookup ?? {}) }
}
