/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The schema-reading half of the OpenAPI normaliser (`library-openapi.ts`):
 * following local references, reducing a JSON Schema to the facts a
 * connection operation parameter carries (a type, allowed values, a format),
 * reading a request body into named parameters, and detecting pagination.
 *
 * Split from the walk because the two halves change for different reasons —
 * this one when a vendor uses a JSON Schema construct not seen before, the walk
 * when the operation SHAPE changes — and together they exceed the scripts line
 * ceiling. Nothing here reads a `description`: see the module comment of
 * `library-openapi.ts` for why that is the whole point.
 */

// =============================================================================
// Output shapes — mirror `src/domain/models/app/connections/operations.ts`
// =============================================================================

export type ParamLocation = 'path' | 'query' | 'header' | 'body'
export type ParamType = 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object'
export type ScalarType = 'string' | 'number' | 'integer' | 'boolean'
export type ParamFormat = 'date' | 'date-time' | 'email' | 'uri' | 'uuid'
export type EnumValue = string | number
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
export type BodyEncoding = 'json' | 'form' | 'multipart'

export interface GeneratedParam {
  readonly in: ParamLocation
  readonly type: ParamType
  readonly required?: boolean
  readonly enum?: readonly EnumValue[]
  readonly items?: { readonly type?: ScalarType; readonly enum?: readonly EnumValue[] }
  readonly format?: ParamFormat
}

export type GeneratedPagination =
  | {
      readonly style: 'page'
      readonly pageParam: string
      readonly startPage?: number
      readonly itemsPath: string
      readonly nextPath?: string
    }
  | {
      readonly style: 'offset'
      readonly offsetParam: string
      readonly limitParam: string
      readonly limit: number
      readonly itemsPath: string
    }
  | {
      readonly style: 'cursor'
      readonly cursorParam: string
      readonly cursorPath: string
      readonly itemsPath: string
    }
  | { readonly style: 'link'; readonly itemsPath?: string }
  | {
      readonly style: 'lastItem'
      readonly afterParam: string
      readonly idField?: string
      readonly hasMorePath?: string
      readonly itemsPath: string
    }

export interface GeneratedOperation {
  readonly name: string
  readonly method: HttpMethod
  readonly path: string
  readonly summary?: string
  readonly params?: Readonly<Record<string, GeneratedParam>>
  readonly body?: BodyEncoding
  readonly pagination?: GeneratedPagination
}

export type SkipReason =
  | 'deprecated'
  | 'unsupported-method'
  | 'unsupported-body'
  | 'non-object-body'
  | 'param-collision'
  | 'excluded'
  | 'not-included'

export interface SkippedOperation {
  readonly key: string
  readonly reason: SkipReason
}

// =============================================================================
// Small helpers
// =============================================================================

export type Node = Readonly<Record<string, unknown>>

export const isNode = (value: unknown): value is Node =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const asNode = (value: unknown): Node => (isNode(value) ? value : {})

export const asArray = (value: unknown): readonly unknown[] => (Array.isArray(value) ? value : [])

export const asString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined

// =============================================================================
// References
// =============================================================================

const decodePointer = (segment: string): string =>
  decodeURIComponent(segment).replace(/~1/g, '/').replace(/~0/g, '~')

/** Follow a local `$ref` chain to its target; throw on an external one. */
export const resolve = (doc: Node, node: unknown, seen: ReadonlySet<string> = new Set()): Node => {
  const current = asNode(node)
  const ref = asString(current['$ref'])
  if (ref === undefined) return current
  if (!ref.startsWith('#/')) {
    throw new Error(`external $ref \`${ref}\` — only local references are read`)
  }
  if (seen.has(ref)) return {}
  const target = ref
    .slice(2)
    .split('/')
    .map(decodePointer)
    .reduce<unknown>((at, segment) => asNode(at)[segment], doc)
  return resolve(doc, target, new Set([...seen, ref]))
}

// =============================================================================
// Schemas → parameter facts
// =============================================================================

const SCALAR_TYPES: ReadonlySet<string> = new Set(['string', 'number', 'integer', 'boolean'])
const ALL_TYPES: ReadonlySet<string> = new Set([...SCALAR_TYPES, 'array', 'object'])

/** The declared types of a schema, `null` excluded (3.0 `nullable`, 3.1 arrays). */
const declaredTypes = (schema: Node): readonly string[] => {
  const raw = schema['type']
  const list = Array.isArray(raw) ? raw : raw === undefined ? [] : [raw]
  return list.filter((type): type is string => typeof type === 'string' && type !== 'null')
}

/** The branches of a composition, resolved. */
const branchesOf = (doc: Node, schema: Node, key: 'oneOf' | 'anyOf' | 'allOf'): readonly Node[] =>
  asArray(schema[key])
    .map((branch) => resolve(doc, branch))
    .filter((branch) => !(declaredTypes(branch).length === 0 && branch['type'] === 'null'))

/**
 * One type for a schema. A union of several picks the widest that can carry
 * every branch: an object anywhere makes it `object`, else an array makes it
 * `array`, else a string makes it `string`. Nothing is guessed from a name.
 */
export const typeOf = (doc: Node, node: unknown, fallback: ParamType = 'string'): ParamType => {
  const schema = resolve(doc, node)
  const direct = declaredTypes(schema).map((type) => (type === 'file' ? 'string' : type))
  const branches = [
    ...branchesOf(doc, schema, 'oneOf'),
    ...branchesOf(doc, schema, 'anyOf'),
    ...branchesOf(doc, schema, 'allOf'),
  ].map((branch) => typeOf(doc, branch, 'object'))
  const shapeHint = [
    ...(isNode(schema['properties']) || isNode(schema['additionalProperties']) ? ['object'] : []),
    ...(schema['items'] !== undefined ? ['array'] : []),
  ]
  const enumHint = asArray(schema['enum']).some((value) => typeof value === 'number')
    ? ['number']
    : asArray(schema['enum']).length > 0 || schema['const'] !== undefined
      ? ['string']
      : []
  const candidates = [...direct, ...branches, ...shapeHint, ...enumHint].filter((type) =>
    ALL_TYPES.has(type)
  )
  if (candidates.length === 0) return fallback
  const unique = [...new Set(candidates)]
  if (unique.length === 1) return unique[0] as ParamType
  if (unique.includes('object')) return 'object'
  if (unique.includes('array')) return 'array'
  if (unique.includes('string')) return 'string'
  return unique.includes('number') ? 'number' : (unique[0] as ParamType)
}

/** The allowed values of a schema, from `enum` or a union of `const`s. */
export const enumOf = (doc: Node, node: unknown): readonly EnumValue[] | undefined => {
  const schema = resolve(doc, node)
  const alternatives = [...branchesOf(doc, schema, 'oneOf'), ...branchesOf(doc, schema, 'anyOf')]
  // A union allows a closed set only when EVERY branch does: one free branch
  // (a bare `string`) admits any value, so no enum is published at all.
  const perBranch = alternatives.map((branch) =>
    branch['const'] === undefined ? enumOf(doc, branch) : [branch['const'] as EnumValue]
  )
  const fromBranches =
    alternatives.length > 0 && perBranch.every((values) => values !== undefined)
      ? perBranch.flatMap((values) => values ?? [])
      : []
  const direct = asArray(schema['enum'])
  const own = schema['const'] === undefined ? [] : [schema['const']]
  const values = [...(direct.length > 0 ? direct : [...own, ...fromBranches])].filter(
    (value): value is EnumValue =>
      typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value))
  )
  const unique = [...new Set(values)]
  return unique.length === 0 ? undefined : unique
}

const FORMATS: Readonly<Record<string, ParamFormat>> = {
  date: 'date',
  'date-time': 'date-time',
  email: 'email',
  uri: 'uri',
  url: 'uri',
  uuid: 'uuid',
}

/** One parameter's facts, from its schema. */
/** The alternatives of a union (`oneOf` / `anyOf`), resolved, `null` branches excluded. */
const alternativesOf = (doc: Node, schema: Node): readonly Node[] => [
  ...branchesOf(doc, schema, 'oneOf'),
  ...branchesOf(doc, schema, 'anyOf'),
]

/**
 * The item schema of an array schema. A union of array alternatives yields the
 * `anyOf` of their item schemas, so the items keep the union of their types and
 * allowed values rather than being dropped.
 */
const itemsOf = (doc: Node, schema: Node): Node | undefined => {
  if (schema['items'] !== undefined) return resolve(doc, schema['items'])
  const nested = alternativesOf(doc, schema).flatMap((branch) => {
    const items = itemsOf(doc, branch)
    return items === undefined ? [] : [items]
  })
  if (nested.length === 0) return undefined
  return nested.length === 1 ? nested[0] : { anyOf: nested }
}

/**
 * A string format: the schema's own, or the one every alternative states. A
 * union whose alternatives disagree (or where one states none) has no format.
 */
const formatOf = (doc: Node, schema: Node): string | undefined => {
  const own = asString(schema['format'])
  if (own !== undefined) return own
  const alternatives = alternativesOf(doc, schema)
  if (alternatives.length === 0) return undefined
  const formats = alternatives.map((branch) => formatOf(doc, branch))
  const [first] = formats
  return first !== undefined && formats.every((format) => format === first) ? first : undefined
}

export const paramFacts = (
  doc: Node,
  location: ParamLocation,
  schemaNode: unknown,
  required: boolean
): GeneratedParam => {
  const schema = resolve(doc, schemaNode)
  const type = typeOf(doc, schema, location === 'body' ? 'object' : 'string')
  const allowed = type === 'array' || type === 'object' ? undefined : enumOf(doc, schema)
  const itemsSchema = type === 'array' ? itemsOf(doc, schema) : undefined
  const itemType = itemsSchema === undefined ? undefined : typeOf(doc, itemsSchema, 'object')
  const itemEnum = itemsSchema === undefined ? undefined : enumOf(doc, itemsSchema)
  const items =
    itemsSchema === undefined
      ? undefined
      : {
          ...(itemType !== undefined && SCALAR_TYPES.has(itemType)
            ? { type: itemType as ScalarType }
            : {}),
          ...(itemEnum === undefined ? {} : { enum: itemEnum }),
        }
  const format = type === 'string' ? FORMATS[formatOf(doc, schema) ?? ''] : undefined
  return {
    in: location,
    type,
    ...(required || location === 'path' ? { required: true } : {}),
    ...(allowed === undefined ? {} : { enum: allowed }),
    ...(items === undefined || Object.keys(items).length === 0 ? {} : { items }),
    ...(format === undefined ? {} : { format }),
  }
}

/** The swagger-2 inline schema of a non-body parameter (its type sits on the parameter). */
export const parameterSchema = (param: Node): Node =>
  isNode(param['schema']) ? param['schema'] : param

// =============================================================================
// Bodies
// =============================================================================

export interface ObjectShape {
  readonly properties: Readonly<Record<string, unknown>>
  readonly required: ReadonlySet<string>
}

/**
 * The top-level properties of an object schema. `allOf` merges; `oneOf` and
 * `anyOf` take the union of the branches' properties, and a property is required
 * only if every branch requires it. `undefined` when the schema is not an object.
 */
/** A schema that admits no value: a bare `not`, or `false` in 3.1. */
const isForbidding = (doc: Node, node: unknown): boolean => {
  if (node === false) return true
  const schema = resolve(doc, node)
  return (
    schema['not'] !== undefined &&
    declaredTypes(schema).length === 0 &&
    Object.keys(schema).every((key) => key === 'not' || key === 'description')
  )
}

export const objectShape = (doc: Node, node: unknown): ObjectShape | undefined => {
  const schema = resolve(doc, node)
  const all = branchesOf(doc, schema, 'allOf').map((branch) => objectShape(doc, branch))
  const alternatives = [
    ...branchesOf(doc, schema, 'oneOf'),
    ...branchesOf(doc, schema, 'anyOf'),
  ].map((branch) => objectShape(doc, branch))
  const own = isNode(schema['properties'])
    ? {
        properties: schema['properties'],
        required: new Set(asArray(schema['required']).filter((v) => typeof v === 'string')),
      }
    : undefined
  const isObject =
    own !== undefined ||
    declaredTypes(schema).includes('object') ||
    all.some((shape) => shape !== undefined) ||
    (alternatives.length > 0 && alternatives.every((shape) => shape !== undefined))
  if (!isObject) return undefined
  const present = (shape: ObjectShape | undefined): readonly ObjectShape[] =>
    shape === undefined ? [] : [shape]
  const merged = [own, ...all].flatMap(present)
  const union = alternatives.flatMap(present)
  const unionRequired =
    union.length === 0
      ? new Set<string>()
      : new Set(
          [...(union[0]?.required ?? [])].filter((n) => union.every((s) => s.required.has(n)))
        )
  // A property several alternatives declare becomes the `anyOf` of their
  // declarations, so its type and its allowed values are the UNION of theirs
  // (a discriminated `oneOf` publishes every discriminator value, not the last
  // branch's). One declared by a single alternative is kept as it is.
  const unionNames = [...new Set(union.flatMap((shape) => Object.keys(shape.properties)))]
  const unionProperties = Object.fromEntries(
    unionNames.flatMap((name) => {
      // `{ not: {} }` is how a variant FORBIDS a property its siblings accept
      // (Brevo's SMS body: `content` or `templateId`, never both). It admits
      // no value, so it contributes nothing to the union — counting it would
      // widen the type to "anything", read as `object`.
      const declarations = union.flatMap((shape) =>
        name in shape.properties && !isForbidding(doc, shape.properties[name])
          ? [shape.properties[name]]
          : []
      )
      if (declarations.length === 0) return []
      return [[name, declarations.length === 1 ? declarations[0] : { anyOf: declarations }]]
    })
  )
  return {
    // The object's OWN and `allOf` declarations win over the alternatives':
    // they hold for every value the schema accepts.
    properties: Object.assign(
      {},
      unionProperties,
      ...merged.map((shape) => shape.properties)
    ) as Readonly<Record<string, unknown>>,
    required: new Set([...merged.flatMap((shape) => [...shape.required]), ...unionRequired]),
  }
}

export const isJsonMedia = (media: string): boolean =>
  media === 'application/json' || /^application\/[\w.+-]*\+?json\b/.test(media)

/** The body encoding a media-type map allows, preferring JSON. */
const pickMedia = (
  content: Node
): { readonly encoding: BodyEncoding; readonly schema: unknown } | undefined => {
  const find = (predicate: (media: string) => boolean): string | undefined =>
    Object.keys(content).find((media) => predicate(media.split(';')[0]?.trim() ?? ''))
  const json = find(isJsonMedia)
  if (json !== undefined) return { encoding: 'json', schema: asNode(content[json])['schema'] }
  const form = find((media) => media === 'application/x-www-form-urlencoded')
  if (form !== undefined) return { encoding: 'form', schema: asNode(content[form])['schema'] }
  const multipart = find((media) => media === 'multipart/form-data')
  if (multipart !== undefined)
    return { encoding: 'multipart', schema: asNode(content[multipart])['schema'] }
  return undefined
}

export type BodyOutcome =
  | { readonly kind: 'none' }
  | { readonly kind: 'skip'; readonly reason: SkipReason }
  | {
      readonly kind: 'body'
      readonly encoding: BodyEncoding
      readonly params: readonly (readonly [string, GeneratedParam])[]
    }

const bodyFromShape = (
  doc: Node,
  encoding: BodyEncoding,
  schema: unknown,
  wholeRequired: boolean
): BodyOutcome => {
  const shape = objectShape(doc, schema)
  if (shape === undefined) return { kind: 'skip', reason: 'non-object-body' }
  const params = Object.entries(shape.properties)
    .filter(([, property]) => resolve(doc, property)['readOnly'] !== true)
    .map(
      ([name, property]) =>
        [
          name,
          paramFacts(doc, 'body', property, wholeRequired && shape.required.has(name)),
        ] as const
    )
  return { kind: 'body', encoding, params }
}

/** OpenAPI 3 `requestBody`. */
export const openApiBody = (doc: Node, operation: Node): BodyOutcome => {
  if (operation['requestBody'] === undefined) return { kind: 'none' }
  const requestBody = resolve(doc, operation['requestBody'])
  const content = asNode(requestBody['content'])
  if (Object.keys(content).length === 0) return { kind: 'none' }
  const picked = pickMedia(content)
  if (picked === undefined) return { kind: 'skip', reason: 'unsupported-body' }
  return bodyFromShape(doc, picked.encoding, picked.schema, requestBody['required'] !== false)
}

/** Swagger 2 `in: body` (a schema) and `in: formData` (one parameter per field). */
export const swaggerBody = (doc: Node, operation: Node, params: readonly Node[]): BodyOutcome => {
  const body = params.find((param) => param['in'] === 'body')
  if (body !== undefined) {
    const consumes = asArray(operation['consumes'] ?? doc['consumes']).map(String)
    const jsonOk = consumes.length === 0 || consumes.some(isJsonMedia)
    if (!jsonOk) return { kind: 'skip', reason: 'unsupported-body' }
    return bodyFromShape(doc, 'json', body['schema'], true)
  }
  const fields = params.filter((param) => param['in'] === 'formData')
  if (fields.length === 0) return { kind: 'none' }
  const consumes = asArray(operation['consumes'] ?? doc['consumes']).map(String)
  const multipart =
    consumes.includes('multipart/form-data') || fields.some((field) => field['type'] === 'file')
  return {
    kind: 'body',
    encoding: multipart ? 'multipart' : 'form',
    params: fields.map(
      (field) =>
        [
          String(field['name']),
          paramFacts(doc, 'body', parameterSchema(field), field['required'] === true),
        ] as const
    ),
  }
}

// =============================================================================
// Pagination
// =============================================================================

const CURSOR_PARAMS = ['cursor', 'after', 'page_token', 'pageToken', 'next_cursor', 'nextCursor']
const CURSOR_PATHS = [
  'next_cursor',
  'nextCursor',
  'next_page_token',
  'nextPageToken',
  'paging.next.after',
  'paging.cursors.after',
  'meta.next_cursor',
  'pagination.next_cursor',
  'pagination.nextCursor',
]
/** A query parameter carrying the id of the last item already read. */
const AFTER_PARAMS = ['starting_after']
const HAS_MORE_PATHS = ['has_more', 'hasMore', 'meta.has_more', 'pagination.has_more']
const PAGE_PARAMS = ['page', 'current_page', 'page_number', 'pageNumber']
const PAGE_NEXT_PATHS = ['next_page', 'nextPage', 'meta.next_page', 'pagination.next_page']
const OFFSET_PARAMS = ['offset', 'skip']
const LIMIT_PARAMS = ['limit', 'per_page', 'page_size', 'pageSize', 'count']
const ITEMS_NAMES = ['data', 'items', 'results', 'records', 'list', 'values', 'entries']

/** The JSON schema of the operation's first 2xx response, if it has one. */
const responseSchema = (doc: Node, operation: Node): Node | undefined => {
  const responses = asNode(operation['responses'])
  const code = Object.keys(responses)
    .filter((key) => /^2\d\d$/.test(key))
    .sort()[0]
  if (code === undefined) return undefined
  const response = resolve(doc, responses[code])
  if (response['schema'] !== undefined) return resolve(doc, response['schema'])
  const content = asNode(response['content'])
  const media = Object.keys(content).find((key) => isJsonMedia(key.split(';')[0] ?? ''))
  return media === undefined ? undefined : resolve(doc, asNode(content[media])['schema'])
}

/** Whether a dot path names a property of the (resolved) response shape. */
const hasPath = (doc: Node, schema: Node, path: string): boolean =>
  path.split('.').reduce<Node | undefined>(
    (at, segment) =>
      at === undefined
        ? undefined
        : (() => {
            const shape = objectShape(doc, at)
            const child = shape?.properties[segment]
            return child === undefined ? undefined : resolve(doc, child)
          })(),
    schema
  ) !== undefined

/** The top-level array property holding a page's items. */
const itemsPathOf = (doc: Node, schema: Node): string | undefined => {
  const shape = objectShape(doc, schema)
  if (shape === undefined) return undefined
  const arrays = Object.entries(shape.properties)
    .filter(([, property]) => typeOf(doc, property, 'object') === 'array')
    .map(([name]) => name)
  const preferred = ITEMS_NAMES.find((name) => arrays.includes(name))
  if (preferred !== undefined) return preferred
  return arrays.length === 1 ? arrays[0] : undefined
}

/**
 * Pagination read off the spec, for GET operations only. Four styles, each
 * detected from the pair of facts that makes it callable — a request parameter
 * AND the response property it reads — so a parameter merely NAMED `page` on a
 * response with no items array is not guessed at.
 */
export const detectPagination = (
  doc: Node,
  operation: Node,
  query: ReadonlyMap<string, Node>
): GeneratedPagination | undefined => {
  const schema = responseSchema(doc, operation)
  if (schema === undefined) return undefined
  const itemsPath = itemsPathOf(doc, schema)
  if (itemsPath === undefined) return undefined
  const cursorParam = CURSOR_PARAMS.find((name) => query.has(name))
  const cursorPath = CURSOR_PATHS.find((path) => hasPath(doc, schema, path))
  if (cursorParam !== undefined && cursorPath !== undefined) {
    return { style: 'cursor', cursorParam, cursorPath, itemsPath }
  }
  // The id of the last item read, sent back as `starting_after` — Stripe's
  // lists. Checked before page numbers: such a list takes no page parameter,
  // and the item id is read from each item (`id`, the schema's default).
  const afterParam = AFTER_PARAMS.find((name) => query.has(name))
  if (afterParam !== undefined) {
    const hasMorePath = HAS_MORE_PATHS.find((path) => hasPath(doc, schema, path))
    return {
      style: 'lastItem',
      afterParam,
      ...(hasMorePath === undefined ? {} : { hasMorePath }),
      itemsPath,
    }
  }
  const pageParam = PAGE_PARAMS.find((name) => query.has(name))
  if (pageParam !== undefined) {
    const nextPath = PAGE_NEXT_PATHS.find((path) => hasPath(doc, schema, path))
    // A `page` that is a STRING is an opaque token, not a number: the next
    // page's value is read from the response, which is cursor pagination
    // wearing a page parameter's name (Stripe's search endpoints).
    if (typeOf(doc, parameterSchema(query.get(pageParam) ?? {})) === 'string') {
      return nextPath === undefined
        ? undefined
        : { style: 'cursor', cursorParam: pageParam, cursorPath: nextPath, itemsPath }
    }
    const start = parameterSchema(query.get(pageParam) ?? {})['default']
    return {
      style: 'page',
      pageParam,
      ...(start === 0 ? { startPage: 0 } : {}),
      itemsPath,
      ...(nextPath === undefined ? {} : { nextPath }),
    }
  }
  const offsetParam = OFFSET_PARAMS.find((name) => query.has(name))
  const limitParam = LIMIT_PARAMS.find((name) => query.has(name))
  if (offsetParam !== undefined && limitParam !== undefined) {
    const limitSchema = parameterSchema(query.get(limitParam) ?? {})
    const maximum = typeof limitSchema['maximum'] === 'number' ? limitSchema['maximum'] : 100
    const limit = Math.max(1, Math.min(1000, Math.floor(maximum)))
    return { style: 'offset', offsetParam, limitParam, limit, itemsPath }
  }
  return undefined
}
