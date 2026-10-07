/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The item-level account methods a grid row runs — an `auth` action whose
 * `target` (almost always `$record.id`) names the one session, passkey, API
 * key, member or invitation of the row.
 *
 * Each method is one request to the engine's own endpoint. Ownership is the
 * SERVER'S to check, never this module's: a target that is not the reader's
 * answers like one that does not exist, so a failure here is only ever told,
 * and the grid re-reads on success so the row reflects what the server holds.
 */

import { substituteRecordVars } from '@/domain/models/app/pages/substitute-record-vars'
import type { TableRecord } from '../../runtime/types'

/** The slice of an `auth` action a row reads. */
export interface AccountRowAction {
  readonly type: 'auth'
  readonly method: string
  readonly target?: string
  readonly onSuccess?: { readonly toast?: { readonly message?: string; readonly variant?: string } }
  readonly onError?: { readonly toast?: { readonly message?: string; readonly variant?: string } }
}

interface AccountRequest {
  readonly path: string
  readonly method: 'POST' | 'DELETE'
  readonly body?: Readonly<Record<string, unknown>>
}

/** The request one item-level method sends for `id` (the row's values beside it). */
function accountRequest(
  method: string,
  id: string,
  record: TableRecord
): AccountRequest | undefined {
  const invitation = `/api/admin/invitations/${encodeURIComponent(id)}`
  switch (method) {
    case 'revokeApiKey':
      return { path: '/api/auth/api-key/delete', method: 'POST', body: { keyId: id } }
    case 'renamePasskey':
      return {
        path: '/api/auth/passkey/update-passkey',
        method: 'POST',
        body: { id, name: String(record['name'] ?? '') },
      }
    case 'removePasskey':
      return { path: '/api/auth/passkey/delete-passkey', method: 'POST', body: { id } }
    case 'revokeSession':
      return { path: '/api/auth/revoke-session', method: 'POST', body: { id } }
    case 'setRole':
      return {
        path: '/api/auth/admin/set-role',
        method: 'POST',
        body: { userId: id, role: String(record['role'] ?? '') },
      }
    case 'resendInvitation':
      return { path: `${invitation}/resend`, method: 'POST' }
    case 'revokeInvitation':
      return { path: invitation, method: 'DELETE' }
    default:
      return undefined
  }
}

/** The server's own words for a refusal, when it sent any. */
async function refusalMessage(response: Response): Promise<string> {
  const body = (await response.json().catch(() => undefined)) as
    { readonly message?: unknown } | undefined
  return typeof body?.message === 'string' && body.message !== ''
    ? body.message
    : 'The action could not be completed'
}

type ToastRenderer = (message: string, variant?: string) => void

/** The request an action sends for `record`, or none when its target is unresolved. */
function requestFor(action: AccountRowAction, record: TableRecord): AccountRequest | undefined {
  const id = substituteRecordVars(action.target ?? '$record.id', record)
  if (id === '' || id.includes('$record.')) return undefined
  return accountRequest(action.method, id, record)
}

/** Send one request; `undefined` when the network itself failed. */
const send = (request: AccountRequest): Promise<Response | undefined> =>
  fetch(request.path, {
    method: request.method,
    headers: { 'Content-Type': 'application/json' },
    ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }),
  }).catch(() => undefined)

/** Tell a refusal: the configured toast, else the server's own words. */
async function tellRefusal(
  action: AccountRowAction,
  response: Response | undefined,
  renderToast: ToastRenderer
): Promise<void> {
  const configured = action.onError?.toast?.message
  const message =
    configured ?? (response === undefined ? 'Network error' : await refusalMessage(response))
  renderToast(message, action.onError?.toast?.variant ?? 'error')
}

/**
 * Run one item-level account method for `record`. Answers whether the server
 * accepted it; the configured toast (or the refusal's own message) is shown.
 */
export async function runAccountRowAction(
  action: AccountRowAction,
  record: TableRecord,
  renderToast: ToastRenderer
): Promise<boolean> {
  const request = requestFor(action, record)
  if (request === undefined) return false
  const response = await send(request)
  if (response?.ok !== true) {
    await tellRefusal(action, response, renderToast)
    return false
  }
  const success = action.onSuccess?.toast
  if (success?.message) renderToast(success.message, success.variant)
  return true
}
