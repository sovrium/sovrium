/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defaultKeyHasher } from '@better-auth/api-key'
import { API_KEY_HEADER, presentsApiKey } from './api-key-admin-plane-guard'
import { notFoundError } from './auth-not-found'
import type { AuthMiddlewareCtx } from './hook-context'

/**
 * The Better Auth paths a request presenting an API key may reach: who the key
 * belongs to (`sovrium login --api-key`, the generated client, and every
 * Sovrium route, which resolves a key through `getSession`).
 */
const KEY_READABLE_PATHS: ReadonlySet<string> = new Set(['/get-session'])

/** The one write a key may make on its own account: revoking itself. */
const KEY_SELF_REVOKE_PATH = '/api-key/delete'

/**
 * Whether `keyId` names the very key the request presents. The plugin stores
 * a key as its base64url SHA-256 digest, so the row's `key` is compared with
 * the digest of the presented value; an unknown id is not the caller's key.
 */
const namesPresentedKey = async (ctx: AuthMiddlewareCtx): Promise<boolean> => {
  const keyId = (ctx.body as { readonly keyId?: unknown } | undefined)?.keyId
  const presented = ctx.headers?.get(API_KEY_HEADER)
  if (typeof keyId !== 'string' || keyId === '' || !presented) return false
  const row = await ctx.context.adapter.findOne<{ readonly key?: unknown }>({
    model: 'apikey',
    where: [{ field: 'id', value: keyId }],
  })
  return row !== null && row.key === (await defaultKeyHasher(presented))
}

/**
 * Keep an API key to the data it was minted for. A key authenticates the data
 * API and `/mcp`; on Better Auth's own routes it may only ask whose key it is
 * (`/get-session`) and revoke ITSELF (`/api-key/delete` naming its own id,
 * which `sovrium login --logout` sends). Every other `/api/auth/*` route
 * answers a keyed request 404, the answer a route that does not exist gives,
 * whoever owns the key.
 *
 * WHY AN ALLOW-LIST. The API-key plugin turns a keyed request into a stand-in
 * session created "now", so it passes every freshness check Better Auth makes.
 * Left alone, a key could enrol a passkey and sign in with it as a browser
 * session (reaching what the admin-plane guard keeps from a key), mint further
 * keys so revoking a leaked one ends nothing, or change the account's address,
 * linked providers and second step. Naming the few routes a key needs keeps
 * every route a future Better Auth version adds closed by default.
 *
 * Runs in Sovrium's `before` hook, which Better Auth runs BEFORE the plugin's,
 * so the key is read from its header, not from a session. A path-less,
 * server-only endpoint (`auth.api.addMember`) has no HTTP door and is left to
 * its caller.
 */
export async function applyApiKeyAccountBoundary(ctx: AuthMiddlewareCtx): Promise<void> {
  const { path } = ctx
  if (path === undefined || !presentsApiKey(ctx)) return
  if (KEY_READABLE_PATHS.has(path)) return
  if (path === KEY_SELF_REVOKE_PATH && (await namesPresentedKey(ctx))) return
  throw notFoundError()
}
