/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { hasReadPermission } from '@/domain/validators/permission-evaluators'

export interface ContextField {
  readonly name: string
  readonly type: string
  readonly options?: ReadonlyArray<string>
}

export interface ContextTable {
  readonly name: string
  readonly fields: ReadonlyArray<ContextField>
  readonly permissions?: {
    readonly read?: unknown
    readonly fields?: ReadonlyArray<{
      readonly field: string
      readonly read?: unknown
      readonly write?: unknown
    }>
  }
}

export interface ContextAutomation {
  readonly name: string
  readonly description?: string
  readonly trigger: { readonly type: string }
}

export interface ContextPageScope {
  readonly page?: string
  readonly allowedTables?: ReadonlyArray<string>
}

export interface AiChatContextInput {
  readonly appName: string
  readonly userRole: string
  readonly tables?: ReadonlyArray<ContextTable>
  readonly automations?: ReadonlyArray<ContextAutomation>
  readonly pageContext?: ContextPageScope
}

const resolveFieldAccess = (
  table: ContextTable,
  fieldName: string,
  userRole: string
): 'read' | 'read-write' => {
  const fieldPerm = table.permissions?.fields?.find((entry) => entry.field === fieldName)
  if (fieldPerm === undefined) return 'read-write'
  const canWrite = roleAllowed(fieldPerm.write, userRole, true)
  return canWrite ? 'read-write' : 'read'
}

const roleAllowed = (permission: unknown, userRole: string, undefinedDefault: boolean): boolean => {
  if (permission === undefined) return undefinedDefault
  if (permission === 'all' || permission === 'authenticated') return true
  if (Array.isArray(permission)) return permission.includes(userRole)
  return false
}

const renderField = (table: ContextTable, field: ContextField, userRole: string): string => {
  const access = resolveFieldAccess(table, field.name, userRole)
  const optionsPart =
    field.options !== undefined && field.options.length > 0
      ? ` [options: ${field.options.join(', ')}]`
      : ''
  return `    - ${field.name} (type: ${field.type}, access: ${access})${optionsPart}`
}

const renderTable = (table: ContextTable, userRole: string): string => {
  const fieldLines = table.fields.map((field) => renderField(table, field, userRole))
  return [`  Table "${table.name}":`, ...fieldLines].join('\n')
}

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

const isTriggerable = (automation: ContextAutomation): boolean =>
  automation.trigger.type === 'manual'

const renderAutomation = (automation: ContextAutomation): string => {
  const descriptionPart = automation.description !== undefined ? ` — ${automation.description}` : ''
  return `  - ${automation.name} (canTrigger: true)${descriptionPart}`
}

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
