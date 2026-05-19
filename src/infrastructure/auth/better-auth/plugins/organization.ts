/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { organization } from 'better-auth/plugins'
import type { Auth } from '@/domain/models/app/auth'

export const buildOrganizationPlugin = (authConfig?: Auth) => {
  if (!authConfig) return []

  return [
    organization({
      allowUserToCreateOrganization: false,
      creatorRole: 'owner',
      teams: { enabled: true, allowRemovingAllTeams: true },
    }),
  ]
}
