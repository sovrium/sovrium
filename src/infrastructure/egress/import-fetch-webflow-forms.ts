/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The forms half of the Webflow fetch: the site's forms, their submissions,
 * and what the site does when one of them is submitted (pinned under `[internal ref]`).
 *
 * - `GET /v2/sites/{siteId}/webhooks` — the site's webhooks, scope
 *   `sites:read` (`raw/webhooks.json`). A `form_submission` webhook, filtered
 *   to one form by name or not, is what the import turns into an automation.
 * - `GET /v2/sites/{siteId}/forms` page by page at `limit=100`, scope
 *   `forms:read` (`raw/forms/page-0001.json`, …): the forms' ids, names and
 *   fields, so a webhook's filter resolves to the form it watches.
 * - With the forms domain, `GET /v2/sites/{siteId}/forms/{formId}/submissions`
 *   page by page for every form (`raw/forms/<formId>/submissions-0001.json`,
 *   …), which become the records of the form's responses table.
 *
 * A token without one of those scopes is not a failed fetch: the CMS half
 * may be all the operator granted. A `401` or `403` on either list is recorded
 * in `raw/sovrium-unread.json`, which the import reports, and the fetch goes
 * on. Only `GET` is sent.
 */

import { Effect } from 'effect'
import { isRecord } from '@/domain/kernel/config-parsing/plain-object'
import { fetchSourceJson, type ImportFetchError } from './import-fetch-client'
import { heldOrFetched, type FetchContext } from './import-fetch-sink'

/** The fetch's own record of the lists the token was refused, beside the API's pages. */
export const WEBFLOW_UNREAD_FILE = 'raw/sovrium-unread.json'

/** Forms per page: the API's maximum. */
const PAGE_SIZE = 100

/** A list the token was refused, and the scope it needs. */
interface Unread {
  readonly resource: string
  readonly status: number
  readonly scope: string
}

const isRefusal = (error: ImportFetchError): boolean => error.status === 401 || error.status === 403

/** Run a list fetch; a refused token gives the refusal instead of a failure. */
const orUnread = (
  fetch: Effect.Effect<void, ImportFetchError>,
  resource: string,
  scope: string
): Effect.Effect<readonly Unread[], ImportFetchError> =>
  fetch.pipe(
    Effect.as<readonly Unread[]>([]),
    Effect.catchIf(isRefusal, (error) =>
      Effect.succeed([{ resource, status: error.status ?? 403, scope }])
    )
  )

/** The site's webhooks, unless a previous run already wrote them. */
const fetchWebhooks = (context: FetchContext, siteId: string) =>
  heldOrFetched(context, 'raw/webhooks.json', `/v2/sites/${siteId}/webhooks`).pipe(Effect.asVoid)

/** One offset-paged list of the Forms API. */
interface PagedList {
  /** The manifest cursor's resource. */
  readonly resource: string
  readonly path: string
  /** The key of the items in a page (`forms`, `formSubmissions`). */
  readonly itemsKey: string
  /** Where page n of the list is written. */
  readonly pagePath: (page: number) => string
}

const pageName = (page: number): string => `page-${String(page).padStart(4, '0')}`

const FORMS_LIST = (siteId: string): PagedList => ({
  resource: 'forms',
  path: `/v2/sites/${siteId}/forms`,
  itemsKey: 'forms',
  pagePath: (page) => `raw/forms/${pageName(page)}.json`,
})

const SUBMISSIONS_LIST = (siteId: string, formId: string): PagedList => ({
  resource: `forms/${formId}/submissions`,
  path: `/v2/sites/${siteId}/forms/${formId}/submissions`,
  itemsKey: 'formSubmissions',
  pagePath: (page) => `raw/forms/${formId}/submissions-${String(page).padStart(4, '0')}.json`,
})

const itemsOf = (page: unknown, key: string): readonly unknown[] =>
  isRecord(page) && Array.isArray(page[key]) ? page[key] : []

/** Whether a page reaches the total the API states. */
const isLastPage = (page: unknown, key: string, offset: number): boolean => {
  const served = itemsOf(page, key).length
  const pagination = isRecord(page) && isRecord(page['pagination']) ? page['pagination'] : {}
  const total = Number(pagination['total'])
  return served === 0 || (Number.isFinite(total) ? offset + served >= total : served < PAGE_SIZE)
}

/** Every page of a list, from where a previous run stopped. */
const fetchPaged = (
  context: FetchContext,
  list: PagedList
): Effect.Effect<void, ImportFetchError> => {
  const previous = context.sink.cursorOf(list.resource)
  if (previous?.complete === true) return Effect.void
  const step = (pages: number, offset: number): Effect.Effect<void, ImportFetchError> =>
    fetchSourceJson(context.target, context.base, {
      method: 'GET',
      path: list.path,
      query: { offset: String(offset), limit: String(PAGE_SIZE) },
    }).pipe(
      Effect.tap((response) => context.sink.writeRaw(list.pagePath(pages + 1), response.bytes)),
      Effect.flatMap((response) => {
        const complete = isLastPage(response.json, list.itemsKey, offset)
        const next = offset + itemsOf(response.json, list.itemsKey).length
        return context.sink
          .saveCursor({
            resource: list.resource,
            pages: pages + 1,
            complete,
            ...(complete ? {} : { cursor: String(next) }),
          })
          .pipe(Effect.flatMap(() => (complete ? Effect.void : step(pages + 1, next))))
      })
    )
  return step(previous?.pages ?? 0, Number(previous?.cursor ?? 0))
}

/** The ids of the forms the list pages hold; an id that is not a plain token is left out. */
const formIdsOf = (
  context: FetchContext,
  siteId: string
): Effect.Effect<readonly string[], ImportFetchError> => {
  const list = FORMS_LIST(siteId)
  const pages = context.sink.cursorOf(list.resource)?.pages ?? 0
  return Effect.forEach(
    Array.from({ length: pages }, (_unused, index) => list.pagePath(index + 1)),
    (path) => context.sink.readRaw(path)
  ).pipe(
    Effect.map((held) =>
      held
        .flatMap((page) => itemsOf(page, list.itemsKey))
        .flatMap((form) =>
          isRecord(form) && typeof form['id'] === 'string' && /^[A-Za-z0-9_-]+$/.test(form['id'])
            ? [form['id']]
            : []
        )
    )
  )
}

/** The forms, and with the forms domain every form's submissions. */
const fetchForms = (context: FetchContext, siteId: string): Effect.Effect<void, ImportFetchError> =>
  fetchPaged(context, FORMS_LIST(siteId)).pipe(
    Effect.flatMap(() =>
      context.domains.includes('forms') ? formIdsOf(context, siteId) : Effect.succeed([])
    ),
    Effect.flatMap((formIds) =>
      Effect.forEach(formIds, (formId) => fetchPaged(context, SUBMISSIONS_LIST(siteId, formId)), {
        discard: true,
      })
    )
  )

/**
 * Fetch the site's form webhooks (automations) and its forms with their
 * submissions (forms) into the snapshot, recording the lists the token may
 * not read.
 */
export const fetchWebflowForms = (
  context: FetchContext,
  siteId: string
): Effect.Effect<void, ImportFetchError> =>
  Effect.gen(function* () {
    const automations = context.domains.includes('automations')
    const webhooks = automations
      ? yield* orUnread(fetchWebhooks(context, siteId), 'webhooks', 'sites:read')
      : []
    const forms = yield* orUnread(fetchForms(context, siteId), 'forms', 'forms:read')
    const unread = [...webhooks, ...forms]
    if (unread.length === 0) return
    yield* context.sink.writeRaw(
      WEBFLOW_UNREAD_FILE,
      new TextEncoder().encode(`${JSON.stringify(unread, undefined, 2)}\n`)
    )
  }).pipe(Effect.withSpan('import.fetch-webflow-forms'))
