/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  ALL_LANGUAGES,
  localizeStoredValue,
  requestedRecordLanguage,
} from '@/domain/models/app/languages/localized-value-service'
import { isLanguageMapShape } from '@/domain/models/app/tables/translatable-field-service'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

/**
 * The answer to a records-API write, read as a read is: each translatable
 * field resolved in the active language (`?lang=` → `Accept-Language` →
 * `languages.default`), or as its map of declared languages under `?lang=*`.
 *
 * A write's program hands back the stored map (`transformRecord` with no
 * language), so one record or a `records` list is localized here, the flat
 * alias at a record's root and its `fields` alike. Answers holding neither (a
 * count, an error) are left as they are.
 */

type Read = (value: unknown) => unknown

/** A record of the answer with each translatable field read by `read`. */
const localizeRecord = (
  record: Readonly<Record<string, unknown>>,
  names: readonly string[],
  read: Read
): Readonly<Record<string, unknown>> => {
  const readIn = (holder: Readonly<Record<string, unknown>>) =>
    Object.fromEntries(
      names.filter((name) => Object.hasOwn(holder, name)).map((name) => [name, read(holder[name])])
    )
  const { fields } = record
  return {
    ...record,
    ...readIn(record),
    ...(isLanguageMapShape(fields) ? { fields: { ...fields, ...readIn(fields) } } : {}),
  }
}

/** One record, or a `records` list envelope, with each translatable field read by `read`. */
const localizeAnswerBody = (answer: unknown, names: readonly string[], read: Read): unknown => {
  if (!isLanguageMapShape(answer)) return answer
  const { records } = answer
  if (!Array.isArray(records)) return localizeRecord(answer, names, read)
  return {
    ...answer,
    records: records.map((record: unknown) =>
      isLanguageMapShape(record) ? localizeRecord(record, names, read) : record
    ),
  }
}

/** Replace a successful write's JSON answer with its translatable fields read in the active language. */
export const localizeWriteAnswer = async (
  c: Context,
  app: App,
  names: readonly string[]
): Promise<void> => {
  const { status } = c.res
  if (status !== 200 && status !== 201) return
  if (!(c.res.headers.get('content-type') ?? '').includes('application/json')) return
  const answer: unknown = await c.res.clone().json()
  const language =
    requestedRecordLanguage(app.languages, c.req.query('lang'), c.req.header('Accept-Language')) ??
    ALL_LANGUAGES
  const read: Read = (value) => localizeStoredValue(value, language, app.languages) ?? null
  const headers = new Headers(c.res.headers)
  headers.delete('content-length')
  const body = JSON.stringify(localizeAnswerBody(answer, names, read))
  // Cleared first: assigning over a set response copies its old headers back.
  // eslint-disable-next-line no-param-reassign -- Hono's middleware contract replaces the response by assignment
  c.res = undefined
  // eslint-disable-next-line no-param-reassign -- as above
  c.res = new Response(body, { status, headers })
}
