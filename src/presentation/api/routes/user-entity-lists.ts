/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


export type EntityType = 'record' | 'page'

export interface EntityMutationInput {
  readonly entityType: EntityType
  readonly entityId: string
  readonly tableName: string | null
}

export const parseEntityMutationBody = (body: unknown): EntityMutationInput | undefined => {
  if (typeof body !== 'object' || body === null) return undefined
  const record = body as Record<string, unknown>
  const entityType = typeof record['entityType'] === 'string' ? record['entityType'] : undefined
  const entityId = typeof record['entityId'] === 'string' ? record['entityId'] : undefined
  if (entityType === undefined || entityId === undefined) return undefined
  if (entityType !== 'record' && entityType !== 'page') return undefined
  const tableName = typeof record['tableName'] === 'string' ? record['tableName'] : null
  return { entityType, entityId, tableName }
}
