/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useQuery } from '@tanstack/react-query'
import { createTableClient } from '@/presentation/api/client'


const tableApiClient = createTableClient(
  typeof window !== 'undefined' ? window.location.origin : ''
)

export interface DragPermissionState {
  readonly canDrag: boolean
  readonly resolved: boolean
}

interface SessionProbeResult {
  readonly authEnabled: boolean
  readonly signedIn: boolean
}

interface PermissionsResult {
  readonly table: { readonly update: boolean }
  readonly fields: Readonly<Record<string, { readonly read: boolean; readonly write: boolean }>>
}

interface ResolveDragPermissionInput {
  readonly enabled: boolean
  readonly groupByField: string | undefined
  readonly sessionPending: boolean
  readonly sessionData: SessionProbeResult | undefined
  readonly permissionsPending: boolean
  readonly permissions: PermissionsResult | undefined
}

async function probeAuthSession(): Promise<SessionProbeResult> {
  try {
    const res = await fetch('/api/auth/get-session', {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
    if (res.status === 404) return { authEnabled: false, signedIn: false }
    if (!res.ok) return { authEnabled: true, signedIn: false }
    const body = (await res.json()) as { readonly user?: unknown } | null
    return { authEnabled: true, signedIn: Boolean(body?.user) }
  } catch {
    return { authEnabled: false, signedIn: false }
  }
}

function isFieldWritable(perms: PermissionsResult, groupByField: string | undefined): boolean {
  if (!groupByField) return true
  return perms.fields[groupByField]?.write !== false
}

function resolveDragPermission(input: ResolveDragPermissionInput): DragPermissionState {
  if (!input.enabled) return { canDrag: false, resolved: true }
  if (input.sessionPending) return { canDrag: false, resolved: false }
  if (!input.sessionData?.authEnabled) return { canDrag: true, resolved: true }
  if (input.permissionsPending) return { canDrag: false, resolved: false }
  const perms = input.permissions
  if (!perms || perms.table.update !== true) return { canDrag: false, resolved: true }
  if (!isFieldWritable(perms, input.groupByField)) return { canDrag: false, resolved: true }
  return { canDrag: true, resolved: true }
}

export function useDragPermission(
  tableName: string | undefined,
  groupByField: string | undefined,
  enabled: boolean
): DragPermissionState {
  const sessionProbe = useQuery({
    queryKey: ['kanban-auth-probe'],
    enabled,
    retry: false,
    staleTime: 5 * 60 * 1000,
    queryFn: probeAuthSession,
  })

  const authEnabled = sessionProbe.data?.authEnabled ?? false
  const permissionsQuery = useQuery({
    queryKey: ['kanban-permissions', tableName],
    enabled: enabled && authEnabled && Boolean(tableName),
    retry: false,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!tableName) return undefined
      const res = await tableApiClient.api.tables[':tableId'].permissions.$get({
        param: { tableId: tableName },
      })
      if (!res.ok) return undefined
      return res.json() as Promise<PermissionsResult>
    },
  })

  return resolveDragPermission({
    enabled,
    groupByField,
    sessionPending: sessionProbe.isPending,
    sessionData: sessionProbe.data,
    permissionsPending: permissionsQuery.isPending,
    permissions: permissionsQuery.data,
  })
}
