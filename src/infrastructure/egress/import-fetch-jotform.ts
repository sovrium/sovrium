/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The Jotform fetcher: one form, its questions, its properties and its
 * submissions, read through Jotform's REST API (pinned under
 * `[internal ref]`).
 *
 * - `GET /form/{id}` (`raw/form.json`), `/form/{id}/questions`
 *   (`raw/questions.json`) and `/form/{id}/properties` (`raw/properties.json`,
 *   where the conditions live).
 * - `GET /form/{id}/submissions?offset=N&limit=1000`: the submissions, until a
 *   page holds fewer than the limit it was served with
 *   (`raw/responses/page-NNNN.json`).
 * - The key travels in the `APIKEY` header.
 *
 * An account's data lives on one host: `api`, `eu-api` or `hipaa-api`
 * `.jotform.com`, named `jotform:eu/<formId>` or `jotform:hipaa/<formId>`. An
 * EU account asked on the US host answers HTTP 200 with `responseCode: 301`
 * and the EU host in `location`: the form is read again from that host, and
 * only from a Jotform host, since the key goes with the request.
 *
 * Jotform's quota is DAILY (1,000 calls on the free plan), reset at midnight
 * Eastern time; a `429` stops the fetch with a message saying so, and a later
 * run resumes where it stopped. A key with "read access" can still change a
 * form's properties: only `GET` is ever sent.
 */

import { Effect } from 'effect'
import { arrayOf, isRecord } from '@/domain/kernel/config-parsing/plain-object'
import { FORM_DEFINITION_PATH } from '@/domain/models/import/form-snapshot-service'
import {
  JOTFORM_PROPERTIES_PATH,
  JOTFORM_QUESTIONS_PATH,
} from '@/domain/models/import/jotform-adapter-service'
import { ImportFetchError, fetchSourceJson, type ImportFetchTarget } from './import-fetch-client'
import { fetchResponsePages } from './import-fetch-form-pages'
import type { FetchContext, FetchSummary } from './import-fetch-sink'

/** The hosts a Jotform account's data lives on, by the prefix that names them. */
const HOSTS: Readonly<Record<string, string>> = {
  '': 'api.jotform.com',
  eu: 'eu-api.jotform.com',
  hipaa: 'hipaa-api.jotform.com',
}

const FORM_ID = /^\d+$/

/** The host and form a `jotform:[eu/|hipaa/]<formId>` source names, or `undefined`. */
export const parseJotformSource = (
  id: string
): { readonly host: string; readonly formId: string } | undefined => {
  const slash = id.indexOf('/')
  const region = slash < 0 ? '' : id.slice(0, slash)
  const formId = id.slice(slash + 1)
  const host = HOSTS[region]
  return host !== undefined && FORM_ID.test(formId) ? { host, formId } : undefined
}

/** Why a `jotform:` source is not one the fetcher reads, or `undefined`. */
export const refuseJotformSource = (id: string): string | undefined =>
  parseJotformSource(id) === undefined
    ? `"jotform:${id}" does not name a Jotform form. Write it jotform:<formId> (the number in the form's link), or jotform:eu/<formId> or jotform:hipaa/<formId> for an account on Jotform's EU or HIPAA servers.`
    : undefined

/** The message a spent daily quota stops the fetch with. */
export const JOTFORM_QUOTA_SPENT =
  "Jotform's daily API limit is used up (it resets at midnight US Eastern time). Run the same fetch again after the reset: it resumes where it stopped."

const targetOn = (token: string, host: string): ImportFetchTarget => ({
  tool: 'jotform',
  realBaseUrl: `https://${host}`,
  headers: { APIKEY: token },
  lockoutSeconds: 60,
  quotaExhausted: JOTFORM_QUOTA_SPENT,
})

/** How Jotform is reached, given the operator's key and the source. */
export const jotformTarget = (token: string, id: string): ImportFetchTarget =>
  targetOn(token, parseJotformSource(id)?.host ?? HOSTS[''] ?? 'api.jotform.com')

/** The Jotform host a `responseCode: 301` sends to, or `undefined` when it names none. */
export const movedToHost = (json: unknown): string | undefined => {
  if (!isRecord(json) || Number(json['responseCode']) !== 301) return undefined
  const location = typeof json['location'] === 'string' ? json['location'] : ''
  const host = URL.canParse(location) ? new URL(location).hostname : ''
  return Object.values(HOSTS).includes(host) ? host : undefined
}

/** A Jotform answer whose envelope reports a failure, as the error it is. */
const envelopeError = (path: string, json: unknown): ImportFetchError | undefined => {
  const code = isRecord(json) ? Number(json['responseCode']) : Number.NaN
  return Number.isFinite(code) && code !== 200
    ? new ImportFetchError({
        message: `${path} answered responseCode ${String(code)}`,
        resumable: false,
      })
    : undefined
}

/** One envelope GET, failing on a non-200 `responseCode`. */
const getEnvelope = (context: FetchContext, path: string, query: Record<string, string> = {}) =>
  fetchSourceJson(context.target, context.base, { method: 'GET', path, query }).pipe(
    Effect.flatMap((response) => {
      const error = envelopeError(path, response.json)
      return error === undefined ? Effect.succeed(response) : Effect.fail(error)
    })
  )

/**
 * The context on the account's own host: the US host's `301` names the EU
 * one. Behind the loopback override the base stays the override.
 */
const onAccountHost = (context: FetchContext, formId: string) =>
  fetchSourceJson(context.target, context.base, { method: 'GET', path: `/form/${formId}` }).pipe(
    Effect.map((response) => {
      const host = movedToHost(response.json)
      if (host === undefined) return { context, first: response }
      const token = context.target.headers['APIKEY'] ?? ''
      return {
        context: {
          ...context,
          target: targetOn(token, host),
          base: context.overrideOrigin === undefined ? `https://${host}` : context.base,
        },
        first: undefined,
      }
    })
  )

/** A `raw/` file: kept from a previous run, fetched otherwise. */
const fetchOnce = (context: FetchContext, path: string, snapshotPath: string) =>
  context.sink
    .readRaw(snapshotPath)
    .pipe(
      Effect.flatMap((held) =>
        held === undefined
          ? getEnvelope(context, path).pipe(
              Effect.flatMap((response) => context.sink.writeRaw(snapshotPath, response.bytes))
            )
          : Effect.void
      )
    )

/** Submissions per page: the API's maximum. */
const PAGE_SIZE = 1000

const FILE_TYPES: ReadonlySet<string> = new Set(['control_fileupload', 'control_signature'])

const submissionsOf = (page: unknown): readonly unknown[] =>
  arrayOf(isRecord(page) ? page['content'] : undefined)

/** Every uploaded file or signature of a submissions page. */
const filesOf = (page: unknown) =>
  submissionsOf(page).flatMap((submission) =>
    Object.values(
      isRecord(submission) && isRecord(submission['answers']) ? submission['answers'] : {}
    ).flatMap((answer) => {
      if (!isRecord(answer) || !FILE_TYPES.has(String(answer['type']))) return []
      const value = answer['answer']
      return (Array.isArray(value) ? value : [value]).flatMap((url) =>
        typeof url === 'string' && /^https?:\/\//.test(url)
          ? [{ source: url, url, filename: new URL(url).pathname.split('/').at(-1) || 'file' }]
          : []
      )
    })
  )

/** The offset of the next page, or none once a page came back short. */
const nextOf = (page: unknown, cursor: string | undefined): string | undefined => {
  const served = submissionsOf(page).length
  const resultSet = isRecord(page) && isRecord(page['resultSet']) ? page['resultSet'] : {}
  const limit = Number(resultSet['limit'] ?? PAGE_SIZE)
  if (served === 0 || served < (Number.isFinite(limit) && limit > 0 ? limit : PAGE_SIZE)) {
    return undefined
  }
  return String(Number(cursor ?? '0') + served)
}

/** Fetch one Jotform form, its questions, properties and submissions into the snapshot. */
export const fetchJotformForm = (
  context: FetchContext,
  id: string
): Effect.Effect<FetchSummary, ImportFetchError> =>
  Effect.gen(function* () {
    const formId = parseJotformSource(id)?.formId ?? id
    const located = yield* onAccountHost(context, formId)
    const here = located.context
    const form = located.first ?? (yield* getEnvelope(here, `/form/${formId}`))
    const failed = envelopeError(`/form/${formId}`, form.json)
    if (failed !== undefined) return yield* failed
    yield* here.sink.writeRaw(FORM_DEFINITION_PATH, form.bytes)
    yield* fetchOnce(here, `/form/${formId}/questions`, JOTFORM_QUESTIONS_PATH)
    yield* fetchOnce(here, `/form/${formId}/properties`, JOTFORM_PROPERTIES_PATH)
    if (here.domains.includes('forms')) {
      yield* fetchResponsePages(here, {
        request: (cursor) => ({
          path: `/form/${formId}/submissions`,
          query: { offset: cursor ?? '0', limit: String(PAGE_SIZE) },
        }),
        next: nextOf,
        files: filesOf,
      })
    }
    return { ids: [formId], apiVersion: 'v1' }
  }).pipe(Effect.withSpan('import.fetch-jotform-form'))
