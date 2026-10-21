/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The Typeform fetcher: one form and its responses, read through the Create
 * and Responses APIs (pinned under `[internal ref]`).
 *
 * - `GET /forms/{id}`: the definition, logic, hidden fields and variables
 *   (`raw/form.json`).
 * - `GET /forms/{id}/responses?page_size=1000&before=<token>`: the responses,
 *   newest first, the last item's `token` as the next cursor, until a page
 *   comes back empty (`raw/responses/page-NNNN.json`).
 * - A file answer is downloaded with the token: Typeform serves it from its
 *   own API, and only there does the token travel.
 *
 * An EU account names its data centre's host before the form:
 * `typeform:api.eu.typeform.com/<formId>` (or `api.typeform.eu`). Typeform
 * documents no `Retry-After`; a `429` is waited out and retried.
 */

import { Effect } from 'effect'
import { arrayOf, isRecord } from '@/domain/kernel/config-parsing/plain-object'
import { fileNameOfUrl } from '@/domain/models/import/form-snapshot-service'
import { fetchFormDefinition, fetchResponsePages } from './import-fetch-form-pages'
import type { ImportFetchError } from './import-fetch-client'
import type { FetchContext, FetchSummary } from './import-fetch-sink'

/** The hosts a Typeform account's data lives on. */
const HOSTS: ReadonlySet<string> = new Set([
  'api.typeform.com',
  'api.eu.typeform.com',
  'api.typeform.eu',
])

const FORM_ID = /^[A-Za-z0-9]+$/

/** The host and form a `typeform:[<host>/]<formId>` source names, or `undefined`. */
export const parseTypeformSource = (
  id: string
): { readonly host: string; readonly formId: string } | undefined => {
  const slash = id.lastIndexOf('/')
  const host = slash < 0 ? 'api.typeform.com' : id.slice(0, slash)
  const formId = id.slice(slash + 1)
  return HOSTS.has(host) && FORM_ID.test(formId) ? { host, formId } : undefined
}

/** Why a `typeform:` source is not one the fetcher reads, or `undefined`. */
export const refuseTypeformSource = (id: string): string | undefined =>
  parseTypeformSource(id) === undefined
    ? `"typeform:${id}" does not name a Typeform form. Write it typeform:<formId> (the id in the form's link), or typeform:api.eu.typeform.com/<formId> for an account in the EU data centre.`
    : undefined

/** How Typeform is reached, given the operator's token and the source. */
export const typeformTarget = (token: string, id: string) => ({
  tool: 'typeform',
  realBaseUrl: `https://${parseTypeformSource(id)?.host ?? 'api.typeform.com'}`,
  headers: { authorization: `Bearer ${token}` },
  lockoutSeconds: 5,
})

/** Responses per page: the API's maximum. */
const PAGE_SIZE = '1000'

const itemsOf = (page: unknown): readonly unknown[] =>
  arrayOf(isRecord(page) ? page['items'] : undefined)

/** Every file answer of a responses page. */
const filesOf = (page: unknown) =>
  itemsOf(page).flatMap((item) =>
    arrayOf(isRecord(item) ? item['answers'] : undefined).flatMap((answer) =>
      isRecord(answer) && typeof answer['file_url'] === 'string'
        ? [
            {
              source: answer['file_url'],
              url: answer['file_url'],
              filename: fileNameOfUrl(answer['file_url']),
            },
          ]
        : []
    )
  )

/** The cursor after a page: its last item's token, or none when the page is empty. */
const nextOf = (page: unknown): string | undefined => {
  const last = itemsOf(page).at(-1)
  return isRecord(last) && typeof last['token'] === 'string' ? last['token'] : undefined
}

/** Fetch one Typeform form and its responses into the snapshot. */
export const fetchTypeformForm = (
  context: FetchContext,
  id: string
): Effect.Effect<FetchSummary, ImportFetchError> =>
  Effect.gen(function* () {
    const formId = parseTypeformSource(id)?.formId ?? id
    yield* fetchFormDefinition(context, `/forms/${formId}`)
    if (context.domains.includes('forms')) {
      yield* fetchResponsePages(context, {
        request: (cursor) => ({
          path: `/forms/${formId}/responses`,
          query: { page_size: PAGE_SIZE, ...(cursor === undefined ? {} : { before: cursor }) },
        }),
        next: nextOf,
        files: filesOf,
        authenticatedFiles: true,
      })
    }
    return { ids: [formId], apiVersion: 'v1' }
  }).pipe(Effect.withSpan('import.fetch-typeform-form'))
