/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Who may start an automation by asking for it in the chat.
 *
 * Two gates, both judged on the CALLER's role, in this order:
 *
 *  1. `permissions.trigger`, when declared, narrows who may ask. Undeclared, it
 *     admits any caller — but it never widens past the second gate.
 *  2. The manual trigger's own role rule, exactly as the direct trigger route
 *     and the MCP tool apply it (`mayRunManualAutomation`): the trigger's
 *     `requiredRole`, `admin` when undeclared, or an admin-equivalent role.
 *
 * A non-manual automation passes neither road: the chat cannot start it.
 */

import {
  mayStartAutomationByName,
  triggerPermissionAdmits,
} from '@/domain/models/app/automations/manual-trigger-role-service'
import { hasTriggerOfType } from '@/domain/models/app/automations/trigger-entries-service'
import type { App } from '@/domain/models/app'

type Automation = NonNullable<App['automations']>[number]

/** What the chat road answers a request to start an automation. */
export type ChatTriggerAdmission = 'admitted' | 'forbidden' | 'not-triggerable'

/**
 * Judge a chat request to start `automation` for a caller holding `userRole`,
 * through the one by-name gate the trigger route and the MCP tool share
 * ({@link mayStartAutomationByName}). The chat alone tells a refusal apart
 * from an automation that is not manual.
 */
export const admitChatTrigger = (
  automation: Automation,
  app: App,
  userRole: string
): ChatTriggerAdmission => {
  if (!triggerPermissionAdmits(automation, app, userRole)) return 'forbidden'
  if (!hasTriggerOfType(automation, 'manual')) return 'not-triggerable'
  return mayStartAutomationByName(automation, app, userRole) ? 'admitted' : 'forbidden'
}
