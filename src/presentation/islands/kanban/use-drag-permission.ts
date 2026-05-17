/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useQuery } from '@tanstack/react-query'
import { createTableClient } from '@/presentation/api/client'

// ---------------------------------------------------------------------------
// API client (singleton)
// ---------------------------------------------------------------------------

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
    // Network or parse failure — treat as no auth so we don't lock the UI.
    return { authEnabled: false, signedIn: false }
  }
}

function isFieldWritable(perms: PermissionsResult, groupByField: string | undefined): boolean {
  if (!groupByField) return true
  return perms.fields[groupByField]?.write !== false
}

/**
 * Resolve permission state from probe + permissions results. Pure function
 * extracted from the hook so the chain of early returns can be tested in
 * isolation and the hook stays under the complexity threshold.
 *
 * Order matters here — gates short-circuit in this order:
 *   1. drag config disabled → resolved=true, canDrag=false
 *   2. auth probe still pending → unresolved
 *   3. auth not configured → guest mode, canDrag=true
 *   4. table permissions still pending → unresolved
 *   5. permissions returned undefined / no table.update → canDrag=false
 *   6. groupBy field's write=false → canDrag=false
 *   7. all gates passed → canDrag=true
 */
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

/**
 * Determine whether the current user is allowed to drag cards.
 *
 * The drag gate combines two signals:
 *   1. Whether auth is enabled (probed via `/api/auth/get-session`). When auth
 *      is not configured, that endpoint returns 404 and we treat the user as a
 *      guest with full drag access — matching the no-auth behaviour of the
 *      records API (`hasUpdatePermission` allows guests by default).
 *   2. When auth IS configured, we honour the table-level `update` permission
 *      and the per-field `write` permission for the groupBy field returned by
 *      `/api/tables/:tableId/permissions`.
 *
 * The hook returns `resolved: false` while either probe is pending so the
 * island can avoid rendering `draggable="true"` in a flickering state.
 */
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
