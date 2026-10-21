/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The Tally fetcher: one form and its submissions, read through Tally's REST
 * API (pinned under `[internal ref]`).
 *
 * - `GET /forms/{id}`: the blocks, the conditional logic among them
 *   (`raw/form.json`).
 * - `GET /forms/{id}/submissions?page=N&limit=500`: the submissions, each page
 *   repeating the questions, until `hasMore` is false
 *   (`raw/responses/page-NNNN.json`).
 * - Every request pins the API version in a `tally-version` header, so a key
 *   created before the paginated list shapes still gets them.
 *
 * Tally allows 100 requests a minute; its `429` is plain text with a
 * `Retry-After`, which the client waits out. A Tally key carries every right of
 * its owner, write included: only `GET` is ever sent.
 */

import { Effect } from 'effect'
import { arrayOf, isRecord } from '@/domain/kernel/config-parsing/plain-object'
import { fetchFormDefinition, fetchResponsePages } from './import-fetch-form-pages'
import type { ImportFetchError } from './import-fetch-client'
import type { FetchContext, FetchSummary } from './import-fetch-sink'

/** The API version whose list shapes the fetcher reads. */
const TALLY_VERSION = '2025-02-01'

const FORM_ID = /^[A-Za-z0-9]+$/

/** Why a `tally:` source is not one the fetcher reads, or `undefined`. */
export const refuseTallySource = (id: string): string | undefined =>
  FORM_ID.test(id)
    ? undefined
    : `"tally:${id}" does not name a Tally form. Write it tally:<formId>, the id in the form's link (tally.so/r/<formId>).`

/** How Tally is reached, given the operator's token. */
export const tallyTarget = (token: string) => ({
  tool: 'tally',
  realBaseUrl: 'https://api.tally.so',
  headers: { authorization: `Bearer ${token}`, 'tally-version': TALLY_VERSION },
  lockoutSeconds: 60,
})

/** Submissions per page: the API's maximum. */
const PAGE_SIZE = 500

/** Every uploaded file or signature of a submissions page. */
const filesOf = (page: unknown) =>
  arrayOf(isRecord(page) ? page['submissions'] : undefined).flatMap((submission) =>
    arrayOf(isRecord(submission) ? submission['responses'] : undefined).flatMap((response) =>
      arrayOf(isRecord(response) ? response['answer'] : undefined).flatMap((file) =>
        isRecord(file) && typeof file['url'] === 'string'
          ? [{ source: file['url'], url: file['url'], filename: String(file['name'] ?? 'file') }]
          : []
      )
    )
  )

/** Fetch one Tally form and its submissions into the snapshot. */
export const fetchTallyForm = (
  context: FetchContext,
  formId: string
): Effect.Effect<FetchSummary, ImportFetchError> =>
  Effect.gen(function* () {
    yield* fetchFormDefinition(context, `/forms/${formId}`)
    if (context.domains.includes('forms')) {
      yield* fetchResponsePages(context, {
        request: (cursor) => ({
          path: `/forms/${formId}/submissions`,
          query: { page: cursor ?? '1', limit: String(PAGE_SIZE) },
        }),
        next: (page, cursor) =>
          isRecord(page) && page['hasMore'] === true
            ? String(Number(cursor ?? '1') + 1)
            : undefined,
        files: filesOf,
      })
    }
    return { ids: [formId], apiVersion: TALLY_VERSION }
  }).pipe(Effect.withSpan('import.fetch-tally-form'))
