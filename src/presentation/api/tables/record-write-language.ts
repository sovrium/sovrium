/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  batchCreateRecordsRequestSchema,
  batchUpdateRecordsRequestSchema,
  createRecordRequestSchema,
  importRecordsRequestSchema,
  updateRecordRequestSchema,
  upsertRecordsRequestSchema,
} from '@/domain/models/api/tables/records'
import {
  ALL_LANGUAGES,
  requestedRecordLanguage,
} from '@/domain/models/app/languages/localized-value-service'
import {
  isLanguageMapShape,
  recordLanguageOrder,
} from '@/domain/models/app/tables/translatable-field-service'
import {
  foldLanguageColumns,
  leavesDefaultLanguageEmpty,
  toLanguageMerge,
  translatableFieldNamesOf,
  translatableWriteProblem,
} from '@/domain/models/app/tables/translatable-write-service'
import { getTableContext } from '@/presentation/api/runtime/context-helpers'
import { validateRequest } from '@/presentation/api/runtime/validate-request'
import { localizeWriteAnswer } from './record-write-answer-language'
import type { App } from '@/domain/models/app'
import type { Context, Next } from 'hono'

/**
 * The language a records-API write fills.
 *
 * Every write road of the records API — create, update, batch create and
 * update, upsert and import — sends its field values through here first, so
 * each one treats a translatable field alike:
 *
 *  - a plain string is the value of the writer's ACTIVE language — `?lang=`,
 *    else the first declared language `Accept-Language` names, else
 *    `languages.default`, the rule a read follows — except in an import, where
 *    a `name` column is the default language's and `name.fr` is French;
 *  - an object names each language it changes; `null` or `''` removes one;
 *  - a language the app does not declare (or no longer declares), and a value
 *    that is not text, is refused `400`, naming the field, before anything is
 *    written;
 *  - on a `required` field a create must name the default language, and no
 *    write may remove it.
 *
 * Each value leaves as the languages it changes (`{ fr: 'Chemise', de: null }`),
 * which the write merges into the stored map (`translatable-write-service.ts`).
 * The answer is then read back in the active language
 * (`record-write-answer-language.ts`).
 */

type WriteKind = 'create' | 'update' | 'upsert' | 'import'

/** What a records route writes, the request schema it decodes, and whether it holds a list. */
interface WriteRoute {
  readonly kind: WriteKind
  readonly list: boolean
  readonly schema:
    | typeof createRecordRequestSchema
    | typeof updateRecordRequestSchema
    | typeof batchCreateRecordsRequestSchema
    | typeof batchUpdateRecordsRequestSchema
    | typeof upsertRecordsRequestSchema
    | typeof importRecordsRequestSchema
}

/** Each records-API write by `<METHOD> <path after /records>`; `:id` is a record id. */
const WRITE_ROUTES: Readonly<Record<string, WriteRoute>> = {
  'POST ': { kind: 'create', list: false, schema: createRecordRequestSchema },
  'PATCH :id': { kind: 'update', list: false, schema: updateRecordRequestSchema },
  'POST batch': { kind: 'create', list: true, schema: batchCreateRecordsRequestSchema },
  'PATCH batch': { kind: 'update', list: true, schema: batchUpdateRecordsRequestSchema },
  'POST upsert': { kind: 'upsert', list: true, schema: upsertRecordsRequestSchema },
  'POST import': { kind: 'import', list: true, schema: importRecordsRequestSchema },
}

/** The path words after `/records` that name a route rather than a record. */
const ROUTE_WORDS = new Set(['', 'batch', 'upsert', 'import'])

/** The records-API write a method and path name, if any. */
const writeRouteOf = (method: string, path: string): WriteRoute | undefined => {
  const matched = /^\/api\/tables\/[^/]+\/records(?:\/(.*))?$/.exec(path)
  if (matched === null) return undefined
  const tail = matched[1] ?? ''
  const word = ROUTE_WORDS.has(tail) || tail.includes('/') ? tail : ':id'
  return WRITE_ROUTES[`${method} ${word}`]
}

/** Everything a field map is rewritten with. */
interface WriteContext {
  readonly kind: WriteKind
  readonly names: readonly string[]
  readonly required: ReadonlySet<string>
  readonly declared: readonly string[]
  readonly defaultLanguage: string
  /** The language a plain string fills. */
  readonly language: string
}

/** A field the write is refused for, and why. */
interface Refusal {
  readonly field: string
  readonly message: string
}

type FieldMap = Readonly<Record<string, unknown>>

/** One translatable value as the languages it changes, or why it is refused. */
const patchOf = (
  name: string,
  value: unknown,
  ctx: WriteContext
): { readonly patch: unknown } | { readonly refusal: Refusal } => {
  const problem = translatableWriteProblem(value, ctx.declared)
  if (problem !== undefined) return { refusal: { field: name, message: `'${name}' ${problem}` } }
  const merge = toLanguageMerge(value, ctx.language)
  const write = ctx.kind === 'create' || ctx.kind === 'import' ? 'create' : 'update'
  if (ctx.required.has(name) && leavesDefaultLanguageEmpty(merge, ctx.defaultLanguage, write)) {
    const message = `'${name}' is required in the default language (${ctx.defaultLanguage})`
    return { refusal: { field: name, message } }
  }
  // As JSON: each language it sets, and `null` for each it removes.
  const removed = Object.fromEntries((merge?.remove ?? []).map((code) => [code, null]))
  return { patch: merge === undefined ? null : { ...merge.set, ...removed } }
}

/** A field map with each translatable value rewritten as its patch, or the first refusal. */
const rewriteFields = (
  fields: FieldMap,
  ctx: WriteContext
): { readonly fields: FieldMap } | { readonly refusal: Refusal } => {
  const folded =
    ctx.kind === 'import' ? foldLanguageColumns(fields, ctx.names, ctx.defaultLanguage) : fields
  const present = ctx.names.filter((name) => Object.hasOwn(folded, name))
  const outcomes = present.map((name) => [name, patchOf(name, folded[name], ctx)] as const)
  const refused = outcomes.flatMap(([, outcome]) => ('refusal' in outcome ? [outcome] : []))[0]
  if (refused !== undefined) return refused
  const patches = outcomes.map(([name, outcome]) => [name, 'patch' in outcome && outcome.patch])
  return { fields: { ...folded, ...Object.fromEntries(patches) } }
}

/** The decoded body with every field map rewritten, or the first refusal. */
const rewriteBody = (
  body: FieldMap,
  route: WriteRoute,
  ctx: WriteContext
): { readonly body: FieldMap } | { readonly refusal: Refusal } => {
  const fieldsOf = (holder: unknown): FieldMap | undefined =>
    isLanguageMapShape(holder) && isLanguageMapShape(holder['fields'])
      ? holder['fields']
      : undefined
  if (!route.list) {
    const outcome = rewriteFields(fieldsOf(body) ?? {}, ctx)
    return 'refusal' in outcome ? outcome : { body: { ...body, fields: outcome.fields } }
  }
  const records = Array.isArray(body['records']) ? (body['records'] as readonly unknown[]) : []
  const outcomes = records.map((record) => {
    const fields = fieldsOf(record)
    return { record, outcome: fields === undefined ? undefined : rewriteFields(fields, ctx) }
  })
  const refused = outcomes.flatMap(({ outcome }) =>
    outcome !== undefined && 'refusal' in outcome ? [outcome] : []
  )[0]
  if (refused !== undefined) return refused
  const rewritten = outcomes.map(({ record, outcome }) =>
    outcome === undefined || 'refusal' in outcome
      ? record
      : { ...(record as object), fields: outcome.fields }
  )
  return { body: { ...body, records: rewritten } }
}

/** A refused write: `400`, naming the field. */
const refusalResponse = (c: Context, refusal: Refusal): Response =>
  c.json(
    {
      success: false,
      message: `Cannot write field ${refusal.message}`,
      code: 'VALIDATION_ERROR',
      errors: [{ field: refusal.field, message: refusal.message }],
    },
    400
  )

/** The context a write on its table is rewritten with; `undefined` when it holds no translatable field. */
const writeContextOf = (c: Context, app: App, kind: WriteKind): WriteContext | undefined => {
  const { tableName } = getTableContext(c)
  const names = translatableFieldNamesOf(app, tableName)
  if (names.length === 0 || app.languages === undefined) return undefined
  const declared = recordLanguageOrder(app.languages)
  const [defaultLanguage = ''] = declared
  const active = requestedRecordLanguage(
    app.languages,
    c.req.query('lang'),
    c.req.header('Accept-Language')
  )
  const fields = app.tables?.find((table) => table.name === tableName)?.fields ?? []
  const writesActive = kind !== 'import' && active !== undefined && active !== ALL_LANGUAGES
  return {
    kind,
    names,
    required: new Set(fields.filter((f) => f.required === true).map((f) => f.name)),
    declared,
    defaultLanguage,
    language: writesActive ? active : defaultLanguage,
  }
}

/**
 * Middleware on the records routes: file each translatable value under its
 * language before the route reads the body, and read the answer back in the
 * active language. Any other request — and a body the route's own schema
 * refuses, which the route answers itself — passes through untouched.
 */
export const writesRecordLanguage =
  (resolveApp: () => App) =>
  async (c: Context, next: Next): Promise<Response | void> => {
    const route = writeRouteOf(c.req.method, c.req.path)
    if (route === undefined) return next()
    const app = resolveApp()
    const ctx = writeContextOf(c, app, route.kind)
    if (ctx === undefined) return next()
    const decoded = await validateRequest(c, route.schema)
    if (!decoded.success || !isLanguageMapShape(decoded.data)) return next()
    const outcome = rewriteBody(decoded.data, route, ctx)
    if ('refusal' in outcome) return refusalResponse(c, outcome.refusal)
    // The route, and every validator before it, reads the body as rewritten.
    // Hono keeps each body read as its PROMISE, though the type names the value.
    const rewritten: unknown = Promise.resolve(JSON.stringify(outcome.body))
    // eslint-disable-next-line no-param-reassign -- Hono reads a body through this cache
    c.req.bodyCache = { text: rewritten as string }
    await next()
    await localizeWriteAnswer(c, app, ctx.names)
  }
