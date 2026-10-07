/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { fetchSystemDetailEndpoint } from './use-system-source-fetch'
import type { TableRecord } from '../runtime/types'
import type { SystemDetailSource } from '@/domain/models/app/pages/components/system-detail-source'

// ---------------------------------------------------------------------------
// Single-record (detail) query — CAP-2
// ---------------------------------------------------------------------------

/**
 * The single-record counterpart to `RecordsDataSource`: a record-bound
 * component's `dataSource` shape. `system` (a detail-endpoint binding) is the
 * client-fetching variant this hook serves; the DB-table single-record path
 * (`{ table, mode: single, param }`) is resolved SERVER-side and is left
 * intact — this hook never touches it.
 */
export interface RecordDataSource {
  /** DB-table single-record binding — resolved server-side, NOT fetched here. */
  readonly table?: string
  readonly mode?: string
  readonly param?: string
  /** System detail-endpoint binding (CAP-2) — the client-fetching variant. */
  readonly system?: SystemDetailSource
}

/**
 * Fetch ONE record for a record-bound component from a system DETAIL endpoint.
 *
 * The sibling of `useRecordsQuery` (rows) for SINGLE records: with a
 * `dataSource.system` binding the record comes from a named detail endpoint —
 * `id` injected into the `:param` slot — via the shared `fetchSystemDetailEndpoint`
 * (reusing the same credentialed fetch the rows path uses). The query is disabled
 * until BOTH a system binding and a record id are present. `keyPrefix` namespaces
 * the cache key per consuming island so two components on the same endpoint never
 * collide. The DB-table single-record path stays server-resolved and is untouched.
 */
export function useRecordQuery(
  keyPrefix: string,
  dataSource: RecordDataSource | undefined,
  id: string | undefined
): UseQueryResult<TableRecord | undefined> {
  const system = dataSource?.system
  return useQuery({
    // The whole binding: `recordKey` and the `:param` slot shape the answer.
    queryKey: [`${keyPrefix}-system-detail`, system, id],
    enabled: Boolean(system) && Boolean(id),
    queryFn: (): Promise<TableRecord | undefined> =>
      system && id ? fetchSystemDetailEndpoint(system, id) : Promise.resolve(undefined),
  })
}
