/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Browser-side transport for the self-service API-key endpoints.
 *
 * Every call goes to `/api/auth/api-key/*` DIRECTLY — there is no Sovrium
 * wrapper route, and adding one would be a security regression rather than a
 * refactor. The plugin conditions its two ownership guards on
 * `isClientRequest = ctx.request || ctx.headers`: on this path it forces
 * `referenceId` to the session's user and refuses a caller-supplied
 * `permissions` with 400 `SERVER_ONLY_PROPERTY`. A server-side
 * `auth.api.createApiKey({ body })` with no headers disarms BOTH, which is why
 * `[internal ref]` asserts they are armed.
 */

/** One key as the plugin's `list` endpoint describes it — never the secret. */
export interface ApiKeySummary {
  readonly id: string
  readonly name: string | null
  /** The first few characters of the key, for identifying it in the list. */
  readonly start: string | null
  readonly createdAt: string | null
  readonly expiresAt: string | null
  readonly enabled: boolean | null
}

/** The one-time create response: the ONLY moment `key` is ever readable. */
interface CreatedApiKey extends ApiKeySummary {
  readonly key: string
}

const CREATE_URL = '/api/auth/api-key/create'
const LIST_URL = '/api/auth/api-key/list'
const DELETE_URL = '/api/auth/api-key/delete'

/** `same-origin` is the browser default; stated so the cookie dependency is explicit. */
const JSON_POST = {
  method: 'POST',
  credentials: 'same-origin',
  headers: { 'Content-Type': 'application/json' },
} as const

/**
 * Fetch the caller's own keys, or `undefined` when the read failed.
 *
 * A failed read is reported as a VALUE rather than an exception so the caller
 * cannot conflate it with an empty list — "you have no keys" and "we could not
 * ask" look identical on screen and mean opposite things.
 *
 * Scoping is the endpoint's job, never the client's: the plugin filters on the
 * session's own `referenceId`, so there is no query parameter here to get wrong.
 */
export async function fetchApiKeys(): Promise<readonly ApiKeySummary[] | undefined> {
  const response = await fetch(LIST_URL, { credentials: 'same-origin' })
  if (!response.ok) return undefined
  const body = (await response.json()) as { readonly apiKeys?: readonly ApiKeySummary[] }
  return body.apiKeys ?? []
}

/**
 * Mint a key. The body carries `name` and NOTHING else: `permissions`,
 * `userId`, and every rate-limit field are server-only, and sending one would
 * earn a 400 rather than an escalated key (D10).
 */
export async function createApiKey(name: string): Promise<CreatedApiKey | undefined> {
  const response = await fetch(CREATE_URL, { ...JSON_POST, body: JSON.stringify({ name }) })
  if (!response.ok) return undefined
  return (await response.json()) as CreatedApiKey
}

/** Revoke a key. A cross-user id answers 404 — the surface never confirms it exists. */
export async function revokeApiKey(keyId: string): Promise<boolean> {
  const response = await fetch(DELETE_URL, { ...JSON_POST, body: JSON.stringify({ keyId }) })
  return response.ok
}

/** Render a stored ISO timestamp for the list, degrading to an em dash. */
export function formatCreatedAt(value: string | null): string {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString()
}
