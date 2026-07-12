/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { TableRecord } from '../shared/types'
import type { SystemDetailSource } from '@/domain/models/app/pages/components/system-detail-source'
import type { SystemSource } from '@/domain/models/app/pages/components/system-source'



export interface FetchResult {
  readonly records: readonly TableRecord[]
  readonly total: number
}

export interface SystemPagination {
  readonly pageIndex: number
  readonly pageSize?: number
}

export interface SystemQueryInput {
  readonly system: SystemSource
  readonly systemQuery?: Record<string, string>
  readonly pagination: SystemPagination
  readonly sortParam?: string
  readonly globalFilter?: string
}

export interface SystemFetchQuery extends SystemQueryInput {
  readonly sourceId?: string
}


const RUN_STATUS_LABELS: Record<string, string> = {
  completed: 'Succès',
  failed: 'Échec',
  'completed-with-errors': 'Partiel',
}

function localizeRunStatusRows(
  endpoint: string,
  sourceId: string | undefined,
  rows: readonly TableRecord[]
): readonly TableRecord[] {
  if (!sourceId || !endpoint.includes('/automations/runs')) return rows
  return rows.map((row) => {
    const raw = row['status']
    if (typeof raw !== 'string') return row
    const label = RUN_STATUS_LABELS[raw]
    return label ? { ...row, status: label } : row
  })
}


export function buildSystemQueryString({
  system,
  systemQuery,
  pagination,
  sortParam,
  globalFilter,
}: SystemQueryInput): string {
  const params = new URLSearchParams()
  Object.entries(system.query ?? {}).forEach(([key, value]) => {
    params.set(key, String(value))
  })
  Object.entries(systemQuery ?? {}).forEach(([key, value]) => {
    if (value === '') params.delete(key)
    else params.set(key, value)
  })
  params.set('page', String(pagination.pageIndex + 1))
  if (pagination.pageSize) params.set('limit', String(pagination.pageSize))
  if (sortParam) params.set('sort', sortParam)
  if (globalFilter) params.set('q', globalFilter)
  return params.toString()
}

export function parseSystemEnvelope(
  system: SystemSource,
  sourceId: string | undefined,
  json: Record<string, unknown>
): FetchResult {
  const rowsKey = system.rowsKey ?? 'items'
  const idKey = system.idKey ?? 'id'
  const rawRows = Array.isArray(json[rowsKey]) ? (json[rowsKey] as readonly TableRecord[]) : []
  const idMapped: readonly TableRecord[] = rawRows.map((row) =>
    idKey === 'id' ? row : { ...row, id: row[idKey] }
  )
  const records = localizeRunStatusRows(system.endpoint, sourceId, idMapped)
  const totalRaw = system.totalKey ? json[system.totalKey] : undefined
  const total = typeof totalRaw === 'number' ? totalRaw : records.length
  return { records, total }
}

export async function fetchSystemEndpoint({
  system,
  systemQuery,
  sourceId,
  pagination,
  sortParam,
  globalFilter,
}: SystemFetchQuery): Promise<FetchResult> {
  const suffix = buildSystemQueryString({
    system,
    systemQuery,
    pagination,
    sortParam,
    globalFilter,
  })
  const url = `${system.endpoint}${suffix ? `?${suffix}` : ''}`
  const res = await fetch(url, { credentials: 'include' })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Failed to fetch system rows: ${res.status} ${body}`)
  }

  const json = (await res.json()) as Record<string, unknown>
  return parseSystemEnvelope(system, sourceId, json)
}



export function buildDetailEndpointUrl(system: SystemDetailSource, id: string): string {
  const placeholder = `:${system.param ?? 'id'}`
  const path = system.endpoint.includes(placeholder)
    ? system.endpoint.replace(placeholder, encodeURIComponent(id))
    : system.endpoint
  const params = new URLSearchParams()
  Object.entries(system.query ?? {}).forEach(([key, value]) => {
    params.set(key, String(value))
  })
  const suffix = params.toString()
  return `${path}${suffix ? `?${suffix}` : ''}`
}

export function parseSystemDetailEnvelope(
  system: SystemDetailSource,
  json: Record<string, unknown>
): TableRecord {
  const raw = system.recordKey !== undefined ? json[system.recordKey] : json
  const record = (typeof raw === 'object' && raw !== null ? raw : {}) as TableRecord
  const idKey = system.idKey ?? 'id'
  return idKey === 'id' ? record : { ...record, id: record[idKey] }
}

export async function fetchSystemDetailEndpoint(
  system: SystemDetailSource,
  id: string
): Promise<TableRecord> {
  const url = buildDetailEndpointUrl(system, id)
  const res = await fetch(url, { credentials: 'include' })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Failed to fetch system record: ${res.status} ${body}`)
  }

  const json = (await res.json()) as Record<string, unknown>
  return parseSystemDetailEnvelope(system, json)
}
