/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { isAiAccessEnabled } from '@/domain/models/shared/ai-access'
import type { App } from '@/domain/models/app'
import type { AiAccess, AiAccessOperation } from '@/domain/models/shared/ai-access'

const DEFAULT_TABLE_OPERATIONS: ReadonlyArray<AiAccessOperation> = [
  'read',
  'list',
  'create',
  'update',
  'delete',
]

export type McpToolCategory = 'table' | 'action' | 'automation'

export interface McpToolListing {
  readonly name: string
  readonly category: McpToolCategory
  readonly description: string
}

function resolveOperations(access: AiAccess | undefined): ReadonlyArray<AiAccessOperation> {
  if (access === undefined || typeof access === 'boolean') return DEFAULT_TABLE_OPERATIONS
  return access.operations ?? DEFAULT_TABLE_OPERATIONS
}

const OPERATION_VERBS: Readonly<Record<AiAccessOperation, string>> = {
  read: 'Lire un enregistrement',
  list: 'Lister les enregistrements',
  create: 'Créer un enregistrement',
  update: 'Modifier un enregistrement',
  delete: 'Supprimer un enregistrement',
}

function listTableTools(appName: string, app: App): ReadonlyArray<McpToolListing> {
  return (app.tables ?? []).flatMap((table) => {
    if (!isAiAccessEnabled(table.aiAccess)) return []
    return resolveOperations(table.aiAccess).map((operation) => ({
      name: `${appName}_${table.name}_${operation}`,
      category: 'table' as const,
      description: `${OPERATION_VERBS[operation]} dans la table « ${table.name} ».`,
    }))
  })
}

function listActionTools(appName: string, app: App): ReadonlyArray<McpToolListing> {
  return (app.actions ?? []).flatMap((template) => {
    if (!isAiAccessEnabled(template.aiAccess)) return []
    const overridden =
      typeof template.aiAccess === 'object' ? template.aiAccess.description : undefined
    return [
      {
        name: `${appName}_action_${template.name}`,
        category: 'action' as const,
        description:
          overridden && overridden.length > 0
            ? overridden
            : `Exécuter l’action « ${template.name} ».`,
      },
    ]
  })
}

function listAutomationTools(appName: string, app: App): ReadonlyArray<McpToolListing> {
  return (app.automations ?? []).flatMap((automation) => {
    if (!isAiAccessEnabled(automation.aiAccess)) return []
    if (automation.trigger.type !== 'manual') return []
    const overridden =
      typeof automation.aiAccess === 'object' ? automation.aiAccess.description : undefined
    return [
      {
        name: `${appName}_automation_${automation.name}`,
        category: 'automation' as const,
        description:
          overridden && overridden.length > 0
            ? overridden
            : `Déclencher l’automatisation « ${automation.name} ».`,
      },
    ]
  })
}

export function listMcpTools(app: App): ReadonlyArray<McpToolListing> {
  const appName = app.name
  return [
    ...listTableTools(appName, app),
    ...listActionTools(appName, app),
    ...listAutomationTools(appName, app),
  ]
}
