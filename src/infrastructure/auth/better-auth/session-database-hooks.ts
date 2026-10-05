/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { SOVRIUM_ORGANIZATION_ID } from './org-team-seeder'
import { closeEndedSessionConnections } from './realtime-grant-hooks'
import type { Auth } from '@/domain/models/app/auth'

/**
 * The `session` block of the Better Auth `databaseHooks`.
 *
 *  - `create.before` points every new session at the single per-app
 *    organization, so the native team endpoints (`/api/auth/organization/*`)
 *    resolve against an active organization.
 *  - `delete.after` closes the realtime connections opened with a session that
 *    is gone. Better Auth runs it for every session it deletes — sign-out, a
 *    revocation, a ban, an admin-set password, an expired session cleaned up
 *    on read — before the endpoint's own `after` hooks.
 */
export const buildSessionHooks = (authConfig: Auth | undefined) => ({
  create: {
    before: async (session: Readonly<Record<string, unknown>>) => {
      if (!authConfig) return undefined
      return {
        data: { ...session, activeOrganizationId: SOVRIUM_ORGANIZATION_ID },
      }
    },
  },
  delete: { after: (session: unknown) => closeEndedSessionConnections(session) },
})
