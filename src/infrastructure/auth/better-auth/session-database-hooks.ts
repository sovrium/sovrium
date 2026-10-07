/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { PASSKEY_SIGN_IN_METHOD } from '@/domain/models/app/auth/passkeys-service'
import { SOVRIUM_ORGANIZATION_ID } from './org-team-seeder'
import { PASSKEY_SIGN_IN_PATH } from './plugins/passkey'
import { closeEndedSessionConnections } from './realtime-grant-hooks'
import type { Auth } from '@/domain/models/app/auth'

/**
 * How a session was opened (`signInMethod`), written by the `create.before`
 * hook below and never by a client (`input: false`).
 */
export const SESSION_ADDITIONAL_FIELDS = {
  signInMethod: { type: 'string', required: false, input: false },
} as const

/**
 * The `session` block of the Better Auth `databaseHooks`.
 *
 *  - `create.before` points every new session at the single per-app
 *    organization, so the native team endpoints (`/api/auth/organization/*`)
 *    resolve against an active organization, and marks a session a passkey
 *    opened (`signInMethod: 'passkey'`), the mark the admin plane reads when
 *    `auth.passkeys.requireForAdmin` is set.
 *  - `delete.after` closes the realtime connections opened with a session that
 *    is gone. Better Auth runs it for every session it deletes — sign-out, a
 *    revocation, a ban, an admin-set password, an expired session cleaned up
 *    on read — before the endpoint's own `after` hooks.
 */
export const buildSessionHooks = (authConfig: Auth | undefined) => ({
  create: {
    before: async (
      session: Readonly<Record<string, unknown>>,
      ctx?: { readonly path?: string } | null
    ) => {
      if (!authConfig) return undefined
      return {
        data: {
          ...session,
          activeOrganizationId: SOVRIUM_ORGANIZATION_ID,
          ...(ctx?.path === PASSKEY_SIGN_IN_PATH ? { signInMethod: PASSKEY_SIGN_IN_METHOD } : {}),
        },
      }
    },
  },
  delete: { after: (session: unknown) => closeEndedSessionConnections(session) },
})
