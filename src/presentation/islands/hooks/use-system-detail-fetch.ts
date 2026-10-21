/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { localizeRunRecord } from '@/domain/models/app/pages/automation-run-status'
import { buildDetailEndpointUrl } from '@/domain/models/app/pages/system-detail-endpoint'
import { readErrorBody } from '../runtime/system-response-read'
import type { TableRecord } from '../runtime/types'
import type { SystemDetailSource } from '@/domain/models/app/pages/components/system-detail-source'

/**
 * Single-record DETAIL fetch — the counterpart to the rows-envelope
 * fetch in `use-system-source-fetch.ts`. Where the rows fetch extracts an ARRAY
 * at `rowsKey`, the detail fetch injects a bound record id into the endpoint's
 * `:param` placeholder (`buildDetailEndpointUrl`, shared with the renderer's
 * server-side resolution) and extracts exactly ONE record at
 * `recordKey` (or the whole body when `recordKey` is omitted). It reuses the
 * SAME credentialed `fetch` discipline so admin detail endpoints authorize the
 * request. Mirrors `SystemDetailSourceSchema`.
 *
 * Its own module because a module is the bundler's unit: beside the rows read,
 * every list-family island (list, kanban, calendar, gallery, timeline) shipped
 * this half too, though none of them ever reads a single record.
 */

/**
 * Parse a detail-endpoint response into a single record: read it at `recordKey`
 * (fallback the whole body), normalize its id onto the canonical `id` key from
 * `idKey` (default `'id'`) so downstream field lookups resolve uniformly, then
 * localize the run status — the record's own and its steps' — for a runs
 * endpoint.
 */
export function parseSystemDetailEnvelope(
  system: SystemDetailSource,
  json: Record<string, unknown>
): TableRecord {
  const raw = system.recordKey !== undefined ? json[system.recordKey] : json
  const record = (typeof raw === 'object' && raw !== null ? raw : {}) as TableRecord
  const idKey = system.idKey ?? 'id'
  const identified = idKey === 'id' ? record : { ...record, id: record[idKey] }
  return localizeRunRecord(system.endpoint, identified)
}

/**
 * Fetch ONE record from a system detail endpoint (the bound id injected into the
 * `:param` slot) and normalize it to a single record. Sends the session cookie
 * so admin detail endpoints authorize the request.
 */
export async function fetchSystemDetailEndpoint(
  system: SystemDetailSource,
  id: string
): Promise<TableRecord> {
  const url = buildDetailEndpointUrl(system, id)
  const res = await fetch(url, { credentials: 'include' })

  if (!res.ok) {
    // The status rides on `cause`, where the retry rule reads it: a refused read
    // is an answer, and asking again cannot change it.
    throw new Error(`Failed to fetch system record: ${res.status} ${await readErrorBody(res)}`, {
      cause: { status: res.status },
    })
  }

  const json = (await res.json()) as Record<string, unknown>
  return parseSystemDetailEnvelope(system, json)
}
