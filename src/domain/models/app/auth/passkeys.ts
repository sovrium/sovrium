/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Passkeys (WebAuthn) Configuration
 *
 * Opt-in switch for passkey sign-in. A signed-in user registers a passkey —
 * a key held by their device, their password manager or a security key — and
 * then signs in with it, without a password. Passkeys sit beside the other
 * strategies: an account may hold a password, two-factor and several passkeys
 * at once.
 *
 * The relying-party id and the expected origin are DERIVED from `BASE_URL`
 * rather than configured: a passkey is bound to the host it was created on, so
 * a configurable `rpID` could only ever be right by agreeing with the origin
 * the app is already served from.
 *
 * `true` enables passkeys with the defaults; the object form adds:
 *
 * - `rpName`: the name an authenticator shows when saving the passkey
 *   (defaults to the app name).
 * - `requireForAdmin`: an admin-tier account may reach the admin plane only
 *   from a session it opened with a passkey. A password session of an admin
 *   can still register a passkey; everything behind the admin plane answers
 *   404 to it until it signs in again with the passkey. Over MCP, only an
 *   OAuth access token authorised from a passkey session reaches the
 *   admin-only tools; an API key never does.
 *
 * @example
 * ```yaml
 * auth:
 *   strategies:
 *     - type: emailAndPassword
 *   passkeys:
 *     rpName: Acme Back Office
 *     requireForAdmin: true
 * ```
 */
export const PasskeysConfigSchema = Schema.Union([
  Schema.Boolean,
  Schema.Struct({
    rpName: Schema.optional(
      Schema.String.pipe(
        Schema.annotate({
          description:
            'The name an authenticator shows when it saves the passkey. Defaults to the app name.',
          examples: ['Acme Back Office'],
        }),
        Schema.check(Schema.isMinLength(1))
      )
    ),
    requireForAdmin: Schema.optional(
      Schema.Boolean.pipe(
        Schema.annotate({
          description:
            'Admit an admin-tier account to the admin plane only from a session it opened with a passkey. Its password session can still register one. Over MCP, the admin-only tools need an OAuth token authorised from a passkey session; an API key never qualifies.',
          defaultNote: 'false',
        })
      )
    ),
  }),
]).pipe(
  Schema.annotate({
    title: 'Passkeys',
    description:
      'Passkey (WebAuthn) sign-in. A signed-in user registers a passkey, then signs in with it without a password. The relying party is derived from BASE_URL.',
    defaultNote: 'off',
    examples: [true, { rpName: 'Acme Back Office', requireForAdmin: true }],
  })
)

/** @public */
export type PasskeysConfig = Schema.Schema.Type<typeof PasskeysConfigSchema>
