/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The configuration admin reads, as registry entries: the running
 * configuration redacted, its declared environment, and the engine build.
 *
 * Each entry is the whole of one read of the RUNNING configuration ([internal ref]
 * A1): the admin route, the MCP admin tool and the OpenAPI operation are all
 * derived from it. None edits anything — there is no config write over MCP, as
 * there is none over HTTP.
 *
 * Redaction is a condition of the authorisation, not a quality concern, and it
 * happens HERE, server-side, before serialisation: the schema reflection passes
 * through `redactAppConfigForReflection`, and the environment viewer reports
 * whether a variable is set and from where, never its value. Both surfaces
 * answer the same body, so neither can leak what the other withholds.
 *
 * Audit: all three write their admin audit event. The Developers reads are the
 * sibling `developer-read-operations.ts`; the boot ledger and the decision
 * register are `release-read-operations.ts`.
 */

import { Effect } from 'effect'
import { AdminReadHost } from '@/application/ports/services/admin-read-host'
import {
  answerWithSchema,
  defineAdminRead,
} from '@/application/use-cases/admin/admin-read-operation'
import { buildEnvVarStatuses } from '@/application/use-cases/admin/config/env-status'
import { redactAppConfigForReflection } from '@/application/use-cases/admin/config/redact-app-config'
import { AUDIT_ACTIONS } from '@/domain/models/api/admin/audit-log/action-catalog'
import {
  configSchemaResponseSchema,
  configVersionResponseSchema,
} from '@/domain/models/api/admin/config'
import { envConfigResponseSchema } from '@/domain/models/api/admin/env'
import type {
  AdminReadDecode,
  AdminReadOperation,
} from '@/application/use-cases/admin/admin-read-operation'

const NO_ARGUMENTS = { type: 'object', properties: {} } as const

/** A read that takes no parameter. */
const noInput = (): AdminReadDecode<undefined> => ({ _tag: 'Ok', input: undefined })

/** The audit resource of a whole-config read: the caller, which makes it filterable per operator. */
const byActor = (_app: unknown, _input: unknown, request: { readonly actorUserId: string }) =>
  request.actorUserId

/** The process environment, as the redactors and the env viewer read it. */
const processEnv = (): Readonly<Record<string, string | undefined>> => process.env

// ─── The configuration itself ─────────────────────────────────────────────────

const configSchema = defineAdminRead<undefined>({
  id: 'config.schema',
  method: 'get',
  path: '/api/admin/config/schema',
  pathParams: [],
  queryParams: [],
  tool: {
    suffix: 'config_schema',
    description:
      'The running app configuration with every secret redacted, as GET /api/admin/config/schema answers it (admin-only, read-only).',
    inputSchema: NO_ARGUMENTS,
  },
  openapi: {
    summary: 'Read the running configuration',
    description:
      'The live app the instance booted from, redacted server-side before serialisation. ' +
      'Writes an audit event naming the caller. Admin only.',
    operationIdBase: 'getAdminConfigSchema',
    responseSchema: configSchemaResponseSchema,
    responseDescription: 'The redacted running configuration',
  },
  subject: 'config schema response',
  decode: noInput,
  read: (app) =>
    Effect.sync(() =>
      answerWithSchema(configSchemaResponseSchema, {
        app: redactAppConfigForReflection(app, processEnv()),
        // Per request: it timestamps the READ, so two reflections can be ordered.
        generatedAt: new Date().toISOString(),
      })
    ),
  audit: { action: AUDIT_ACTIONS.CONFIG_SCHEMA_QUERIED, resourceId: byActor },
})

const envList = defineAdminRead<undefined>({
  id: 'config.env.list',
  method: 'get',
  path: '/api/admin/env',
  pathParams: [],
  queryParams: [],
  tool: {
    suffix: 'env_list',
    description:
      'Every environment variable the app declares, whether this instance resolved it and from where — never its value — as GET /api/admin/env answers it (admin-only, read-only).',
    inputSchema: NO_ARGUMENTS,
  },
  openapi: {
    summary: 'Read the declared environment',
    description:
      'Every variable declared in `env[]`, with whether this instance resolved it and from ' +
      'which source. Values are never returned. Writes an audit event naming the caller. ' +
      'Admin only.',
    operationIdBase: 'getAdminEnv',
    responseSchema: envConfigResponseSchema,
    responseDescription: 'The declared variables and their resolution',
  },
  subject: 'env config response',
  decode: noInput,
  read: (app) =>
    Effect.sync(() =>
      answerWithSchema(envConfigResponseSchema, {
        variables: buildEnvVarStatuses(app, processEnv()),
        generatedAt: new Date().toISOString(),
      })
    ),
  audit: { action: AUDIT_ACTIONS.CONFIG_ENV_QUERIED, resourceId: byActor },
})

const configVersion = defineAdminRead<undefined>({
  id: 'config.version',
  method: 'get',
  path: '/api/admin/config/version',
  pathParams: [],
  queryParams: [],
  tool: {
    suffix: 'config_version',
    description:
      'The engine version, build commit, database runtime, Bun version and process start time, as GET /api/admin/config/version answers them (admin-only, read-only).',
    inputSchema: NO_ARGUMENTS,
  },
  openapi: {
    summary: 'Read the engine build and runtime',
    description:
      'The Sovrium version, the build commit, the active database runtime, the Bun version ' +
      'and the process boot timestamp. No domain data. Admin only.',
    operationIdBase: 'getAdminConfigVersion',
    responseSchema: configVersionResponseSchema,
    responseDescription: 'The engine build and runtime',
  },
  subject: 'version info',
  decode: noInput,
  read: () =>
    Effect.gen(function* () {
      const host = yield* AdminReadHost
      return answerWithSchema(configVersionResponseSchema, yield* host.configVersion)
    }),
  audit: { action: AUDIT_ACTIONS.CONFIG_VERSION_QUERIED, resourceId: () => 'version' },
})

/** The configuration admin reads, in the order the registry lists them. */
export const CONFIG_READ_OPERATIONS: ReadonlyArray<AdminReadOperation> = [
  configSchema,
  envList,
  configVersion,
]
