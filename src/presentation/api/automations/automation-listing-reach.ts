/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isAdminEquivalent } from '@/domain/models/app/auth/roles'
import { mayStartAutomationByName } from '@/domain/models/app/automations/manual-trigger-role-service'
import type { App } from '@/domain/models/app'

type Automation = NonNullable<App['automations']>[number]

/**
 * The automations `GET /api/automations` shows a caller. An admin-equivalent
 * caller reads every one; anyone else reads exactly the manual automations she
 * may start by name ({@link mayStartAutomationByName}) — a caller learns of an
 * automation only where she may act on it. An anonymous caller reads none.
 */
export const automationsListedTo = (
  app: App,
  userRole: string | undefined
): readonly Automation[] => {
  const automations = app.automations ?? []
  if (userRole !== undefined && isAdminEquivalent(userRole, app)) return automations
  return automations.filter((automation) => mayStartAutomationByName(automation, app, userRole))
}
