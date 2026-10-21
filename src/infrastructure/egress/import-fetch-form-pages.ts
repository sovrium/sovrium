/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What the form-builder fetchers share: the form definition, read once into
 * `raw/form.json`, and the responses, page by page into
 * `raw/responses/page-NNNN.json`, each page persisted with its cursor before
 * the next is asked for, and each page's files downloaded while it is fresh.
 *
 * A vendor fetcher states only its own API: the request for a page given the
 * cursor, the cursor the page hands on (none when it was the last), and the
 * files the page names. Every request is a `GET`.
 */

import { Effect } from 'effect'
import {
  FORM_DEFINITION_PATH,
  responsePagePath,
} from '@/domain/models/import/form-snapshot-service'
import { fetchSourceJson, type ImportFetchError } from './import-fetch-client'
import { fetchAttachment, heldOrFetched, type FetchContext } from './import-fetch-sink'

/** One file a response page names. */
export interface FormFile {
  readonly source: string
  readonly url: string
  readonly filename: string
}

/** How one vendor pages its responses. */
export interface ResponsePaging {
  /** The path and query of the page after `cursor` (`undefined` for the first). */
  readonly request: (cursor: string | undefined) => {
    readonly path: string
    readonly query: Readonly<Record<string, string>>
  }
  /** The cursor of the next page, or `undefined` when this page was the last. */
  readonly next: (page: unknown, cursor: string | undefined) => string | undefined
  /** The files a page's answers name. */
  readonly files: (page: unknown) => readonly FormFile[]
  /** Whether the files need the vendor's token (Typeform's do). */
  readonly authenticatedFiles?: boolean
}

const RESOURCE = 'responses'

/** The form definition: re-read from the snapshot on a resumed run, fetched otherwise. */
export const fetchFormDefinition = (
  context: FetchContext,
  path: string,
  query: Readonly<Record<string, string>> = {}
): Effect.Effect<unknown, ImportFetchError> =>
  heldOrFetched(context, FORM_DEFINITION_PATH, path, query)

/** Every response page, from where a previous run stopped. */
export const fetchResponsePages = (
  context: FetchContext,
  paging: ResponsePaging
): Effect.Effect<void, ImportFetchError> => {
  const previous = context.sink.cursorOf(RESOURCE)
  if (previous?.complete === true) return Effect.void
  const step = (
    pages: number,
    cursor: string | undefined
  ): Effect.Effect<void, ImportFetchError> => {
    const request = paging.request(cursor)
    return fetchSourceJson(context.target, context.base, { method: 'GET', ...request }).pipe(
      Effect.tap((response) => context.sink.writeRaw(responsePagePath(pages + 1), response.bytes)),
      Effect.tap((response) =>
        Effect.forEach(
          paging.files(response.json),
          (file) => fetchAttachment(context, file, paging.authenticatedFiles === true),
          { discard: true }
        )
      ),
      Effect.flatMap((response) => {
        const next = paging.next(response.json, cursor)
        return context.sink
          .saveCursor({
            resource: RESOURCE,
            pages: pages + 1,
            complete: next === undefined,
            ...(next === undefined ? {} : { cursor: next }),
          })
          .pipe(Effect.flatMap(() => (next === undefined ? Effect.void : step(pages + 1, next))))
      })
    )
  }
  // The resource is marked open before its first request, so a run stopped on
  // the first page leaves a snapshot the conversion refuses as incomplete.
  const opened =
    previous === undefined
      ? context.sink.saveCursor({ resource: RESOURCE, pages: 0, complete: false })
      : Effect.void
  return opened.pipe(Effect.flatMap(() => step(previous?.pages ?? 0, previous?.cursor)))
}
