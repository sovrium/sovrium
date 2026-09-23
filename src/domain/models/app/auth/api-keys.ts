/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Self-Service API Keys Plugin Configuration
 *
 * Opt-in switch for the Better Auth `api-key` plugin. When enabled, a
 * signed-in user can mint, list and revoke **their own** long-lived API keys
 * and use them to authenticate requests to `/api/*` via the `x-api-key`
 * header. When absent (the default), the `/api/auth/api-key/*` endpoints are
 * not mounted and answer **404**, exactly like every other optional auth
 * plugin.
 *
 * ## Deliberately a bare boolean
 *
 * The plugin exposes a large tuning surface (rate limits, refill intervals,
 * key length, prefix, custom hashers, per-key permission grants). None of it
 * is reachable from config in v1, and that is a decision rather than an
 * oversight:
 *
 * - **Permissions are never author-controlled.** A key inherits the role of
 *   the user who created it, derived server-side from `referenceId`. There is
 *   no config path — and no request path — by which a caller can widen a key
 * beyond their own role..
 * - **Ownership is never author-controlled.** A key always belongs to the
 *   session that created it. There is no admin-manages-others mode, so no
 *   config expresses one.
 * - Every remaining knob would be an *inert* property until something reads
 *   it. Widening this to `Schema.Union([Schema.Boolean, Schema.Struct({...})])`
 *   later is purely additive and breaks no existing config, so the cost of
 *   starting minimal is zero.
 *
 * @example
 * ```yaml
 * auth:
 *   strategies:
 *     - type: emailAndPassword
 *   apiKeys: true
 * ```
 */
export const AuthApiKeysConfigSchema = Schema.Boolean.pipe(
  Schema.annotate({
    defaultNote: 'false',
    title: 'Self-Service API Keys',
    description:
      'Enable self-service API keys: a signed-in user can create, list and revoke their own keys and authenticate /api/* requests with the x-api-key header. Keys inherit their creator’s role.',
    examples: [true],
  })
)

/** @public */
export type AuthApiKeysConfig = Schema.Schema.Type<typeof AuthApiKeysConfigSchema>
