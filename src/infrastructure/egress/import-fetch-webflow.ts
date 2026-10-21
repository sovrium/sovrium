/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The Webflow CMS fetcher: every collection of one site, read through the
 * Data API v2 (pinned under `[internal ref]`).
 *
 * - `GET /v2/sites/{siteId}/collections` — the collections, without their
 *   fields (`raw/collections.json`).
 * - `GET /v2/collections/{id}` — one collection's fields, types and options
 *   (`raw/collections/<id>/schema.json`).
 * - `GET /v2/collections/{id}/items` page by page at `limit=100` (the API's
 *   maximum), `offset` as the cursor, until `offset + limit` reaches the
 *   `total` the page states (`raw/collections/<id>/items-0001.json`, …). The
 *   STAGED list is read, so drafts and archived items come too, in the site's
 *   primary locale.
 * - Every Image, MultiImage and File value is downloaded while its page is
 *   fresh. Webflow's asset links outlive the request, but not the site: a site
 *   deleted after the migration would take them with it.
 *
 * - With the automations or forms domain, the site's form webhooks, its forms
 *   and their submissions (`import-fetch-webflow-forms.ts`).
 *
 * Only `GET` is sent. Webflow allows 60 requests a minute on its cheapest site
 * plans (120 on the others), so the fetcher paces itself at one a second, and a
 * `429` is waited out for its `Retry-After`. Webflow pages are not read here: a
 * page is migrated from the site-export ZIP.
 */

import { Effect } from 'effect'
import { arrayOf, isRecord } from '@/domain/kernel/config-parsing/plain-object'
import { fetchSourceJson, type ImportFetchError } from './import-fetch-client'
import {
  heldOrFetched,
  fetchAttachment,
  type FetchContext,
  type FetchSummary,
} from './import-fetch-sink'
import { fetchWebflowForms } from './import-fetch-webflow-forms'

/** The contract folder of the site's webhooks and forms; the CMS has its own. */
const FORMS_TOOL = 'webflow'

/**
 * The context the webhooks and forms are read through: the same token and
 * pace, under the `webflow` contract instead of the CMS one when the loopback
 * override is in use.
 */
const formsContextOf = (context: FetchContext): FetchContext => {
  const suffix = `/${context.target.tool}`
  const overridden = context.base !== context.target.realBaseUrl && context.base.endsWith(suffix)
  return {
    ...context,
    target: { ...context.target, tool: FORMS_TOOL },
    base: overridden ? `${context.base.slice(0, -suffix.length)}/${FORMS_TOOL}` : context.base,
  }
}

/** Whether the run reads the CMS: its tables, or their records. */
const readsCms = (context: FetchContext): boolean =>
  context.domains.includes('tables') || context.domains.includes('data')

/** How Webflow is reached, given the operator's site token. */
export const webflowTarget = (token: string) => ({
  // The CMS contract's own folder: `webflow` holds the site-export (pages) contract.
  tool: 'webflow-cms',
  realBaseUrl: 'https://api.webflow.com',
  headers: { authorization: `Bearer ${token}` },
  lockoutSeconds: 60,
  minIntervalMs: 1000,
})

/** Why what follows `webflow:` is not a site id, or `undefined`. */
export const refuseWebflowSource = (id: string): string | undefined =>
  /^[A-Za-z0-9]{6,64}$/.test(id)
    ? undefined
    : `"webflow:${id}" does not name a Webflow site. Write it webflow:<siteId>, the id shown in the site's settings.`

/** Items per page: the API's maximum. */
const PAGE_SIZE = 100

/** The field types whose values are files the site hosts. */
const FILE_TYPES: ReadonlySet<string> = new Set(['Image', 'MultiImage', 'File'])

/** The slugs of a collection's file fields, from its schema. */
const fileSlugsOf = (schema: unknown): readonly string[] =>
  arrayOf(isRecord(schema) ? schema['fields'] : undefined).flatMap((field) =>
    isRecord(field) && FILE_TYPES.has(String(field['type'])) && typeof field['slug'] === 'string'
      ? [field['slug']]
      : []
  )

/** The file name a hosted asset URL ends with. */
const filenameOf = (url: string): string => {
  const last = new URL(url).pathname.split('/').at(-1) ?? ''
  return decodeURIComponent(last) || 'file'
}

/** Every file of a page of items: `{ fileId, url }` values of the file fields. */
const attachmentsOf = (page: unknown, slugs: readonly string[]) =>
  arrayOf(isRecord(page) ? page['items'] : undefined).flatMap((item) => {
    const data = isRecord(item) && isRecord(item['fieldData']) ? item['fieldData'] : {}
    return slugs
      .flatMap((slug) => (Array.isArray(data[slug]) ? data[slug] : [data[slug]]))
      .flatMap((file: unknown) =>
        isRecord(file) && typeof file['url'] === 'string' && URL.canParse(file['url'])
          ? [
              {
                source: String(file['fileId'] ?? file['url']),
                url: file['url'],
                filename: filenameOf(file['url']),
              },
            ]
          : []
      )
  })

const pageName = (page: number): string => `items-${String(page).padStart(4, '0')}.json`

/** Whether the page served reaches the total the API states. */
const isLastPage = (page: unknown, offset: number): boolean => {
  const items = arrayOf(isRecord(page) ? page['items'] : undefined).length
  const pagination = isRecord(page) && isRecord(page['pagination']) ? page['pagination'] : {}
  const total = Number(pagination['total'])
  return items === 0 || (Number.isFinite(total) ? offset + items >= total : items < PAGE_SIZE)
}

/** Every items page of one collection, from where a previous run stopped. */
const fetchItems = (
  context: FetchContext,
  collectionId: string,
  slugs: readonly string[]
): Effect.Effect<void, ImportFetchError> => {
  const resource = `collections/${collectionId}/items`
  const previous = context.sink.cursorOf(resource)
  if (previous?.complete === true) return Effect.void
  const step = (pages: number, offset: number): Effect.Effect<void, ImportFetchError> =>
    fetchSourceJson(context.target, context.base, {
      method: 'GET',
      path: `/v2/collections/${collectionId}/items`,
      query: { offset: String(offset), limit: String(PAGE_SIZE) },
    }).pipe(
      Effect.tap((response) =>
        context.sink.writeRaw(
          `raw/collections/${collectionId}/${pageName(pages + 1)}`,
          response.bytes
        )
      ),
      Effect.tap((response) =>
        Effect.forEach(
          attachmentsOf(response.json, slugs),
          (attachment) => fetchAttachment(context, attachment),
          { discard: true }
        )
      ),
      Effect.flatMap((response) => {
        const served = arrayOf(isRecord(response.json) ? response.json['items'] : undefined).length
        const complete = isLastPage(response.json, offset)
        const next = offset + served
        return context.sink
          .saveCursor({
            resource,
            pages: pages + 1,
            complete,
            ...(complete ? {} : { cursor: String(next) }),
          })
          .pipe(Effect.flatMap(() => (complete ? Effect.void : step(pages + 1, next))))
      })
    )
  return step(previous?.pages ?? 0, Number(previous?.cursor ?? 0))
}

/** Every CMS collection of the site: its schema, and its items when the data is read. */
const fetchCollections = (
  context: FetchContext,
  siteId: string
): Effect.Effect<readonly string[], ImportFetchError> =>
  Effect.gen(function* () {
    const listing = yield* heldOrFetched(
      context,
      'raw/collections.json',
      `/v2/sites/${siteId}/collections`
    )
    const ids = arrayOf(isRecord(listing) ? listing['collections'] : undefined).flatMap(
      (collection) =>
        isRecord(collection) && typeof collection['id'] === 'string' ? [collection['id']] : []
    )
    yield* Effect.forEach(
      ids,
      (id) =>
        heldOrFetched(context, `raw/collections/${id}/schema.json`, `/v2/collections/${id}`).pipe(
          Effect.flatMap((schema) =>
            context.domains.includes('data')
              ? fetchItems(context, id, fileSlugsOf(schema))
              : Effect.void
          )
        ),
      { discard: true }
    )
    return ids
  })

/**
 * Fetch one Webflow site into the snapshot: its CMS collections for the
 * tables and data, its form webhooks and forms for the automations.
 */
export const fetchWebflowSite = (
  context: FetchContext,
  siteId: string
): Effect.Effect<FetchSummary, ImportFetchError> =>
  Effect.gen(function* () {
    const ids = readsCms(context) ? yield* fetchCollections(context, siteId) : []
    if (context.domains.includes('automations') || context.domains.includes('forms')) {
      yield* fetchWebflowForms(formsContextOf(context), siteId)
    }
    return { ids: [siteId, ...ids], apiVersion: 'v2' }
  }).pipe(Effect.withSpan('import.fetch-webflow-site'))
