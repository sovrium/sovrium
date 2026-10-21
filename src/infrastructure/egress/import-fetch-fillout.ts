/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The Fillout fetcher: one form's metadata and its finished submissions, read
 * through Fillout's REST API (pinned under
 * `[internal ref]`).
 *
 * - `GET /v1/api/forms/{id}`: the questions, calculations and URL parameters
 *   (`raw/form.json`); Fillout exposes no pages and no logic.
 * - `GET /v1/api/forms/{id}/submissions?limit=150&offset=N`: the finished
 *   submissions, oldest first, until `offset` reaches `totalResponses`
 *   (`raw/responses/page-NNNN.json`).
 *
 * An EU account writes `fillout:eu/<formId>` and is read from
 * `eu-api.fillout.com`. Fillout allows 5 requests a second; its `429` carries
 * a `Retry-After`. A Fillout key is full access, write included: only `GET`
 * is ever sent.
 */

import { Effect } from 'effect'
import { arrayOf, isRecord } from '@/domain/kernel/config-parsing/plain-object'
import { fetchFormDefinition, fetchResponsePages } from './import-fetch-form-pages'
import type { ImportFetchError } from './import-fetch-client'
import type { FetchContext, FetchSummary } from './import-fetch-sink'

const FORM_ID = /^[A-Za-z0-9]+$/

/** The region and form a `fillout:[eu/]<formId>` source names, or `undefined`. */
export const parseFilloutSource = (
  id: string
): { readonly host: string; readonly formId: string } | undefined => {
  const eu = id.startsWith('eu/')
  const formId = eu ? id.slice('eu/'.length) : id
  return FORM_ID.test(formId)
    ? { host: eu ? 'eu-api.fillout.com' : 'api.fillout.com', formId }
    : undefined
}

/** Why a `fillout:` source is not one the fetcher reads, or `undefined`. */
export const refuseFilloutSource = (id: string): string | undefined =>
  parseFilloutSource(id) === undefined
    ? `"fillout:${id}" does not name a Fillout form. Write it fillout:<formId>, or fillout:eu/<formId> for an account in the EU region.`
    : undefined

/** How Fillout is reached, given the operator's token and the source. */
export const filloutTarget = (token: string, id: string) => ({
  tool: 'fillout',
  realBaseUrl: `https://${parseFilloutSource(id)?.host ?? 'api.fillout.com'}`,
  headers: { authorization: `Bearer ${token}` },
  lockoutSeconds: 1,
})

/** Submissions per page: the API's maximum. */
const PAGE_SIZE = 150

const responsesOf = (page: unknown): readonly unknown[] =>
  arrayOf(isRecord(page) ? page['responses'] : undefined)

/** Every uploaded file of a submissions page. */
const filesOf = (page: unknown) =>
  responsesOf(page).flatMap((submission) =>
    arrayOf(isRecord(submission) ? submission['questions'] : undefined).flatMap((question) =>
      arrayOf(isRecord(question) ? question['value'] : undefined).flatMap((file) =>
        isRecord(file) && typeof file['url'] === 'string'
          ? [
              {
                source: file['url'],
                url: file['url'],
                filename: String(file['filename'] ?? 'file'),
              },
            ]
          : []
      )
    )
  )

/** The offset of the next page, or none once every submission has been read. */
const nextOf = (page: unknown, cursor: string | undefined): string | undefined => {
  const served = responsesOf(page).length
  const next = Number(cursor ?? '0') + served
  const total = isRecord(page) ? Number(page['totalResponses']) : Number.NaN
  return served === 0 || (Number.isFinite(total) && next >= total) ? undefined : String(next)
}

/** Fetch one Fillout form and its submissions into the snapshot. */
export const fetchFilloutForm = (
  context: FetchContext,
  id: string
): Effect.Effect<FetchSummary, ImportFetchError> =>
  Effect.gen(function* () {
    const formId = parseFilloutSource(id)?.formId ?? id
    yield* fetchFormDefinition(context, `/v1/api/forms/${formId}`)
    if (context.domains.includes('forms')) {
      yield* fetchResponsePages(context, {
        request: (cursor) => ({
          path: `/v1/api/forms/${formId}/submissions`,
          query: { limit: String(PAGE_SIZE), offset: cursor ?? '0', sort: 'asc' },
        }),
        next: nextOf,
        files: filesOf,
      })
    }
    return { ids: [formId], apiVersion: 'v1' }
  }).pipe(Effect.withSpan('import.fetch-fillout-form'))
