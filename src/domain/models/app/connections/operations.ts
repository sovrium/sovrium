/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Connection operations — one endpoint of the connected service, declared once
 * with typed parameters and called by name from any automation step
 * (`type: connection`, `operator: call`).
 *
 * An operation carries FUNCTIONAL FACTS ONLY: its method, its path, its
 * parameters with their types and allowed values, how its body is encoded,
 * how it paginates, and a one-line summary. The connection it sits on supplies
 * the base URL and the authentication, so an operation never repeats either.
 */

// ─── Parameters ──────────────────────────────────────────────────────────────

const ParamScalarTypeSchema = Schema.Literals(['string', 'number', 'integer', 'boolean']).pipe(
  Schema.annotate({
    description: 'Type of each item of an array parameter: string, number, integer or boolean',
  })
)

const ParamEnumSchema = Schema.Array(Schema.Union([Schema.String, Schema.Finite])).pipe(
  Schema.annotate({
    description:
      'The only values accepted. A literal value outside this list is refused when the config loads.',
  })
)

/** The items of an array-typed parameter. */
export const OperationParamItemsSchema = Schema.Struct({
  type: Schema.optional(ParamScalarTypeSchema),
  enum: Schema.optional(ParamEnumSchema),
}).pipe(
  Schema.annotate({
    identifier: 'ConnectionOperationParamItems',
    title: 'Operation Parameter Items',
    description:
      'What each item of an array parameter must be. Arrays in the query string are sent as repeated keys (`status=a&status=b`).',
  })
)

/** One parameter of an operation. */
export const OperationParamSchema = Schema.Struct({
  in: Schema.Literals(['path', 'query', 'header', 'body']).pipe(
    Schema.annotate({
      description:
        'Where the value is sent: a `{name}` segment of the path, the query string, a request header, or a field of the request body. Values are URL-encoded by Sovrium.',
    })
  ),
  type: Schema.Literals(['string', 'number', 'integer', 'boolean', 'array', 'object']).pipe(
    Schema.annotate({
      description:
        'The type of the value. A literal of another type in an automation step is refused when the config loads; a template value is checked when the step runs.',
    })
  ),
  required: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotate({
        defaultNote: 'false (a path parameter is always required)',
        description:
          'Whether every call must supply this parameter. A call that omits a required parameter is refused when the config loads.',
      })
    )
  ),
  enum: Schema.optional(ParamEnumSchema),
  items: Schema.optional(OperationParamItemsSchema),
  format: Schema.optional(
    Schema.Literals(['date', 'date-time', 'email', 'uri', 'uuid', 'iban']).pipe(
      Schema.annotate({
        description:
          'A finer shape a string value must have, checked like the type: date (YYYY-MM-DD), date-time (ISO 8601), email, uri, uuid, or iban.',
      })
    )
  ),
  description: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description: 'What the parameter means, in one line. Shown in the manual and in errors.',
      }),
      Schema.check(Schema.isMaxLength(200))
    )
  ),
}).pipe(
  Schema.annotate({
    identifier: 'ConnectionOperationParam',
    title: 'Operation Parameter',
    description:
      'One parameter of an operation: where it goes, its type and the values it accepts.',
  })
)

/** @public */
export type OperationParam = Schema.Schema.Type<typeof OperationParamSchema>

// ─── Pagination ──────────────────────────────────────────────────────────────

const ItemsPathSchema = Schema.String.pipe(
  Schema.annotate({
    description:
      'Dot path to the array of items in each response body (e.g. `transactions`, `data.items`). With `paginate`, the items of every page are concatenated into `steps.<name>.data`.',
    examples: ['transactions', 'data.items'],
  })
)

export const PagePaginationSchema = Schema.Struct({
  style: Schema.Literal('page').pipe(
    Schema.annotate({ description: "A page number sent as a query parameter ('page' style)" })
  ),
  pageParam: Schema.String.pipe(
    Schema.annotate({ description: 'Name of the query parameter carrying the page number' })
  ),
  startPage: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({ defaultNote: '1', description: 'Number of the first page (0 or 1)' }),
      Schema.check(Schema.isInt(), Schema.isBetween({ minimum: 0, maximum: 1 }))
    )
  ),
  itemsPath: ItemsPathSchema,
  nextPath: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'Dot path to the next page number in the response; when it is null or absent the last page was reached. Without it, pages are read until one returns no items.',
      })
    )
  ),
}).pipe(
  Schema.annotate({
    identifier: 'ConnectionOperationPagePagination',
    title: 'Page-Number Pagination',
    description: 'Pages addressed by number: page=1, page=2, …',
  })
)

export const OffsetPaginationSchema = Schema.Struct({
  style: Schema.Literal('offset').pipe(
    Schema.annotate({ description: "An item offset and a page size ('offset' style)" })
  ),
  offsetParam: Schema.String.pipe(
    Schema.annotate({ description: 'Name of the query parameter carrying the item offset' })
  ),
  limitParam: Schema.String.pipe(
    Schema.annotate({ description: 'Name of the query parameter carrying the page size' })
  ),
  limit: Schema.Finite.pipe(
    Schema.annotate({ description: 'Page size requested on each call (1-1000)' }),
    Schema.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 1000 }))
  ),
  itemsPath: ItemsPathSchema,
}).pipe(
  Schema.annotate({
    identifier: 'ConnectionOperationOffsetPagination',
    title: 'Offset Pagination',
    description: 'Pages addressed by offset and limit; reading stops at a short page.',
  })
)

export const CursorPaginationSchema = Schema.Struct({
  style: Schema.Literal('cursor').pipe(
    Schema.annotate({ description: "An opaque cursor returned by each page ('cursor' style)" })
  ),
  cursorParam: Schema.String.pipe(
    Schema.annotate({ description: 'Name of the query parameter carrying the cursor' })
  ),
  cursorPath: Schema.String.pipe(
    Schema.annotate({
      description:
        'Dot path to the next cursor in the response body; when it is null or absent the last page was reached',
    })
  ),
  itemsPath: ItemsPathSchema,
}).pipe(
  Schema.annotate({
    identifier: 'ConnectionOperationCursorPagination',
    title: 'Cursor Pagination',
    description: 'Each page names the cursor of the next one.',
  })
)

export const LinkHeaderPaginationSchema = Schema.Struct({
  style: Schema.Literal('link').pipe(
    Schema.annotate({ description: 'The `Link: <…>; rel="next"` response header (\'link\' style)' })
  ),
  itemsPath: Schema.optional(ItemsPathSchema),
}).pipe(
  Schema.annotate({
    identifier: 'ConnectionOperationLinkPagination',
    title: 'Link-Header Pagination',
    description:
      'The next page is the URL in the `Link` header marked `rel="next"`. Without `itemsPath`, each page body is the array of items.',
  })
)

export const LastItemPaginationSchema = Schema.Struct({
  style: Schema.Literal('lastItem').pipe(
    Schema.annotate({
      description:
        "The id of the last item of each page, sent to ask for the items after it ('lastItem' style, e.g. starting_after)",
    })
  ),
  afterParam: Schema.String.pipe(
    Schema.annotate({
      description:
        'Name of the query parameter carrying the id of the last item already read (for example starting_after)',
    })
  ),
  idField: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        defaultNote: 'id',
        description: 'Field of each item holding the id sent in afterParam',
      })
    )
  ),
  hasMorePath: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'Dot path to a boolean in the response telling whether more items follow (for example has_more); reading stops when it is false. Without it, pages are read until one returns no items.',
      })
    )
  ),
  itemsPath: ItemsPathSchema,
}).pipe(
  Schema.annotate({
    identifier: 'ConnectionOperationLastItemPagination',
    title: 'Last-Item Pagination',
    description:
      'Each next page is asked for with the id of the last item of the previous one — the style of APIs that page with starting_after and has_more.',
  })
)

export const OperationPaginationSchema = Schema.Union([
  PagePaginationSchema,
  OffsetPaginationSchema,
  CursorPaginationSchema,
  LinkHeaderPaginationSchema,
  LastItemPaginationSchema,
]).pipe(
  Schema.annotate({
    identifier: 'ConnectionOperationPagination',
    title: 'Operation Pagination',
    description:
      'How the operation pages its results, so a call with `paginate` can read every page — or the first N — and return the items as one array.',
  })
)

/** @public */
export type OperationPagination = Schema.Schema.Type<typeof OperationPaginationSchema>

// ─── Operation ───────────────────────────────────────────────────────────────

export const ConnectionOperationSchema = Schema.Struct({
  name: Schema.String.pipe(
    Schema.annotate({
      description:
        'Operation name (kebab-case), unique within its connection. An automation step calls it as `operation: <name>`.',
      examples: ['list-transactions', 'create-contact'],
    }),
    Schema.check(Schema.isPattern(/^[a-z][a-z0-9-]*$/), Schema.isMaxLength(100))
  ),
  method: Schema.Literals(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).pipe(
    Schema.annotate({ description: 'HTTP method of the endpoint' })
  ),
  path: Schema.String.pipe(
    Schema.annotate({
      description:
        "Path appended to the connection's `baseUrl`, starting with `/`. A `{name}` segment is filled from the path parameter of that name.",
      examples: ['/transactions', '/contacts/{id}'],
    }),
    Schema.check(Schema.isPattern(/^\/\S*$/))
  ),
  summary: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'What the endpoint does, in one line of at most 120 characters. Shown in the manual.',
      }),
      Schema.check(Schema.isMaxLength(120))
    )
  ),
  params: Schema.optional(
    Schema.Record(
      Schema.String.pipe(
        Schema.annotate({ description: 'Parameter name, as the service spells it' })
      ),
      OperationParamSchema
    ).pipe(
      Schema.annotate({
        description:
          'The parameters the endpoint accepts, by name. A call passing a name not declared here is refused when the config loads.',
      })
    )
  ),
  body: Schema.optional(
    Schema.Literals(['json', 'form', 'multipart']).pipe(
      Schema.annotate({
        defaultNote: 'json',
        description:
          'How the `in: body` parameters are encoded: a JSON object, a URL-encoded form, or multipart form data',
      })
    )
  ),
  pagination: Schema.optional(OperationPaginationSchema),
}).pipe(
  Schema.annotate({
    identifier: 'ConnectionOperation',
    title: 'Connection Operation',
    description:
      'One endpoint of the connected service, declared once and called by name from any automation step with `type: connection` and `operator: call`.',
  })
)

/** @public */
export type ConnectionOperation = Schema.Schema.Type<typeof ConnectionOperationSchema>

export const ConnectionOperationsSchema = Schema.Array(ConnectionOperationSchema).pipe(
  Schema.annotate({
    description:
      "Endpoints of this service callable by name from automations. Requires `baseUrl`; each call is authenticated with this connection's credentials.",
  })
)

// ─── Consistency rules (checked by `ConnectionsSchema`) ──────────────────────

const PATH_PARAM = /\{([^}]+)\}/g

/**
 * Why one connection's operations are not self-consistent, or `undefined`.
 *
 * Checked where the whole connection is visible, because each rule relates two
 * of its parts: operations need a base URL to be called against; an operation
 * name is its address within the connection; and every `{name}` of a path must
 * be filled by a parameter declared `in: path`.
 */
const TOKEN_FIELD = /^\$token\.([a-z_][a-z0-9_]*)/

/** Why a `$token.FIELD` base URL names no stored token field, or `undefined`. */
const tokenBaseUrlIssue = (connection: {
  readonly name: string
  readonly type?: string
  readonly baseUrl?: string | undefined
  readonly props?: unknown
}): string | undefined => {
  const field = connection.baseUrl?.match(TOKEN_FIELD)?.[1]
  if (field === undefined) return undefined
  const kept = (connection.props as { readonly tokenFields?: ReadonlyArray<string> } | undefined)
    ?.tokenFields
  return connection.type === 'oauth2' && kept?.includes(field) === true
    ? undefined
    : `Connection '${connection.name}' baseUrl reads $token.${field}, which is not a field its OAuth2 tokenFields keep`
}

export const operationsIssue = (connection: {
  readonly name: string
  readonly type?: string
  readonly baseUrl?: string | undefined
  readonly props?: unknown
  readonly operations?: ReadonlyArray<ConnectionOperation> | undefined
}): string | undefined => {
  const tokenIssue = tokenBaseUrlIssue(connection)
  if (tokenIssue !== undefined) return tokenIssue
  const operations = connection.operations ?? []
  if (operations.length === 0) return undefined
  if (connection.baseUrl === undefined) {
    return `Connection '${connection.name}' declares operations but no baseUrl to call them against`
  }
  const names = operations.map((operation) => operation.name)
  const duplicate = names.find((name, index) => names.indexOf(name) !== index)
  if (duplicate !== undefined) {
    return `Connection '${connection.name}' declares operation '${duplicate}' more than once`
  }
  return operations
    .flatMap((operation) =>
      [...operation.path.matchAll(PATH_PARAM)]
        .map((match) => match[1] ?? '')
        .filter((segment) => operation.params?.[segment]?.in !== 'path')
        .map(
          (segment) =>
            `Connection '${connection.name}' operation '${operation.name}' path segment '{${segment}}' has no parameter declared with in: path`
        )
    )
    .at(0)
}

// ─── Calls (checked by `AppSchema` against the declared operations) ──────────

/** A value resolved when the step runs: its type can only be checked then. */
const isRuntimeValue = (value: unknown): boolean =>
  typeof value === 'string' && (value.includes('{{') || value.includes('$env.'))

const FORMAT_PATTERNS: Readonly<Record<string, RegExp>> = {
  date: /^\d{4}-\d{2}-\d{2}$/,
  'date-time': /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  uri: /^[a-z][a-z0-9+.-]*:\S+$/i,
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  iban: /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/,
}

const matchesType = (value: unknown, type: string): boolean => {
  switch (type) {
    case 'string':
      return typeof value === 'string'
    case 'number':
      return typeof value === 'number' && Number.isFinite(value)
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value)
    case 'boolean':
      return typeof value === 'boolean'
    case 'array':
      return Array.isArray(value)
    default:
      return typeof value === 'object' && value !== null && !Array.isArray(value)
  }
}

const describeValue = (value: unknown): string => JSON.stringify(value) ?? String(value)

const typeIssue = (name: string, param: OperationParam, value: unknown): string | undefined =>
  matchesType(value, param.type)
    ? undefined
    : `parameter '${name}' expects ${param.type} but got ${describeValue(value)}`

const enumIssue = (name: string, param: OperationParam, value: unknown): string | undefined =>
  param.enum === undefined || param.enum.includes(value as string | number)
    ? undefined
    : `parameter '${name}' accepts ${param.enum.join(', ')} but got ${describeValue(value)}`

const itemsIssue = (name: string, param: OperationParam, value: unknown): string | undefined => {
  const allowed = param.items?.enum
  if (!Array.isArray(value) || allowed === undefined) return undefined
  const bad = value.find((item) => !isRuntimeValue(item) && !allowed.includes(item as string))
  return bad === undefined
    ? undefined
    : `parameter '${name}' accepts items ${allowed.join(', ')} but got ${describeValue(bad)}`
}

const formatIssue = (name: string, param: OperationParam, value: unknown): string | undefined => {
  const pattern = param.format === undefined ? undefined : FORMAT_PATTERNS[param.format]
  if (typeof value !== 'string' || pattern === undefined || pattern.test(value)) return undefined
  return `parameter '${name}' expects the ${param.format ?? ''} format but got ${describeValue(value)}`
}

/** Why one literal value does not fit its declared parameter, or `undefined`. */
const literalIssue = (name: string, param: OperationParam, value: unknown): string | undefined =>
  isRuntimeValue(value)
    ? undefined
    : [typeIssue, enumIssue, itemsIssue, formatIssue]
        .map((rule) => rule(name, param, value))
        .find((issue) => issue !== undefined)

type Call = {
  readonly connection: string
  readonly operation: string
  readonly params?: Readonly<Record<string, unknown>> | undefined
  readonly paginate?: unknown
}

/** Why the parameters a call passes do not fit the operation, or `undefined`. */
const paramsIssue = (call: Call, operation: ConnectionOperation): string | undefined => {
  const declared = operation.params ?? {}
  const given = call.params ?? {}
  const unknown = Object.keys(given).find((name) => !(name in declared))
  if (unknown !== undefined) {
    const accepted = Object.keys(declared).join(', ') || 'none'
    return `passes parameter '${unknown}', which operation '${operation.name}' does not declare. Accepted parameters: ${accepted}`
  }
  const missing = Object.entries(declared).find(
    ([name, param]) => (param.required === true || param.in === 'path') && !(name in given)
  )
  if (missing !== undefined) {
    return `does not pass required parameter '${missing[0]}' of operation '${operation.name}'`
  }
  return Object.entries(given)
    .map(([name, value]) => {
      const param = declared[name]
      return param === undefined ? undefined : literalIssue(name, param, value)
    })
    .find((issue) => issue !== undefined)
}

/**
 * Why one `connection` / `call` step does not fit the operation it names, or
 * `undefined`. An unknown connection is not reported here: the generic rule
 * that every `props.connection` names a declared connection already does.
 */
export const callIssue = (
  call: Call,
  connections: ReadonlyArray<{
    readonly name: string
    readonly operations?: ReadonlyArray<ConnectionOperation> | undefined
  }>
): string | undefined => {
  const connection = connections.find((candidate) => candidate.name === call.connection)
  if (connection === undefined) return undefined
  const operations = connection.operations ?? []
  const operation = operations.find((candidate) => candidate.name === call.operation)
  if (operation === undefined) {
    const available = operations.map((candidate) => candidate.name).join(', ') || 'none'
    return `calls operation '${call.operation}', which connection '${call.connection}' does not declare. Available operations: ${available}`
  }
  if (call.paginate !== undefined && operation.pagination === undefined) {
    return `sets paginate, but operation '${operation.name}' declares no pagination`
  }
  return paramsIssue(call, operation)
}
