/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


export type AdminSearchEntityType =
  | 'record'
  | 'submission'
  | 'run'
  | 'user'
  | 'file'
  | 'conversation'
  | 'connection'

export interface AdminSearchResult {
  readonly type: AdminSearchEntityType
  readonly entityId: string
  readonly title: string
  readonly href: string
  readonly updatedAt: string
}

export interface AdminSearchGroup {
  readonly type: AdminSearchEntityType
  readonly results: ReadonlyArray<AdminSearchResult>
}

export interface AdminSearchResponse {
  readonly query: string
  readonly groups: ReadonlyArray<AdminSearchGroup>
}

export const ENTITY_TYPE_LABELS: Readonly<Record<AdminSearchEntityType, string>> = {
  record: 'Enregistrements',
  submission: 'Soumissions',
  run: 'Exécutions',
  user: 'Utilisateurs',
  file: 'Fichiers',
  conversation: 'Conversations',
  connection: 'Connexions',
}

export async function fetchAdminSearch(query: string): Promise<AdminSearchResponse | undefined> {
  try {
    const response = await fetch(`/api/admin/search?q=${encodeURIComponent(query)}`, {
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) return undefined
    return (await response.json()) as AdminSearchResponse
  } catch {
    return undefined
  }
}
