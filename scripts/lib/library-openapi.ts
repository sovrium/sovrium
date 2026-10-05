/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * OpenAPI → connection operations: the pure half of the library operations
 * generator.
 *
 * A vendor specification goes in; a list of `ConnectionOperation` values comes
 * out — the exact shape an operator writes under `connections[].operations[]`,
 * so an installed operation is indistinguishable from a hand-written one.
 *
 * ─── FUNCTIONAL FACTS ONLY ─────────────────────────────────────────────────
 *
 * The founder's decision (2026-09-23) is that the library ships what an
 * endpoint IS — method, path, parameter names, types and allowed values, how the
 * body is encoded, how it paginates, and a one-line summary of at most 120
 * characters — and never what a vendor WROTE about it. So every `description`
 * is dropped here, at the one place a spec is read, rather than filtered later:
 * a field this module never copies cannot leak. Examples, defaults, response
 * bodies and security schemes are dropped for the same reason; the vendor's own
 * documentation is linked instead, once per provider.
 *
 * ─── WHAT IT READS ─────────────────────────────────────────────────────────
 *
 * OpenAPI 3.0 and 3.1, and Swagger 2 (`in: body` / `in: formData`). References
 * must be LOCAL (`#/...`): an external `$ref` throws, because following it would
 * make the output depend on a file the pinned source does not contain.
 *
 * ─── WHAT IT REFUSES, AND SAYS SO ──────────────────────────────────────────
 *
 * An operation the connection schema cannot express is SKIPPED with a reason,
 * never approximated: a non-object body (there are no named parameters to map
 * it to), a media type that is neither JSON, a URL-encoded form nor multipart, a
 * method outside GET/POST/PUT/PATCH/DELETE, a deprecated endpoint, and a body
 * property that shares a name with a query or path parameter. The generator
 * prints the skipped count per reason, so coverage is a number rather than an
 * assumption.
 */

import {
  asArray,
  asNode,
  asString,
  detectPagination,
  openApiBody,
  paramFacts,
  parameterSchema,
  resolve,
  swaggerBody,
  type GeneratedOperation,
  type HttpMethod,
  type Node,
  type ParamLocation,
  type SkipReason,
  type SkippedOperation,
  type GeneratedPagination,
} from './library-openapi-schema'

export type {
  GeneratedOperation,
  GeneratedPagination,
  SkippedOperation,
} from './library-openapi-schema'

/** One operation plus the groups it belongs to (tags, or its path's resource). */
export interface NormalisedOperation {
  readonly operation: GeneratedOperation
  readonly groups: readonly string[]
}

/** What the normaliser needs from a provider's overrides — all optional. */
export interface NormaliseOptions {
  /** `METHOD /path` or operationId → the operation name to use instead. */
  readonly rename?: Readonly<Record<string, string>>
  /** Operation names, operationIds or `METHOD /path` keys to drop. */
  readonly exclude?: readonly string[]
  /** Curated subset: keep only operations whose path starts with one of these. */
  readonly includePaths?: readonly string[]
  /** Curated subset: keep only operations carrying one of these tags. */
  readonly includeTags?: readonly string[]
  /** Header parameters dropped from every operation, case-insensitively. */
  readonly dropHeaders?: readonly string[]
  /** Group by path resource even when the spec has tags. */
  readonly groupByPath?: boolean
  /** Per-operation pagination, by generated name: a value replaces, `null` removes. */
  readonly pagination?: Readonly<Record<string, GeneratedPagination | null>>
  /**
   * A regular expression removed from every operationId before it is
   * kebab-cased — for generators that append the path and method to each id
   * (`list_roles_v1_roles_get`), which would otherwise exceed the name limit.
   */
  readonly operationIdStrip?: string
  /**
   * A literal prefix moved from every path into the connection's base URL —
   * `/api/external/v2`, or a `/{Version}` segment the base URL pins. A path
   * parameter the prefix carried is dropped with it.
   */
  readonly stripPathPrefix?: string
  /**
   * Name every operation `<method>-<path>` even where it has an operationId —
   * for a vendor whose ids merely restate the path (HubSpot's are
   * `get-/crm/v3/objects/contacts_getPage`).
   */
  readonly ignoreOperationIds?: boolean
}

export interface NormaliseResult {
  readonly operations: readonly NormalisedOperation[]
  readonly skipped: readonly SkippedOperation[]
  /** The spec's first server URL with its variables at their defaults, if any. */
  readonly serverUrl?: string
}

/** Headers that are transport or credentials, never an operation parameter. */
export const DEFAULT_DROPPED_HEADERS: readonly string[] = [
  'authorization',
  'accept',
  'content-type',
  'content-length',
  'user-agent',
]

const METHODS: ReadonlySet<string> = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
const IGNORED_METHODS: ReadonlySet<string> = new Set(['head', 'options', 'trace'])

/** The maximum length of a generated operation name (the schema's own limit). */
const MAX_NAME = 100

/** The maximum length of a summary (the schema's own limit). */
export const MAX_SUMMARY = 120

// =============================================================================
// Names
// =============================================================================

/**
 * `GetCustomersCustomer` → `get-customers-customer`,
 * `agents_api_v1_list` → `agents-api-v1-list`, `crm.contacts.get` →
 * `crm-contacts-get`. A leading digit is prefixed with `op-`, because an
 * operation name must start with a letter.
 */
export const kebab = (value: string): string => {
  const spaced = value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return /^[0-9]/.test(spaced) ? `op-${spaced}` : spaced
}

/** `GET /campaigns/{id}/leads` → `get-campaigns-id-leads`. */
export const fallbackName = (method: string, path: string): string =>
  kebab(`${method.toLowerCase()}-${path.replace(/[{}]/g, '')}`)

/** The key an override addresses an operation by, independent of its id. */
export const operationKey = (method: string, path: string): string =>
  `${method.toUpperCase()} ${path}`

// =============================================================================
// Summaries
// =============================================================================

/**
 * One line of at most {@link MAX_SUMMARY} characters: markdown links reduced to
 * their text, HTML tags removed, whitespace collapsed, cut at a word boundary.
 */
export const cleanSummary = (raw: string | undefined): string | undefined => {
  if (raw === undefined) return undefined
  const text = raw
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (text === '') return undefined
  if (text.length <= MAX_SUMMARY) return text
  const cut = text.slice(0, MAX_SUMMARY - 1)
  const boundary = cut.lastIndexOf(' ')
  return `${(boundary > 60 ? cut.slice(0, boundary) : cut).replace(/[\s,;:.-]+$/, '')}…`
}

// =============================================================================
// Groups
// =============================================================================

const VERSION_SEGMENT = /^(v\d+(\.\d+)?|api|external|rest|\d{4}-\d{2}(-\d{2})?)$/i

/** `/v1/customers/{customer}/sources` → `customers`. */
export const pathGroup = (path: string): string =>
  kebab(
    path
      .split('/')
      .filter((segment) => segment !== '' && !segment.startsWith('{'))
      .find((segment) => !VERSION_SEGMENT.test(segment)) ?? 'root'
  ) || 'root'

// =============================================================================
// The walk
// =============================================================================

const serverUrlOf = (doc: Node): string | undefined => {
  const server = asNode(asArray(doc['servers'])[0])
  const url = asString(server['url'])
  if (url !== undefined) {
    const variables = asNode(server['variables'])
    return url.replace(/\{([^}]+)\}/g, (whole, name: string) => {
      const fallback = asString(asNode(variables[name])['default'])
      return fallback ?? whole
    })
  }
  const host = asString(doc['host'])
  if (host === undefined) return undefined
  const scheme = asString(asArray(doc['schemes'])[0]) ?? 'https'
  return `${scheme}://${host}${asString(doc['basePath']) ?? ''}`
}

/** Path-item parameters, overridden by operation parameters of the same name and location. */
const mergedParameters = (doc: Node, pathItem: Node, operation: Node): readonly Node[] => {
  const all = [...asArray(pathItem['parameters']), ...asArray(operation['parameters'])].map(
    (param) => resolve(doc, param)
  )
  const byKey = new Map(
    all.map((param) => [`${String(param['in'])}:${String(param['name'])}`, param])
  )
  return [...byKey.values()]
}

interface Candidate {
  readonly key: string
  readonly operationId?: string
  readonly method: HttpMethod
  readonly path: string
  readonly node: Node
  readonly pathItem: Node
}

const candidatesOf = (
  doc: Node
): { readonly candidates: readonly Candidate[]; readonly skipped: readonly SkippedOperation[] } => {
  const entries = Object.entries(asNode(doc['paths'])).flatMap(([path, rawItem]) => {
    const pathItem = resolve(doc, rawItem)
    return Object.entries(pathItem)
      .filter(([method]) => METHODS.has(method.toUpperCase()) || IGNORED_METHODS.has(method))
      .map(([method, node]) => ({ path, method, node: asNode(node), pathItem }))
  })
  return {
    candidates: entries
      .filter((entry) => !IGNORED_METHODS.has(entry.method))
      .map((entry) => {
        const method = entry.method.toUpperCase() as HttpMethod
        const operationId = asString(entry.node['operationId'])
        return {
          key: operationKey(method, entry.path),
          ...(operationId === undefined ? {} : { operationId }),
          method,
          path: entry.path,
          node: entry.node,
          pathItem: entry.pathItem,
        }
      }),
    skipped: entries
      .filter((entry) => IGNORED_METHODS.has(entry.method))
      .map((entry) => ({
        key: operationKey(entry.method, entry.path),
        reason: 'unsupported-method' as const,
      })),
  }
}

const nameOf = (
  candidate: Candidate,
  rename: Readonly<Record<string, string>>,
  strip: RegExp | undefined,
  prefix: string | undefined
): string =>
  rename[candidate.key] ??
  (candidate.operationId === undefined ? undefined : rename[candidate.operationId]) ??
  (candidate.operationId === undefined
    ? fallbackName(candidate.method, strippedPath(candidate.path, prefix))
    : kebab(strip === undefined ? candidate.operationId : candidate.operationId.replace(strip, '')))

/** The path with the configured prefix moved out to the base URL. */
const strippedPath = (path: string, prefix: string | undefined): string =>
  prefix !== undefined && path.startsWith(prefix) ? path.slice(prefix.length) || '/' : path

type Built =
  | { readonly kind: 'operation'; readonly value: NormalisedOperation }
  | { readonly kind: 'skip'; readonly value: SkippedOperation }

const buildOne = (
  doc: Node,
  candidate: Candidate,
  name: string,
  options: NormaliseOptions
): Built => {
  const skip = (reason: SkipReason): Built => ({
    kind: 'skip',
    value: { key: candidate.key, reason },
  })
  if (candidate.node['deprecated'] === true) return skip('deprecated')
  const dropped = new Set(
    [...DEFAULT_DROPPED_HEADERS, ...(options.dropHeaders ?? [])].map((h) => h.toLowerCase())
  )
  const parameters = mergedParameters(doc, candidate.pathItem, candidate.node)
  const plain = parameters.filter((param) => {
    const location = param['in']
    if (location === 'header') return !dropped.has(String(param['name']).toLowerCase())
    return location === 'path' || location === 'query'
  })
  const body =
    asString(doc['swagger']) === undefined
      ? openApiBody(doc, candidate.node)
      : swaggerBody(doc, candidate.node, parameters)
  if (body.kind === 'skip') return skip(body.reason)
  const plainEntries = plain.map(
    (param) =>
      [
        String(param['name']),
        paramFacts(
          doc,
          param['in'] as ParamLocation,
          parameterSchema(param),
          param['required'] === true
        ),
      ] as const
  )
  const bodyEntries = body.kind === 'body' ? body.params : []
  const plainNames = new Set(plainEntries.map(([paramName]) => paramName))
  if (bodyEntries.some(([paramName]) => plainNames.has(paramName))) return skip('param-collision')
  const path = strippedPath(candidate.path, options.stripPathPrefix)
  const params = Object.fromEntries(
    [...plainEntries, ...bodyEntries].filter(
      ([paramName, param]) => param.in !== 'path' || path.includes(`{${paramName}}`)
    )
  )
  const query = new Map(
    plain.filter((param) => param['in'] === 'query').map((param) => [String(param['name']), param])
  )
  const override = options.pagination?.[name]
  const pagination =
    override === null
      ? undefined
      : (override ??
        (candidate.method === 'GET' ? detectPagination(doc, candidate.node, query) : undefined))
  const summary = cleanSummary(asString(candidate.node['summary']))
  const tags = asArray(candidate.node['tags']).filter(
    (tag): tag is string => typeof tag === 'string'
  )
  const groups =
    options.groupByPath === true || tags.length === 0
      ? [pathGroup(path)]
      : [...new Set(tags.map((tag) => kebab(tag) || 'root'))]
  return {
    kind: 'operation',
    value: {
      operation: {
        name,
        method: candidate.method,
        path,
        ...(summary === undefined ? {} : { summary }),
        ...(Object.keys(params).length === 0 ? {} : { params }),
        // JSON is the schema's default encoding, so it is left implicit.
        ...(body.kind === 'body' && body.encoding !== 'json' ? { body: body.encoding } : {}),
        ...(pagination === undefined ? {} : { pagination }),
      },
      groups,
    },
  }
}

const isIncluded = (candidate: Candidate, options: NormaliseOptions): boolean => {
  const byPath =
    options.includePaths === undefined ||
    options.includePaths.some((prefix) => candidate.path.startsWith(prefix))
  const tags = new Set(asArray(candidate.node['tags']).map(String))
  const byTag =
    options.includeTags === undefined || options.includeTags.some((tag) => tags.has(tag))
  return byPath && byTag
}

/**
 * Normalise one parsed specification. Throws on a name collision (two
 * operations generating the same name) or an over-long name: both are resolved
 * by a `rename` override, never by the generator picking a winner.
 */
export const normaliseSpec = (doc: Node, options: NormaliseOptions = {}): NormaliseResult => {
  const rename = options.rename ?? {}
  const excluded = new Set(options.exclude ?? [])
  const { candidates, skipped: ignored } = candidatesOf(doc)
  const strip =
    options.operationIdStrip === undefined
      ? undefined
      : // eslint-disable-next-line sovrium/no-dynamic-regexp -- the pattern comes from a committed overrides.yaml a maintainer writes and reviews, never from a vendor file or a user, and it runs once per operationId at generation time only.
        new RegExp(options.operationIdStrip)
  const named = candidates.map((candidate) => {
    const { operationId: _ignored, ...withoutId } = candidate
    return {
      candidate,
      name: nameOf(
        options.ignoreOperationIds === true ? withoutId : candidate,
        rename,
        strip,
        options.stripPathPrefix
      ),
    }
  })
  const built = named.map(({ candidate, name }): Built => {
    if (!isIncluded(candidate, options)) {
      return { kind: 'skip', value: { key: candidate.key, reason: 'not-included' } }
    }
    if (
      excluded.has(name) ||
      excluded.has(candidate.key) ||
      (candidate.operationId !== undefined && excluded.has(candidate.operationId))
    ) {
      return { kind: 'skip', value: { key: candidate.key, reason: 'excluded' } }
    }
    return buildOne(doc, candidate, name, options)
  })
  const operations = built.flatMap((item) => (item.kind === 'operation' ? [item.value] : []))
  const skipped = [
    ...ignored,
    ...built.flatMap((item) => (item.kind === 'skip' ? [item.value] : [])),
  ]

  const tooLong = operations.find(({ operation }) => operation.name.length > MAX_NAME)
  if (tooLong !== undefined) {
    throw new Error(
      `operation name \`${tooLong.operation.name}\` is longer than ${MAX_NAME} characters — add a rename override`
    )
  }
  const invalid = operations.find(({ operation }) => !/^[a-z][a-z0-9-]*$/.test(operation.name))
  if (invalid !== undefined) {
    throw new Error(`operation name \`${invalid.operation.name}\` is not kebab-case`)
  }
  const seen = new Map<string, string>()
  const collisions = operations.flatMap(({ operation }) => {
    const key = operationKey(operation.method, operation.path)
    const first = seen.get(operation.name)
    seen.set(operation.name, first ?? key)
    return first === undefined ? [] : [`\`${operation.name}\` from both ${first} and ${key}`]
  })
  if (collisions.length > 0) {
    throw new Error(
      `operation name collision — add a rename override: ${collisions.slice(0, 5).join('; ')}`
    )
  }
  const serverUrl = serverUrlOf(doc)
  return { operations, skipped, ...(serverUrl === undefined ? {} : { serverUrl }) }
}
