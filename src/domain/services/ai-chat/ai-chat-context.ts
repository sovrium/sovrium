/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * AI Chat Context Builder
 *
 * Pure domain function that composes the system-prompt context block sent to
 * the AI provider on every `/api/ai/chat` turn. The context describes the
 * data surfaces (tables, fields, select options), runnable automations, and
 * the optional page scope the user is chatting from — but NEVER raw record
 * data, credentials, tokens, or environment variables.
 *
 * Drives `[internal ref]`:
 *
 * - [internal ref]: table names + field names + field types.
 * - [internal ref]: per-field access level (read / read-write).
 * - [internal ref]: tables the user cannot read are omitted.
 * - [internal ref]: triggerable (manual-trigger) automations only.
 * - [internal ref]: optional `pageContext` table scope.
 * - [internal ref]: no raw record data (records queried on demand).
 * - [internal ref]: no credentials / tokens / env vars.
 * - [internal ref]: single-/multi-select option values.
 * - [internal ref]: regenerated per request (this is a pure
 *    function — the caller invokes it fresh on every turn, so the context
 *    can never be a stale cache).
 *
 * The function is deliberately structural (it accepts the minimal shapes it
 * needs rather than the full `App` type) so it stays in the domain layer with
 * no dependency on the presentation/application layers.
 */

import {
  evaluatePermission,
  grantWhenUndeclared,
  permits,
  toPermissionValue,
} from '@/domain/models/shared/permission-evaluation'
import { hasReadPermission } from '@/domain/validators/permission-evaluators'

/** Minimal field shape the context builder reads. */
export interface ContextField {
  readonly name: string
  readonly type: string
  /** Predefined option values for single-select / multi-select fields. */
  readonly options?: ReadonlyArray<string>
}

/** Minimal table shape the context builder reads. */
export interface ContextTable {
  readonly name: string
  readonly fields: ReadonlyArray<ContextField>
  /**
   * Table-level permissions. Only the `read` operation is consulted here —
   * a table the current role cannot read is omitted from the context
   * entirely.
   */
  readonly permissions?: {
    readonly read?: unknown
    readonly fields?: ReadonlyArray<{
      readonly field: string
      readonly read?: unknown
      readonly write?: unknown
    }>
  }
}

/** Minimal automation shape the context builder reads. */
export interface ContextAutomation {
  readonly name: string
  readonly description?: string
  readonly trigger: { readonly type: string }
}

/**
 * Optional page scope. When the chat surface is embedded in a page component
 * that declares `allowedTables`, only those tables are described to the AI
 *.
 */
export interface ContextPageScope {
  readonly page?: string
  readonly allowedTables?: ReadonlyArray<string>
}

/** Everything the builder needs to compose a per-request context block. */
export interface AiChatContextInput {
  readonly appName: string
  readonly userRole: string
  readonly tables?: ReadonlyArray<ContextTable>
  readonly automations?: ReadonlyArray<ContextAutomation>
  readonly pageContext?: ContextPageScope
}

/**
 * Resolve a single field's access level for the current role.
 *
 * When the table declares no field-level permission for the field, the field
 * inherits the table's read+write access — rendered as `read-write`. A field
 * permission with a `write` that excludes the role (but a `read` that allows
 * it) renders as `read`. This is intentionally coarse: the AI only needs to
 * know whether it may *suggest mutations* to a field, not the exact role set.
 */
const resolveFieldAccess = (
  table: ContextTable,
  fieldName: string,
  userRole: string
): 'read' | 'read-write' => {
  const fieldPerm = table.permissions?.fields?.find((entry) => entry.field === fieldName)
  if (fieldPerm === undefined) return 'read-write'
  // An un-restricted `write` leaves the field writable; there is no admin
  // override here because the rendered context describes what THIS role may do.
  const canWrite = permits(
    evaluatePermission(
      toPermissionValue(fieldPerm.write),
      { role: userRole },
      {
        // Absent → writable. A MALFORMED grant is not a grant, so it is not.
        whenUndeclared: grantWhenUndeclared(fieldPerm.write === undefined),
        adminOverride: 'no-admin-override',
      }
    )
  )
  return canWrite ? 'read-write' : 'read'
}

/** Render one field as a single descriptive line. */
const renderField = (table: ContextTable, field: ContextField, userRole: string): string => {
  const access = resolveFieldAccess(table, field.name, userRole)
  const optionsPart =
    field.options !== undefined && field.options.length > 0
      ? ` [options: ${field.options.join(', ')}]`
      : ''
  return `    - ${field.name} (type: ${field.type}, access: ${access})${optionsPart}`
}

/** Render one table block (header line + one line per readable field). */
const renderTable = (table: ContextTable, userRole: string): string => {
  const fieldLines = table.fields.map((field) => renderField(table, field, userRole))
  return [`  Table "${table.name}":`, ...fieldLines].join('\n')
}

/**
 * Decide whether a table is visible to the current request:
 *  - the role must have table-level read permission, AND
 *  - if a page scope with `allowedTables` is active, the table must be listed.
 */
const isTableVisible = (
  table: ContextTable,
  userRole: string,
  pageContext: ContextPageScope | undefined
): boolean => {
  if (!hasReadPermission(table as { name: string }, userRole)) return false
  const allowed = pageContext?.allowedTables
  if (allowed !== undefined && !allowed.includes(table.name)) return false
  return true
}

/**
 * An automation is "triggerable" from chat only when it has a `manual`
 * trigger. Cron / record / webhook / form triggers fire automatically and
 * cannot be invoked by the user mid-conversation, so they are excluded
 *.
 */
const isTriggerable = (automation: ContextAutomation): boolean =>
  automation.trigger.type === 'manual'

/** Render one triggerable automation as a single descriptive line. */
const renderAutomation = (automation: ContextAutomation): string => {
  const descriptionPart = automation.description !== undefined ? ` — ${automation.description}` : ''
  return `  - ${automation.name} (canTrigger: true)${descriptionPart}`
}

/**
 * Build the per-request AI chat context block.
 *
 * Returns a plain string suitable for delivery as the `system` message. The
 * block only ever describes *schema* (table/field/automation metadata) — it
 * deliberately contains no record values, credentials, tokens, or env vars,
 * so [internal ref] hold by construction.
 */
export const buildAiChatContext = (input: AiChatContextInput): string => {
  const { appName, userRole, tables, automations, pageContext } = input

  const header: ReadonlyArray<string> = [
    `You are an AI assistant for the "${appName}" application.`,
    `The current user has the "${userRole}" role.`,
  ]

  const pageSection: ReadonlyArray<string> =
    pageContext?.page !== undefined
      ? [`This conversation is scoped to the "${pageContext.page}" page.`]
      : []

  const visibleTables = (tables ?? []).filter((table) =>
    isTableVisible(table, userRole, pageContext)
  )
  const tablesSection: ReadonlyArray<string> =
    visibleTables.length > 0
      ? [
          [
            'Data tables you can reason about:',
            ...visibleTables.map((t) => renderTable(t, userRole)),
          ].join('\n'),
        ]
      : []

  const triggerableAutomations = (automations ?? []).filter(isTriggerable)
  const automationsSection: ReadonlyArray<string> =
    triggerableAutomations.length > 0
      ? [
          ['Automations you can trigger:', ...triggerableAutomations.map(renderAutomation)].join(
            '\n'
          ),
        ]
      : []

  const footer: ReadonlyArray<string> = [
    'Record data is never included here — query individual records on demand when the user asks.',
  ]

  const sections: ReadonlyArray<string> = [
    ...header,
    ...pageSection,
    ...tablesSection,
    ...automationsSection,
    ...footer,
  ]

  return sections.join('\n\n')
}
