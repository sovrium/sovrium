/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The Google Forms fetcher: one form and its responses, read through the
 * Forms API v1 (pinned under `[internal ref]`).
 *
 * - `GET /v1/forms/{formId}` (`forms.get`, scope `forms.body.readonly`): the
 *   items, sections and per-option branching (`raw/form.json`).
 * - `GET /v1/forms/{formId}/responses?pageSize=5000` (`forms.responses.list`,
 *   scope `forms.responses.readonly`): the responses, until a page names no
 *   `nextPageToken` (`raw/responses/page-NNNN.json`).
 * - The OAuth access token travels as `Authorization: Bearer`.
 *
 * Uploaded files are Google Drive files: downloading them is another API with
 * another scope, so nothing is asked of Drive and the answers keep the file
 * names and ids. A `429` names no `Retry-After`; it is waited out and retried.
 * Only `GET` is ever sent.
 */

import { Effect } from 'effect'
import { isRecord } from '@/domain/kernel/config-parsing/plain-object'
import { fetchFormDefinition, fetchResponsePages } from './import-fetch-form-pages'
import type { ImportFetchError, ImportFetchTarget } from './import-fetch-client'
import type { FetchContext, FetchSummary } from './import-fetch-sink'

const FORM_ID = /^[A-Za-z0-9_-]+$/

/** Why a `gforms:` source is not one the fetcher reads, or `undefined`. */
export const refuseGoogleFormsSource = (id: string): string | undefined =>
  FORM_ID.test(id)
    ? undefined
    : `"gforms:${id}" does not name a Google form. Write it gforms:<formId>, the id in the form's edit link (docs.google.com/forms/d/<formId>/edit).`

/** How the Forms API is reached, given the operator's access token. */
export const googleFormsTarget = (token: string): ImportFetchTarget => ({
  tool: 'google-forms',
  realBaseUrl: 'https://forms.googleapis.com',
  headers: { authorization: `Bearer ${token}` },
  lockoutSeconds: 30,
})

/** Responses per page: the most the API returns. */
const PAGE_SIZE = '5000'

/** Fetch one Google form and its responses into the snapshot. */
export const fetchGoogleForm = (
  context: FetchContext,
  formId: string
): Effect.Effect<FetchSummary, ImportFetchError> =>
  Effect.gen(function* () {
    yield* fetchFormDefinition(context, `/v1/forms/${formId}`)
    if (context.domains.includes('forms')) {
      yield* fetchResponsePages(context, {
        request: (cursor) => ({
          path: `/v1/forms/${formId}/responses`,
          query: { pageSize: PAGE_SIZE, ...(cursor === undefined ? {} : { pageToken: cursor }) },
        }),
        next: (page) =>
          isRecord(page) &&
          typeof page['nextPageToken'] === 'string' &&
          page['nextPageToken'] !== ''
            ? page['nextPageToken']
            : undefined,
        files: () => [],
      })
    }
    return { ids: [formId], apiVersion: 'v1' }
  }).pipe(Effect.withSpan('import.fetch-google-form'))
