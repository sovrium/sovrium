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
} from '@/domain/models/app/agents/ai-chat-context'
import { triggerOfTypeOrFirst } from '@/domain/models/app/automations/trigger-entries-service'
import { filterFieldsReadableByAny } from '@/domain/models/app/tables/field-read-filter-service'
import { callersOfRow } from '@/domain/models/app/tables/row-read-admission-service'
import { chatReadableColumns, type ChatReader } from './chat-read-scope'
import { chatReaderRows, keepListedTables } from './chat-reader-rows'
import { projectAppTables, type ProjectedTable } from './chat-table-projection'
import type { App } from '@/domain/models/app'
import type { DomainContext } from '@/infrastructure/logging/request-effect'

/**
 * The fields of `table` `reader`'s records list can ever show her: those she
 * reads herself ({@link chatReadableColumns}), and those the list reads a row
 * under a role a grant gives her on it ({@link callersOfRow},
 * {@link filterFieldsReadableByAny} — the list's own per-row field filter).
 */
const describedFields = async (
  services: DomainContext,
  app: App | undefined,
  table: ProjectedTable,
  reader: ChatReader
): Promise<ReadonlySet<string>> => {
  const own = chatReadableColumns(app, table, reader).readableColumns
  const grants = (await chatReaderRows(services, app, table.name, reader))?.grants
  if (app === undefined || grants === undefined || grants.size === 0) return new Set(own)
  const callers = [...grants.keys()].flatMap((id) =>
    callersOfRow({ role: reader.role, groups: reader.groups }, grants, id).slice(1)
  )
  const granted = filterFieldsReadableByAny({
    app,
    tableName: table.name,
    callers,
    record: Object.fromEntries(table.fields.map((field) => [field.name, undefined])),
  })
  return new Set([...own, ...Object.keys(granted)])
}

/**
 * Project the tables `reader` lists ({@link keepListedTables}) onto the minimal
 * {@link ContextTable} shape the domain context builder consumes — the shared
 * {@link projectAppTables} projection, each table narrowed to the fields her
 * list can show her ({@link describedFields}). The `permissions` block is
 * forwarded verbatim; the cast narrows its `unknown` projection type onto the
 * context builder's structural shape (the builder only ever reads
 * `permissions.read` / `permissions.fields`).
 */
const toContextTables = async (
  services: DomainContext,
  app: App | undefined,
  reader: ChatReader
): Promise<ReadonlyArray<ContextTable>> => {
  const listed = await keepListedTables(services, app, projectAppTables(app), reader)
  return Promise.all(
    listed.map(async (table) => {
      const readable = await describedFields(services, app, table, reader)
      return {
        name: table.name,
        fields: table.fields.filter((field) => readable.has(field.name)),
        ...(table.permissions !== undefined && {
          permissions: table.permissions as ContextTable['permissions'],
        }),
      }
    })
  )
}

/**
 * Project the app's `automations[]` onto the minimal {@link ContextAutomation}
 * shape — only `name`, `description`, and the trigger discriminator are needed
 * to decide triggerability and render the automation line.
 */
const toContextAutomations = (app: App | undefined): ReadonlyArray<ContextAutomation> =>
  (app?.automations ?? []).map((automation) => ({
    name: automation.name,
    ...(automation.description !== undefined && { description: automation.description }),
    // Triggerable from chat when one of its triggers is manual.
    trigger: { type: triggerOfTypeOrFirst(automation, 'manual').type },
  }))

/**
 * Compose the per-request system prompt: the AI chat context block describing
 * the tables, fields, select options, and triggerable automations the current
 * user may reason about. Tables and fields she cannot read are omitted, and so
 * is every table the records list admits the reader no row of; record data and
 * credentials are never included.
 *
 * `buildAiChatContext` is a pure function with no cache, so the context always
 * reflects the caller's *current* role and grants.
 */
export const buildChatContextPrompt = async (
  app: App | undefined,
  caller: {
    readonly userRole: string
    readonly reader: ChatReader
    readonly services: DomainContext
  },
  pageContext: ContextPageScope | undefined
): Promise<string> =>
  buildAiChatContext({
    appName: app?.name ?? 'application',
    userRole: caller.userRole,
    tables: await toContextTables(caller.services, app, caller.reader),
    automations: toContextAutomations(app),
    ...(pageContext !== undefined && { pageContext }),
    ...(app?.auth !== undefined && { auth: app.auth }),
  })
