/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useQuery } from '@tanstack/react-query'
import { createTableClient } from '@/presentation/api/client'


interface TablePermissions {
  readonly table: {
    readonly read: boolean
    readonly create: boolean
    readonly update: boolean
    readonly delete: boolean
  }
  readonly fields: Readonly<Record<string, { readonly read: boolean; readonly write: boolean }>>
}


const tableClient = createTableClient(typeof window !== 'undefined' ? window.location.origin : '')


export function useTablePermissions(tableName: string) {
  return useQuery<TablePermissions>({
    queryKey: ['table-permissions', tableName],
    queryFn: async () => {
      const res = await tableClient.api.tables[':tableId'].permissions.$get({
        param: { tableId: tableName },
      })

      if (!res.ok) {
        return {
          table: { read: false, create: false, update: false, delete: false },
          fields: {},
        }
      }

      return res.json() as Promise<TablePermissions>
    },
    staleTime: 5 * 60 * 1000,
  })
}
