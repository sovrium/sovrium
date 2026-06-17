/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import {
  buildAiChatContext,
  type ContextPageScope,
  type ContextTable,
  type ContextAutomation,
} from '@/domain/services/ai-chat/ai-chat-context'
import { projectAppTables } from './chat-table-projection'
import type { App } from '@/domain/models/app'

const toContextTables = (app: App | undefined): ReadonlyArray<ContextTable> =>
  projectAppTables(app).map((table) => ({
    name: table.name,
    fields: table.fields,
    ...(table.permissions !== undefined && {
      permissions: table.permissions as ContextTable['permissions'],
    }),
  }))

const toContextAutomations = (app: App | undefined): ReadonlyArray<ContextAutomation> =>
  (app?.automations ?? []).map((automation) => ({
    name: automation.name,
    ...(automation.description !== undefined && { description: automation.description }),
    trigger: { type: automation.trigger.type },
  }))

export const buildChatContextPrompt = (
  app: App | undefined,
  userRole: string,
  pageContext: ContextPageScope | undefined
): string =>
  buildAiChatContext({
    appName: app?.name ?? 'application',
    userRole,
    tables: toContextTables(app),
    automations: toContextAutomations(app),
    ...(pageContext !== undefined && { pageContext }),
  })
