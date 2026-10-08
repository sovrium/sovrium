/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Device Authorization (RFC 8628) Configuration
 *
 * Opt-in switch for the Better Auth `device-authorization` plugin, shaped for
 * ONE client: the `sovrium` CLI logging in to a Sovrium app. The CLI asks for a
 * short user code, prints it with a verification URL, and a signed-in user
 * approves it in their browser. The CLI then redeems the approved code for an
 * **API key** minted server-side for the approving user — never for a session
 * token, because Sovrium accepts exactly two credentials (the session cookie
 * and `x-api-key`) and a bearer session token is neither.
 *
 * When absent (the default), the device endpoints are not mounted and answer
 * **404**, exactly like every other optional auth plugin.
 *
 * ## Requires `apiKeys: true`
 *
 * The only thing an approved code can be redeemed for is an API key, so the
 * option is refused at decode unless `auth.apiKeys` is on (see
 * `validateDeviceAuthorizationRequiresApiKeys` in `auth.ts`). A device flow
 * whose redemption cannot mint anything would be an inert surface.
 *
 * ## Deliberately a bare boolean
 *
 * The plugin's tuning knobs (code lengths, polling interval, expiry, accepted
 * client ids) stay at the engine's values: the accepted client is
 * `sovrium-cli`, the code lives 30 minutes, and the client polls every
 * 5 seconds. Widening to a struct later is purely additive, exactly as for
 * `apiKeys`.
 *
 * @example
 * ```yaml
 * auth:
 *   strategies:
 *     - type: emailAndPassword
 *   apiKeys: true
 *   deviceAuthorization: true
 * ```
 */
export const AuthDeviceAuthorizationConfigSchema = Schema.Boolean.pipe(
  Schema.annotate({
    defaultNote: 'false',
    title: 'Device Authorization',
    description:
      'Let the sovrium CLI sign in with a short code approved in the browser: the CLI requests a code, a signed-in user approves it, and the CLI redeems it once for an API key of that user. Requires apiKeys: true.',
    examples: [true],
  })
)

/** @public */
export type AuthDeviceAuthorizationConfig = Schema.Schema.Type<
  typeof AuthDeviceAuthorizationConfigSchema
>
