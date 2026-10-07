/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The schema admin reads, as registry entries: the component-type catalogue,
 * one type's fields and options, the field-type catalogue, and the class
 * provenance of one part of one type.
 *
 * Each entry is the whole of one read: the admin route, the MCP admin tool and
 * the OpenAPI operation are all derived from it. A type the catalogue does not
 * draw answers not-found indistinguishably from one that does not exist, so a
 * caller cannot enumerate which types are withheld — and a malformed name is
 * the same not-found again.
 *
 * Audit: the catalogue writes the design read event naming the caller; the
 * four others write none, exactly as their routes always have.
 */

import { Effect, Schema } from 'effect'
import { AdminReadHost } from '@/application/ports/services/admin-read-host'
import {
  answerWithSchema,
  decodeAdminReadQuery,
  defineAdminRead,
  type AdminReadDecode,
  type AdminReadOperation,
} from '@/application/use-cases/admin/admin-read-operation'
import { componentTypeDetail } from '@/application/use-cases/admin/design-system-component-detail'
import { componentTypeOptions } from '@/application/use-cases/admin/design-system-component-options'
import {
  componentTypeCategories,
  listComponentTypes,
  listFieldTypes,
} from '@/application/use-cases/admin/design-system-schema'
import { parseOptionalCap } from '@/domain/kernel/format/query-cap-parsers'
import { AUDIT_ACTIONS } from '@/domain/models/api/admin/audit-log/action-catalog'
import {
  componentTypeDetailQuerySchema,
  componentTypeDetailSchema,
  componentTypeListResponseSchema,
  componentTypeOptionsQuerySchema,
  componentTypeOptionsResponseSchema,
  provenanceQuerySchema,
  provenanceResponseSchema,
} from '@/domain/models/api/admin/design-system/component-types'
import { fieldTypeListResponseSchema } from '@/domain/models/api/admin/design-system/field-types'

const NO_ARGUMENTS = { type: 'object', properties: {} } as const

/** The `:type` segment of the per-type reads. */
const componentTypeParamsSchema = Schema.Struct({
  type: Schema.String.annotate({
    description: 'The component-type literal, exactly as an author writes it in config',
    examples: ['button', 'table'],
  }),
})

const TYPE_ARGUMENT = {
  type: 'string',
  description: 'The component type, exactly as an author writes it in config.',
} as const

/**
 * The path's `type` plus the decoded query. The query is validated first, as
 * the route's validator always ran before its handler.
 */
const decodeTypeAnd = <Q>(
  schema: Schema.Codec<Q, unknown, never, never>,
  queryNames: ReadonlyArray<string>,
  raw: Readonly<Record<string, unknown>>
): AdminReadDecode<{ readonly type: string; readonly query: Q }> => {
  const query = decodeAdminReadQuery(
    schema,
    Object.fromEntries(queryNames.map((name) => [name, raw[name]]))
  )
  if (query._tag !== 'Ok') return query
  const type = typeof raw['type'] === 'string' ? raw['type'] : ''
  return { _tag: 'Ok', input: { type, query: query.input } }
}

const componentTypesList = defineAdminRead<undefined>({
  id: 'schema.component-types.list',
  method: 'get',
  path: '/api/admin/schema/component-types',
  pathParams: [],
  queryParams: [],
  tool: {
    suffix: 'component_types_list',
    description:
      'Every component type the engine can draw, with its category and how often this app writes it, as GET /api/admin/schema/component-types answers it (admin-only, read-only).',
    inputSchema: NO_ARGUMENTS,
  },
  openapi: {
    summary: 'List every component type the engine can draw',
    description:
      'The whole component-type catalogue in the shared `{ items, total }` rows envelope. ' +
      'A type the console refuses to draw is listed all the same, carrying its own reason. ' +
      'Never paginated. Writes a design read event naming the caller. Admin only.',
    operationIdBase: 'listAdminComponentTypes',
    responseSchema: componentTypeListResponseSchema,
    responseDescription: 'The component-type catalogue',
  },
  subject: 'the component-type catalogue',
  decode: () => ({ _tag: 'Ok', input: undefined }),
  read: (app) =>
    Effect.sync(() => {
      const items = listComponentTypes(app)
      const categories = componentTypeCategories(items)
      return answerWithSchema(componentTypeListResponseSchema, {
        items,
        total: items.length,
        categories,
        categoryCounts: Object.fromEntries(
          categories.map((category) => [category.slug, category.count])
        ),
      })
    }),
  audit: {
    action: AUDIT_ACTIONS.CONFIG_DESIGN_QUERIED,
    resourceId: (_app, _input, request) => request.actorUserId,
  },
})

const componentTypeOptionsRead = defineAdminRead<{
  readonly type: string
  readonly query: typeof componentTypeOptionsQuerySchema.Type
}>({
  id: 'schema.component-types.options',
  method: 'get',
  path: '/api/admin/schema/component-types/:type/options',
  pathParams: ['type'],
  queryParams: ['group'],
  tool: {
    suffix: 'component_type_options',
    description:
      'The configuration options one component type takes, counted, as GET /api/admin/schema/component-types/:type/options answers them (admin-only, read-only).',
    inputSchema: {
      type: 'object',
      properties: {
        type: TYPE_ARGUMENT,
        group: { type: 'string', description: 'Only this configuration group.' },
      },
      required: ['type'],
    },
  },
  openapi: {
    summary: "Read one component type's configuration options",
    description:
      'The options a type takes, exploded one row per union member, optionally one group. A ' +
      'type the catalogue does not draw answers 404 like one that does not exist. Admin only.',
    operationIdBase: 'getAdminComponentTypeOptions',
    paramsSchema: componentTypeParamsSchema,
    querySchema: componentTypeOptionsQuerySchema,
    responseSchema: componentTypeOptionsResponseSchema,
    responseDescription: "The type's option tree",
  },
  subject: 'the component-type option tree',
  decode: (raw) => decodeTypeAnd(componentTypeOptionsQuerySchema, ['group'], raw),
  read: (_app, { type, query }) =>
    Effect.sync(() => {
      const options = componentTypeOptions(type, query.group)
      return options === undefined
        ? ({ _tag: 'NotFound' } as const)
        : answerWithSchema(componentTypeOptionsResponseSchema, options)
    }),
})

const componentTypeRead = defineAdminRead<{
  readonly type: string
  readonly query: typeof componentTypeDetailQuerySchema.Type
}>({
  id: 'schema.component-types.read',
  method: 'get',
  path: '/api/admin/schema/component-types/:type',
  pathParams: ['type'],
  queryParams: ['routesLimit'],
  tool: {
    suffix: 'component_type_read',
    description:
      'One component type: its catalogue entry, its fields and the routes of this app that write it, as GET /api/admin/schema/component-types/:type answers it (admin-only, read-only).',
    inputSchema: {
      type: 'object',
      properties: {
        type: TYPE_ARGUMENT,
        routesLimit: { type: 'integer', minimum: 0, description: 'Cap the routes list.' },
      },
      required: ['type'],
    },
  },
  openapi: {
    summary: "Read one component type's fields",
    description:
      'The fields a type declares itself, the shared field modules it spreads, its variant ' +
      'and size axes, and the routes of this app that write it. A type the catalogue refuses ' +
      'to draw answers 404 indistinguishably from one that does not exist. Admin only.',
    operationIdBase: 'getAdminComponentType',
    paramsSchema: componentTypeParamsSchema,
    querySchema: componentTypeDetailQuerySchema,
    responseSchema: componentTypeDetailSchema,
    responseDescription: "The type's fields",
  },
  subject: 'the component-type detail',
  decode: (raw) => decodeTypeAnd(componentTypeDetailQuerySchema, ['routesLimit'], raw),
  read: (app, { type, query }) =>
    Effect.sync(() => {
      const detail = componentTypeDetail(type, app, parseOptionalCap(query.routesLimit))
      return detail === undefined
        ? ({ _tag: 'NotFound' } as const)
        : answerWithSchema(componentTypeDetailSchema, detail)
    }),
})

const fieldTypesList = defineAdminRead<undefined>({
  id: 'schema.field-types.list',
  method: 'get',
  path: '/api/admin/schema/field-types',
  pathParams: [],
  queryParams: [],
  tool: {
    suffix: 'field_types_list',
    description:
      'Every table field type the schema registers, by category, as GET /api/admin/schema/field-types answers it (admin-only, read-only).',
    inputSchema: NO_ARGUMENTS,
  },
  openapi: {
    summary: 'List every table field type the schema registers',
    description:
      'The whole field-type catalogue in the shared `{ items, total }` rows envelope, in ' +
      'registry reading order. Derived from the schema alone: it describes what a table may ' +
      'declare, never what this instance’s tables do. Never paginated. Admin only.',
    operationIdBase: 'listAdminFieldTypes',
    responseSchema: fieldTypeListResponseSchema,
    responseDescription: 'The field-type catalogue',
  },
  subject: 'the field-type catalogue',
  decode: () => ({ _tag: 'Ok', input: undefined }),
  read: () =>
    Effect.sync(() => {
      const items = listFieldTypes()
      return answerWithSchema(fieldTypeListResponseSchema, { items, total: items.length })
    }),
})

const provenance = defineAdminRead<typeof provenanceQuerySchema.Type>({
  id: 'design-system.provenance',
  method: 'get',
  path: '/api/admin/design-system/provenance',
  pathParams: [],
  queryParams: ['type', 'part'],
  tool: {
    suffix: 'design_system_provenance',
    description:
      'Where the classes of one part of one component type come from, layer by layer, as GET /api/admin/design-system/provenance answers it (admin-only, read-only).',
    inputSchema: {
      type: 'object',
      properties: {
        type: TYPE_ARGUMENT,
        part: { type: 'string', description: 'The part to resolve (default root).' },
      },
      required: ['type'],
    },
  },
  openapi: {
    summary: 'Report why a class is on one part of one component',
    description:
      'Resolves one part of one engine type against `design.components` and returns both ' +
      'the merged class list the renderer applies and the same resolution layer by layer, ' +
      'in precedence order. Admin only.',
    operationIdBase: 'getAdminClassProvenance',
    querySchema: provenanceQuerySchema,
    responseSchema: provenanceResponseSchema,
    responseDescription: 'The resolved class provenance',
  },
  subject: 'the class provenance chain',
  decode: (raw) => decodeAdminReadQuery(provenanceQuerySchema, raw),
  read: (app, { type, part }) =>
    Effect.gen(function* () {
      const host = yield* AdminReadHost
      const report = host.classProvenance({
        ...(app.design === undefined ? {} : { design: app.design }),
        type,
        part,
      })
      return answerWithSchema(provenanceResponseSchema, { type, ...report })
    }),
})

/** The schema admin reads, in the order the registry lists them. */
export const SCHEMA_READ_OPERATIONS: ReadonlyArray<AdminReadOperation> = [
  componentTypesList,
  componentTypeOptionsRead,
  componentTypeRead,
  fieldTypesList,
  provenance,
]
