/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * AI Chat per-request system-prompt builder.
 *
 * Projects the `App` schema onto the minimal shapes the domain
 * {@link buildAiChatContext} function consumes and composes the per-request
 * context block. Extracted from `ai-chat.ts` so the route
 * file stays under the `max-lines` cap.
 */

import {
  buildAiChatContext,
  type ContextPageScope,
  type ContextTable,
  type ContextAutomation,
} from '@/domain/services/ai-chat/ai-chat-context'
import { projectAppTables } from './chat-table-projection'
import type { App } from '@/domain/models/app'

/**
 * Project the app's `tables[]` onto the minimal {@link ContextTable} shape the
 * domain context builder consumes — the shared {@link projectAppTables}
 * projection. The `permissions` block is forwarded verbatim; the cast narrows
 * its `unknown` projection type onto the context builder's structural shape
 * (the builder only ever reads `permissions.read` / `permissions.fields`).
 */
const toContextTables = (app: App | undefined): ReadonlyArray<ContextTable> =>
  projectAppTables(app).map((table) => ({
    name: table.name,
    fields: table.fields,
    ...(table.permissions !== undefined && {
      permissions: table.permissions as ContextTable['permissions'],
    }),
  }))

/**
 * Project the app's `automations[]` onto the minimal {@link ContextAutomation}
 * shape — only `name`, `description`, and the trigger discriminator are needed
 * to decide triggerability and render the automation line.
 */
const toContextAutomations = (app: App | undefined): ReadonlyArray<ContextAutomation> =>
  (app?.automations ?? []).map((automation) => ({
    name: automation.name,
    ...(automation.description !== undefined && { description: automation.description }),
    trigger: { type: automation.trigger.type },
  }))

/**
 * Compose the per-request system prompt: the AI chat context block describing
 * the tables, fields, select options, and triggerable automations the current
 * user may reason about. Tables/fields the role cannot read are omitted;
 * record data and credentials are never included.
 *
 * `buildAiChatContext` is a pure function with no cache, so the context always
 * reflects the caller's *current* role.
 */
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
