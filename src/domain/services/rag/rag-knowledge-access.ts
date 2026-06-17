/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { hasPermission } from '@/domain/models/shared/permissions'

interface KnowledgeAccessTable {
  readonly name: string
  readonly permissions?: { readonly read?: unknown }
}

interface KnowledgeAccessAgent {
  readonly role?: string
  readonly knowledge?: {
    readonly tables?: ReadonlyArray<{
      readonly table: string
      readonly fields: ReadonlyArray<string>
      readonly filter?: Readonly<Record<string, unknown>>
    }>
  }
}

export const canAgentReadKnowledgeTable = (role: string, read: unknown): boolean => {
  if (role === 'admin') return true
  if (read === 'all' || read === 'authenticated') return true
  if (Array.isArray(read)) return hasPermission(read, role)
  return role === 'member'
}

export const filterAgentKnowledgeTables = <T extends KnowledgeAccessAgent>(
  agent: T,
  tables: ReadonlyArray<KnowledgeAccessTable>
): T => {
  const knowledgeTables = agent.knowledge?.tables
  if (knowledgeTables === undefined || knowledgeTables.length === 0) return agent

  const role = agent.role ?? 'member'
  const readByTable = new Map(tables.map((t) => [t.name, t.permissions?.read] as const))

  const allowed = knowledgeTables.filter((entry) => {
    if (!readByTable.has(entry.table)) return true
    return canAgentReadKnowledgeTable(role, readByTable.get(entry.table))
  })

  return {
    ...agent,
    knowledge: { ...agent.knowledge, tables: allowed },
  }
}
