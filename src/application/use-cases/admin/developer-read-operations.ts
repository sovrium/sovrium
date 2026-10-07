/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The Developers admin reads, as registry entries: the instance facts, the MCP
 * tools this config exposes, and the reflection record and declaration rows of
 * the running configuration — the facts the Developers console pages compose
 * themselves from, never a sentence those pages would otherwise have written.
 *
 * Each entry is the whole of one read: the admin route, the MCP admin tool and
 * the OpenAPI operation are all derived from it. The reflection and the rows
 * pass through `redactAppConfigForReflection`, so neither surface can answer a
 * credential the config holds. None writes an admin audit event, exactly as
 * their routes never have.
 *
 * Import this module through the registry, never directly: the tools listing
 * reads the registry back, and the registry is the only safe entry into that
 * cycle.
 */

import { Effect, Option, Schema } from 'effect'
import { AdminReadHost } from '@/application/ports/services/admin-read-host'
import {
  answerWithSchema,
  defineAdminRead,
  type AdminReadDecode,
  type AdminReadOperation,
} from '@/application/use-cases/admin/admin-read-operation'
import {
  buildConfigDeclarations,
  buildConfigReflection,
} from '@/application/use-cases/admin/config/config-reflection'
import { buildInstanceFacts } from '@/application/use-cases/admin/config/instance-facts'
import { buildMcpToolsResponse } from '@/application/use-cases/admin/config/mcp-tool-listing'
import {
  configDeclarationFamilySchema,
  configDeclarationsQuerySchema,
  configDeclarationsResponseSchema,
  configReflectionResponseSchema,
  type ConfigDeclarationFamily,
} from '@/domain/models/api/admin/config'
import {
  instanceFactsQuerySchema,
  instanceFactsResponseSchema,
} from '@/domain/models/api/admin/instance'
import {
  mcpToolCategorySchema,
  mcpToolsQuerySchema,
  mcpToolsResponseSchema,
  type McpToolCategory,
} from '@/domain/models/api/admin/mcp'
import { parseMcpEnvConfig, resolveMcpEnv } from '@/domain/models/process-env/mcp'

const NO_ARGUMENTS = { type: 'object', properties: {} } as const

/** A read that takes no parameter. */
const noInput = (): AdminReadDecode<undefined> => ({ _tag: 'Ok', input: undefined })

/** The process environment, as the redactors read it. */
const processEnv = (): Readonly<Record<string, string | undefined>> => process.env

/**
 * A positive integer `limit`, or `undefined`. A malformed value is treated as
 * absent rather than refused: it narrows a display list, so the honest
 * degradation is showing everything.
 */
const parseLimit = (raw: unknown): number | undefined => {
  if (raw === undefined || raw === null) return undefined
  const parsed = Number(raw)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}

const instanceRead = defineAdminRead<number | undefined>({
  id: 'config.instance.read',
  method: 'get',
  path: '/api/admin/instance',
  pathParams: [],
  queryParams: ['limit'],
  tool: {
    suffix: 'instance_read',
    description:
      'The facts of this instance — its origin, its declared tables, its key support and its tool counts — as GET /api/admin/instance answers them (admin-only, read-only).',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', minimum: 1, description: 'Cap the tables list.' },
      },
    },
  },
  openapi: {
    summary: 'Read the facts the Developers docs pages compose themselves from',
    description:
      "Returns this instance's resolved public origin, its declared `app.version`, the " +
      'declared tables in declaration order, and the flat counts every heading on the API ' +
      'and MCP pages gates on. `oauthApplicationType` is computed from the origin per RFC ' +
      '8252 §7.3. No rendered curl and no composed address crosses the wire. Admin only.',
    operationIdBase: 'getAdminInstance',
    // A malformed cap is treated as absent rather than refused.
    querySchema: instanceFactsQuerySchema,
    refusesQuery: false,
    responseSchema: instanceFactsResponseSchema,
    responseDescription: 'The instance facts',
  },
  subject: 'instance facts response',
  decode: (raw) => ({ _tag: 'Ok', input: parseLimit(raw['limit']) }),
  read: (app, limit) =>
    Effect.gen(function* () {
      const host = yield* AdminReadHost
      return answerWithSchema(
        instanceFactsResponseSchema,
        buildInstanceFacts(app, host.origin, limit)
      )
    }),
})

/**
 * `MCP_EXPOSE_INTERNALS` as the MCP server resolved it. An undecodable MCP
 * environment refuses the boot whenever MCP is on, so the fallback only answers
 * for a server offering no tool at all — and then answers closed.
 */
const readMcpExposeInternals = (): boolean => {
  try {
    return resolveMcpEnv(parseMcpEnvConfig(process.env)).exposeInternals
  } catch {
    return false
  }
}

const mcpToolsList = defineAdminRead<McpToolCategory | undefined>({
  id: 'config.mcp-tools.list',
  method: 'get',
  path: '/api/admin/mcp/tools',
  pathParams: [],
  queryParams: ['category'],
  tool: {
    suffix: 'mcp_tools_list',
    description:
      'The MCP tools this configuration exposes, optionally narrowed to one category, as GET /api/admin/mcp/tools answers them (admin-only, read-only).',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: [...mcpToolCategorySchema.literals],
          description: 'Only the tools of this family.',
        },
      },
    },
  },
  openapi: {
    summary: 'List the MCP tools this configuration exposes to an AI',
    description:
      'One row per exposed tool, carrying the exact identifier the MCP server advertises, ' +
      'the family it derives from, and its description. Nothing is exposed without an ' +
      'explicit `aiAccess` opt-in, so an empty array is the default posture. `admin` ' +
      'answers the read tools mirroring the admin API. Admin only.',
    operationIdBase: 'getAdminMcpTools',
    querySchema: mcpToolsQuerySchema,
    badRequestDescription: 'A category outside the four families',
    responseSchema: mcpToolsResponseSchema,
    responseDescription: 'The exposed tools',
  },
  subject: 'mcp tools response',
  // A typo must not answer "this config exposes no tools" — the one wrong
  // answer that reads exactly like the real empty state.
  decode: (raw) =>
    raw['category'] === undefined
      ? { _tag: 'Ok', input: undefined }
      : Option.match(Schema.decodeUnknownOption(mcpToolCategorySchema)(raw['category']), {
          onNone: () => ({
            _tag: 'InvalidInput',
            reason: 'malformed',
            message: 'Unknown tool category. Expected one of: table, action, automation, admin.',
            code: 'INVALID_CATEGORY',
          }),
          onSome: (category) => ({ _tag: 'Ok', input: category }),
        }),
  read: (app, category) =>
    Effect.sync(() =>
      answerWithSchema(
        mcpToolsResponseSchema,
        buildMcpToolsResponse(app, category, { exposeInternals: readMcpExposeInternals() })
      )
    ),
})

const configReflection = defineAdminRead<undefined>({
  id: 'config.reflection',
  method: 'get',
  path: '/api/admin/config/reflection',
  pathParams: [],
  queryParams: [],
  tool: {
    suffix: 'config_reflection',
    description:
      'The redacted running configuration serialized as JSON, with one count per declaration family, as GET /api/admin/config/reflection answers it (admin-only, read-only).',
    inputSchema: NO_ARGUMENTS,
  },
  openapi: {
    summary: 'Read the serialized configuration and one flat count per declaration family',
    description:
      'Returns the redacted running configuration serialized with two-space indentation, ' +
      'plus one count per family, including the families the config leaves empty. ' +
      'Redaction is server-side and is a condition of the authorisation. Admin only.',
    operationIdBase: 'getAdminConfigReflection',
    responseSchema: configReflectionResponseSchema,
    responseDescription: 'The reflection record',
  },
  // Revalidated by ETag; the per-request `generatedAt` is left out of the tag.
  http: { conditional: { ignoreKeys: ['generatedAt'] } },
  subject: 'config reflection response',
  decode: noInput,
  read: (app) =>
    Effect.sync(() =>
      answerWithSchema(configReflectionResponseSchema, buildConfigReflection(app, processEnv()))
    ),
})

const CONFIG_FAMILIES = [...configDeclarationFamilySchema.literals]

const configDeclarations = defineAdminRead<ConfigDeclarationFamily | undefined>({
  id: 'config.declarations.list',
  method: 'get',
  path: '/api/admin/config/declarations',
  pathParams: [],
  queryParams: ['family'],
  tool: {
    suffix: 'config_declarations_list',
    description:
      'The declaration tree of the running configuration, optionally one family at a time, as GET /api/admin/config/declarations answers it (admin-only, read-only).',
    inputSchema: {
      type: 'object',
      properties: {
        family: { type: 'string', enum: CONFIG_FAMILIES, description: 'Only this family.' },
      },
    },
  },
  openapi: {
    summary: 'Walk the declaration tree, optionally one family at a time',
    description:
      "One row per declaration, in the config's own order, carrying the operator's own " +
      'identifier and its second level. A family outside the seven is refused 400: an ' +
      'empty list would read as "this instance declares nothing". Admin only.',
    operationIdBase: 'getAdminConfigDeclarations',
    querySchema: configDeclarationsQuerySchema,
    badRequestDescription: 'A family outside the seven the tree walks',
    responseSchema: configDeclarationsResponseSchema,
    responseDescription: 'The declaration rows',
  },
  subject: 'config declarations response',
  decode: (raw) =>
    raw['family'] === undefined
      ? { _tag: 'Ok', input: undefined }
      : Option.match(Schema.decodeUnknownOption(configDeclarationFamilySchema)(raw['family']), {
          onNone: () => ({
            _tag: 'InvalidInput',
            reason: 'malformed',
            message:
              'Unknown config family. Expected one of: tables, pages, forms, automations, agents, buckets, connections.',
            code: 'INVALID_FAMILY',
          }),
          onSome: (family) => ({ _tag: 'Ok', input: family }),
        }),
  read: (app, family) =>
    Effect.sync(() =>
      answerWithSchema(
        configDeclarationsResponseSchema,
        buildConfigDeclarations(app, processEnv(), family)
      )
    ),
})

/** The Developers admin reads, in the order the registry lists them. */
export const DEVELOPER_READ_OPERATIONS: ReadonlyArray<AdminReadOperation> = [
  instanceRead,
  mcpToolsList,
  configReflection,
  configDeclarations,
]
