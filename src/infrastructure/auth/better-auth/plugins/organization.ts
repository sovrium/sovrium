/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { organization } from 'better-auth/plugins'
import type { Auth } from '@/domain/models/app/auth'

/**
 * Build organization plugin if auth is configured
 *
 * Every Sovrium app IS exactly one Better Auth organization (1:1, non-configurable).
 * The organization is auto-created on first server start from app.name/app.slug.
 *
 * - allowUserToCreateOrganization: false — server manages the single org
 * - creatorRole: 'owner' — first user becomes org owner
 * - teams: enabled only when auth.teams.enabled is true in app schema
 *
 * Organization CRUD (create/delete/list) endpoints are not useful in 1:1 model
 * but are still available via Better Auth — the app logic enforces single-org behavior.
 */
export const buildOrganizationPlugin = (authConfig?: Auth) => {
  if (!authConfig) return []

  return [
    organization({
      allowUserToCreateOrganization: false,
      creatorRole: 'owner',
      teams: { enabled: true },
    }),
  ]
}
