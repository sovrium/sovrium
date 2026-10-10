/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { APIError, createAuthEndpoint } from 'better-auth/api'
import { deviceAuthorization, redeemDeviceCode } from 'better-auth/plugins'
import { Option, Schema } from 'effect'
import {
  SOVRIUM_CLI_CLIENT_ID,
  deviceApiKeyRequestSchema,
  deviceApiKeyResponseSchema,
} from '@/domain/models/api/auth/auth'
import {
  LOOPBACK_DEVICE_CODE_FIELDS,
  assertReturnCode,
  authorizeLoopbackRequest,
  buildDecideEndpoint,
  loopbackVerificationContext,
  type LoopbackFields,
} from './device-loopback'
import type { Auth } from '@/domain/models/app/auth'
import type { DeviceAuthorizationGrant } from 'better-auth/plugins'

/**
 * Mint an API key for `userId`, server-side. Bound by `createAuthInstance` to
 * `auth.api.createApiKey({ body: { userId, name } })` once the instance exists:
 * a call carrying no request and no headers is the API-key plugin's server
 * path, so the key belongs to `userId` and its grant is derived from that
 * user's role by the plugin's own `defaultPermissions` — exactly as a key the
 * user mints themselves.
 */
export type DeviceKeyMinter = (input: {
  readonly userId: string
  readonly name: string
}) => Promise<{ readonly key: string; readonly id: string; readonly name?: string | null }>

const invalidGrant = (description: string): APIError =>
  new APIError('BAD_REQUEST', { error: 'invalid_grant', error_description: description })

/**
 * The one client the flow serves is `sovrium-cli`, and it redeems for an API
 * key — never for the raw session token `/device/token` answers, which no
 * Sovrium route accepts. The grant refuses that endpoint for every code it
 * owns, BEFORE the polling clock is touched or the code consumed, so a refused
 * call leaves the code redeemable at `/device/api-key`.
 *
 * It also carries the loopback return (`device-loopback.ts`): the request
 * fields it persists, and the context the claimant's lookup adds.
 */
const SOVRIUM_CLI_GRANT = {
  requestSchemaFields: {},
  deviceCodeSchemaFields: LOOPBACK_DEVICE_CODE_FIELDS,
  authorizeRequest: authorizeLoopbackRequest,
  assertSessionRedemption: () => {
    throw invalidGrant('This client redeems its code for an API key at /device/api-key')
  },
  getVerificationContext: loopbackVerificationContext,
} satisfies DeviceAuthorizationGrant

/** `Sovrium CLI <YYYY-MM-DD HH:MM>` (UTC): the device and the moment, under the 32-character cap. */
const keyNameAt = (now: Date): string =>
  `Sovrium CLI ${now.toISOString().slice(0, 16).replace('T', ' ')}`

const decodeRequest = Schema.decodeUnknownOption(deviceApiKeyRequestSchema)
const encodeResponse = Schema.encodeSync(deviceApiKeyResponseSchema)

/**
 * `POST /device/api-key` — redeem an approved device code for an API key of
 * the person who approved it, once.
 *
 * The state machine is the plugin's own `redeemDeviceCode`: unknown code,
 * polling faster than the interval (`slow_down`), expiry, pending, denial and
 * the one-time atomic claim are all decided there, with the RFC 8628 error
 * codes the token endpoint answers. Only after the claim succeeds is the key
 * minted, so a code never yields two keys. A request approved in one click
 * redeems only with the return code its browser carried back.
 */
const buildRedeemEndpoint = (mintKey: DeviceKeyMinter) =>
  createAuthEndpoint('/device/api-key', { method: 'POST' }, async (ctx) => {
    const request = decodeRequest(ctx.body)
    if (Option.isNone(request)) {
      throw invalidGrant(`device_code and client_id '${SOVRIUM_CLI_CLIENT_ID}' are required`)
    }
    const { user } = await redeemDeviceCode<LoopbackFields, undefined, undefined>({
      ctx,
      deviceCode: request.value.device_code,
      authorizeRedemption: (record) => {
        if (record.clientId !== SOVRIUM_CLI_CLIENT_ID) throw invalidGrant('Client ID mismatch')
        assertReturnCode(record, request.value.code)
        return {
          ownershipWhere: { field: 'clientId', value: SOVRIUM_CLI_CLIENT_ID },
          context: undefined,
        }
      },
      prepareRedemption: () => undefined,
    })
    const minted = await mintKey({ userId: user.id, name: keyNameAt(new Date()) })
    ctx.setHeader('Cache-Control', 'no-store')
    ctx.setHeader('Pragma', 'no-cache')
    return ctx.json(
      encodeResponse({
        key: minted.key,
        keyId: minted.id,
        name: minted.name ?? keyNameAt(new Date()),
      })
    )
  })

/**
 * Build the device-authorization plugin when `auth.deviceAuthorization` is on
 * (decode refuses it without `apiKeys`; the check is repeated here so a config
 * that bypassed decode mounts nothing rather than a flow that cannot mint).
 *
 * Gated exactly like `buildApiKeyPlugin`: absent opt-in, the plugin is not in
 * the array and every `/api/auth/device*` path answers 404.
 *
 * The plugin's defaults are the engine's: a code lives 30 minutes and is
 * polled every 5 seconds. `validateClient` admits `sovrium-cli` alone, so a
 * foreign client is refused a code (`invalid_client`). The plugin's own
 * `/device` rate limit (5 per window) is inert because Better Auth's limiter
 * is off; Sovrium's Hono limiter carries the same budget
 * (`auth-route-utils.ts`).
 */
export const buildDeviceAuthorizationPlugin = (
  authConfig: Auth | undefined,
  mintKey: DeviceKeyMinter
) => {
  if (authConfig?.deviceAuthorization !== true || authConfig.apiKeys !== true) return []
  const plugin = deviceAuthorization({
    validateClient: (clientId) => clientId === SOVRIUM_CLI_CLIENT_ID,
    verificationUri: '/device',
    grant: SOVRIUM_CLI_GRANT,
  })
  return [
    {
      ...plugin,
      endpoints: {
        ...plugin.endpoints,
        deviceApiKey: buildRedeemEndpoint(mintKey),
        deviceDecide: buildDecideEndpoint(),
      },
    },
  ]
}
