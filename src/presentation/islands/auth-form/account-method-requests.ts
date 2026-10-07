/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The requests an account form sends, one per method, each to the engine's
 * own endpoint under `/api/auth`. Every answer is reduced to what the form
 * draws next: an error to tell, or the data the next screen needs (the QR
 * code's address and the recovery codes, a new key shown once).
 */

import { authClient } from '../runtime/auth-client'
import { afterSignIn } from './sign-in-in-flight'

/** What a request answered: a refusal's message, or the body it returned. */
export interface AccountOutcome {
  readonly error?: string
  readonly data?: Readonly<Record<string, unknown>>
}

/** The endpoint each second factor is checked at. */
const VERIFY_PATHS: Readonly<Record<string, string>> = {
  totp: '/two-factor/verify-totp',
  backupCode: '/two-factor/verify-backup-code',
}

/** POST `body` to `path` under `/api/auth`, as the signed-in (or invited) reader. */
export async function postAccount(
  path: string,
  body: Readonly<Record<string, unknown>>
): Promise<AccountOutcome> {
  // A code typed while the page's password step is still answering waits for it.
  await afterSignIn()
  const result = await authClient.$fetch(path, { method: 'POST', body: { ...body } })
  if (result.error) {
    const { message } = result.error as { readonly message?: unknown }
    return { error: typeof message === 'string' && message !== '' ? message : 'Request failed' }
  }
  const data = result.data as Readonly<Record<string, unknown>> | null
  return data === null ? {} : { data }
}

/** The invitation token in the page address, under the key `page.invitation.param` names. */
const invitationToken = (param = 'token'): string =>
  new URLSearchParams(globalThis.location?.search ?? '').get(param) ?? ''

interface AccountRequestInput {
  readonly values: Readonly<Record<string, string>>
  readonly factor?: string
  readonly trustDevice?: boolean
  readonly tokenParam?: string
}

type RequestBuilder = (input: AccountRequestInput) => {
  readonly path: string
  readonly body: Readonly<Record<string, unknown>>
}

const valueOf = (input: AccountRequestInput, name: string): string =>
  (input.values[name] ?? '').trim()

/** What each method sends, from the form's values. */
const BUILDERS: Readonly<Record<string, RequestBuilder>> = {
  verifyTwoFactor: (input) => ({
    path: VERIFY_PATHS[input.factor ?? 'totp'] ?? '/two-factor/verify-totp',
    body: { code: valueOf(input, 'code'), trustDevice: input.trustDevice === true },
  }),
  enableTwoFactor: (input) => ({
    path: '/two-factor/enable',
    body: { password: input.values['password'] ?? '' },
  }),
  disableTwoFactor: (input) => ({
    path: '/two-factor/disable',
    body: { password: input.values['password'] ?? '' },
  }),
  acceptInvitation: (input) => ({
    path: '/admin/accept-invitation',
    body: { token: invitationToken(input.tokenParam), password: input.values['password'] ?? '' },
  }),
  declineInvitation: (input) => ({
    path: '/decline-invitation',
    body: { token: invitationToken(input.tokenParam) },
  }),
  createApiKey: (input) => ({ path: '/api-key/create', body: { name: valueOf(input, 'name') } }),
  revokeOtherSessions: () => ({ path: '/revoke-other-sessions', body: {} }),
}

/** What a method sends, from the form's values; `undefined` for a method it does not run. */
export function accountRequest(
  method: string,
  values: Readonly<Record<string, string>>,
  options: {
    readonly factor?: string
    readonly trustDevice?: boolean
    readonly tokenParam?: string
  }
): ReturnType<RequestBuilder> | undefined {
  return BUILDERS[method]?.({ values, ...options })
}

/** The confirmation each method's form shows once the server accepts (no navigation). */
export const ACCOUNT_SUCCESS_MESSAGES: Readonly<Record<string, string>> = {
  disableTwoFactor: 'Two-step verification is off',
  declineInvitation: 'Invitation declined',
  revokeOtherSessions: 'Your other devices are signed out',
  enableTwoFactor: 'Two-step verification is on',
}

/** The account list a method changes, which the page's grids re-read. */
export const CHANGED_ACCOUNT_LIST: Readonly<Record<string, string>> = {
  createApiKey: '/api/account/lists/apiKeys',
  revokeOtherSessions: '/api/account/lists/sessions',
}
