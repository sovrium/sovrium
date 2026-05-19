/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { hasPermission } from '@/domain/models/shared/permissions'

const TEXT_LIKE_FIELD_TYPES: ReadonlySet<string> = new Set([
  'single-line-text',
  'long-text',
  'rich-text',
  'markdown',
])

interface AppKnowledgeShape {
  readonly tables?: ReadonlyArray<{
    readonly name: string
    readonly fields: ReadonlyArray<{ readonly name: string; readonly type: string }>
    readonly permissions?: { readonly read?: unknown }
  }>
  readonly agents?: ReadonlyArray<{
    readonly name: string
    readonly role?: string
    readonly knowledge?: {
      readonly tables?: ReadonlyArray<{
        readonly table: string
        readonly fields: ReadonlyArray<string>
      }>
    }
  }>
}

interface KnowledgeTableMeta {
  readonly fieldTypes: ReadonlyMap<string, string>
  readonly read: unknown
}

type TableFieldMap = ReadonlyMap<string, KnowledgeTableMeta>

const validateKnowledgeField = (
  agentName: string,
  table: string,
  field: string,
  fieldTypes: ReadonlyMap<string, string>
): string | undefined => {
  const fieldType = fieldTypes.get(field)
  if (fieldType === undefined) {
    return `Agent '${agentName}' knowledge references field '${field}' which does not exist on table '${table}'.`
  }
  if (!TEXT_LIKE_FIELD_TYPES.has(fieldType)) {
    return `Agent '${agentName}' knowledge field '${table}.${field}' has field type '${fieldType}' which is not a valid text-like knowledge source. Only single-line-text, long-text, rich-text, and markdown fields can be embedded.`
  }
  return undefined
}

const validateAgentKnowledge = (
  agent: NonNullable<AppKnowledgeShape['agents']>[number],
  tableMap: TableFieldMap
): string | undefined =>
  (agent.knowledge?.tables ?? [])
    .flatMap((entry): ReadonlyArray<string> => {
      const meta = tableMap.get(entry.table)
      if (meta === undefined) {
        return [
          `Agent '${agent.name}' knowledge references table '${entry.table}' which does not exist (table not found).`,
        ]
      }
      const rbacError = validateKnowledgeTablePermission(agent, entry.table, meta.read)
      if (rbacError !== undefined) {
        return [rbacError]
      }
      return entry.fields
        .map((field) => validateKnowledgeField(agent.name, entry.table, field, meta.fieldTypes))
        .filter((msg): msg is string => msg !== undefined)
    })
    .at(0)

const validateKnowledgeTablePermission = (
  agent: NonNullable<AppKnowledgeShape['agents']>[number],
  table: string,
  read: unknown
): string | undefined => {
  if (agent.role !== 'viewer') return undefined
  if (hasPermission(read, 'viewer')) return undefined
  return `Agent '${agent.name}' (role 'viewer') lacks read access permission to embed table '${table}' as knowledge. The agent's role does not satisfy the table's read RBAC.`
}

export const validateAllKnowledgeReferences = (app: AppKnowledgeShape): true | string => {
  const agents = app.agents ?? []
  if (agents.length === 0) return true

  const tableMap: TableFieldMap = new Map(
    (app.tables ?? []).map((t) => [
      t.name,
      {
        fieldTypes: new Map(t.fields.map((f) => [f.name, f.type] as const)),
        read: t.permissions?.read,
      } satisfies KnowledgeTableMeta,
    ])
  )

  return agents.flatMap((agent) => validateAgentKnowledge(agent, tableMap) ?? []).at(0) ?? true
}
