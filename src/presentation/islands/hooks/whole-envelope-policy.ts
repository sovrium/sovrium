/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { getPageQueryClient } from '../runtime/query-client'
import { RECORDS_PAGE_SIZE } from '../runtime/records-api'
import { fetchSystemEnvelope, systemEnvelopeQueryKey } from '../runtime/system-envelope-query'
import { parseSystemEnvelope } from './use-system-source-fetch'
import type { FetchResult } from './use-system-source-fetch'
import type { SystemSource } from '@/domain/models/app/pages/components/system-source'

/** The parts of a list-family page request that decide whether it is a whole read. */
interface WholeEnvelopeRequest {
  readonly system: SystemSource
  readonly sortParam: string | undefined
  readonly pageSize: number
}

/**
 * How long a whole-envelope read is shared with the page's other readers: long
 * enough for the islands one page load mounts, short enough that a refresh
 * reads again.
 */
const SHARED_ENVELOPE_WINDOW_MS = 5000

/**
 * A first page that asks for the WHOLE set of a system read — no declared
 * `limit` (the page size is the records ceiling), no sort, no `totalKey`
 * paging the endpoint, no `limit` in its static query — is the same question
 * a KPI tile or a chart asks of that endpoint. It is read through their one
 * cache entry (`systemEnvelopeQueryKey`), so a form's Insights tab, whose
 * figures, per-day series and drop-off steps all come from one analytics
 * envelope, asks the server once rather than once more for the list.
 */
export const readsWholeEnvelope = (request: WholeEnvelopeRequest, pageIndex: number): boolean =>
  pageIndex === 0 &&
  request.sortParam === undefined &&
  request.pageSize === RECORDS_PAGE_SIZE &&
  request.system.totalKey === undefined &&
  !Object.hasOwn(request.system.query ?? {}, 'limit')

/** The whole envelope, from the page's shared cache entry, as one page of rows. */
export async function fetchWholeEnvelope(system: SystemSource): Promise<FetchResult> {
  const result = await getPageQueryClient().fetchQuery({
    queryKey: systemEnvelopeQueryKey(system),
    queryFn: () => fetchSystemEnvelope(system),
    staleTime: SHARED_ENVELOPE_WINDOW_MS,
  })
  if (result.kind === 'denied') {
    throw new Error(`The server refused this request (${result.status}).`, {
      cause: { status: result.status, body: result.body },
    })
  }
  return parseSystemEnvelope(system, undefined, (result.envelope ?? {}) as Record<string, unknown>)
}
