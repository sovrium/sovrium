/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The HTTP adapter of the admin read-operation registry
 * (`src/application/use-cases/admin/admin-read-registry.ts`).
 *
 * It mounts one `GET` per registry entry and publishes the same entries into
 * the admin OpenAPI fragment, so a route, its documentation and its MCP tool
 * are one entry, never three. Nothing here names an operation: the adapter
 * reads the request onto the entry's declared parameters, runs the entry on
 * this request's domain services, and maps the surface-neutral result onto
 * the admin API's status codes:
 *
 *   - `Ok` → 200, `Cache-Control: no-store`,
 *   - `InvalidInput` → 400 (`from > to` for an inverted window),
 *   - `NotFound` → the anti-enumeration 404, indistinguishable from an unknown
 *     route,
 *   - `ValidationFailed` → 500, logged with the schema error,
 *   - a store failure → the sanitized canonical envelope (`toErrorResponse`).
 *
 * Auth gating is upstream: `requireAdminTier()` on `/api/admin/*` in route
 * setup answers a non-admin 404 before any handler here runs. The audit event
 * is written by the operation itself, on success only, with the `api`
 * transport.
 */

import { Effect, Schema } from 'effect'
import { isAdminReadText } from '@/application/use-cases/admin/admin-read-operation'
import { resolveRequestBaseUrl } from '@/domain/kernel/url/request-base-url'
import { errorResponseSchema } from '@/domain/models/api/combinators/error'
import { logError } from '@/infrastructure/logging/logger'
import { provideDomain, runRequestEffect } from '@/infrastructure/logging/request-effect'
import { provideAdminReadHost } from '@/presentation/api/admin/admin-read-host'
import { readComponents, withComponents } from '@/presentation/api/openapi/components-registry'
import { effectJsonResponse, effectParameters } from '@/presentation/api/openapi/route-fragments'
import { convert } from '@/presentation/api/openapi/schema-to-json'
import { notFound } from '@/presentation/api/runtime/auth-helpers'
import { conditionalRead } from '@/presentation/api/runtime/conditional-read'
import { requestLogAttributes } from '@/presentation/api/runtime/context-helpers'
import { validationFailureBody } from '@/presentation/api/runtime/effect-validator'
import { toErrorResponse } from '@/presentation/api/runtime/run-effect'
import type {
  AdminReadInvalidInput,
  AdminReadOperation,
  AdminReadResult,
} from '@/application/use-cases/admin/admin-read-operation'
import type { App } from '@/domain/models/app'
import type { ContextWithSession } from '@/presentation/api/middleware/auth'
import type { RouteSpec } from '@/presentation/api/openapi/route-spec'
import type { Context, Hono } from 'hono'

// ─── Request → raw parameters ────────────────────────────────────────────────

/**
 * The request, projected onto the operation's declared parameters. The list is
 * an ALLOW-LIST: a query parameter the entry does not name never reaches its
 * decoder.
 */
function readRawParameters(
  c: Context,
  operation: AdminReadOperation
): Readonly<Record<string, unknown>> {
  return Object.fromEntries([
    ...operation.pathParams.map((name) => [name, c.req.param(name)] as const),
    ...operation.queryParams.map((name) => [name, c.req.query(name)] as const),
  ])
}

// ─── Handler ─────────────────────────────────────────────────────────────────

async function handleAdminRead(
  c: Context,
  operation: AdminReadOperation,
  app: App
): Promise<Response> {
  const session = (c as ContextWithSession).var.session!
  const result = await runRequestEffect(
    c,
    Effect.result(
      provideDomain(
        c,
        provideAdminReadHost(
          operation.run({
            app,
            raw: readRawParameters(c, operation),
            actorUserId: session.userId,
            transport: 'api',
          }),
          resolveRequestBaseUrl(c)
        )
      )
    )
  )
  if (result._tag === 'Failure') return toErrorResponse(c, result.failure)
  return answerAdminRead(c, operation, result.success)
}

/** Map a surface-neutral result onto the admin API's status codes. */
function answerAdminRead(
  c: Context,
  operation: AdminReadOperation,
  outcome: AdminReadResult
): Response {
  switch (outcome._tag) {
    case 'InvalidInput':
      return answerInvalidInput(c, outcome)
    case 'NotFound':
      return notFound(c, 'Not found')
    case 'Refused':
      return c.json(outcome.body as Record<string, unknown>, outcome.status)
    case 'ValidationFailed':
      logError(
        `[admin] ${operation.subject} response validation failed`,
        outcome.error,
        requestLogAttributes(c)
      )
      return c.json(
        {
          success: false,
          message: `Failed to build ${operation.subject}`,
          code: 'INTERNAL_ERROR',
        },
        500
      )
    case 'Ok':
      // A conditional read's own middleware overwrites this with its
      // revalidation directive on the way out.
      c.header('Cache-Control', 'no-store')
      if (isAdminReadText(outcome.body)) {
        return c.text(outcome.body.body, 200, {
          ...outcome.body.headers,
          'Content-Type': outcome.body.contentType,
        })
      }
      return c.json(outcome.body as Record<string, unknown>, 200)
  }
}

/**
 * A refused request: the field-level body a request schema's refusal has
 * always answered, or the route's own named refusal, or the default.
 */
function answerInvalidInput(c: Context, outcome: AdminReadInvalidInput): Response {
  if (outcome.reason === 'validation' && Schema.isSchemaError(outcome.schemaError)) {
    return c.json(validationFailureBody(outcome.schemaError, 'query'), 400)
  }
  const fallback = outcome.reason === 'inverted-window' ? 'from > to' : 'Invalid query'
  return c.json(
    {
      success: false,
      message: outcome.message ?? fallback,
      code: outcome.code ?? 'BAD_REQUEST',
    },
    400
  )
}

// ─── Route registration ──────────────────────────────────────────────────────

/**
 * Chain one `GET` per operation onto a Hono app, in registry order.
 *
 * The live App is resolved per request through `resolveApp`, so a config swap
 * without restart is reflected on the next read.
 */
export function chainAdminReadRoutes<T extends Hono>(
  honoApp: T,
  resolveApp: () => App,
  operations: ReadonlyArray<AdminReadOperation>
): T {
  return operations.reduce<T>((chained, operation) => {
    const handler = (c: Context) => handleAdminRead(c, operation, resolveApp())
    const conditional = operation.http?.conditional
    if (conditional === undefined) return chained.get(operation.path, handler) as T
    // The revalidation is a GET-only middleware on the path rather than a
    // second GET handler, so the registry binding stays the one GET route the
    // path has (the parity gate counts them) and a sibling POST is untouched.
    const revalidate = conditionalRead({ ignoreKeys: [...(conditional.ignoreKeys ?? [])] })
    return chained
      .use(operation.path, (c, next) => (c.req.method === 'GET' ? revalidate(c, next) : next()))
      .get(operation.path, handler) as T
  }, honoApp)
}

// ─── OpenAPI ─────────────────────────────────────────────────────────────────

/** `/api/admin/x/:id` → `/api/admin/x/{id}`. */
const toOpenApiPath = (path: string): string => path.replaceAll(/:([A-Za-z0-9_]+)/g, '{$1}')

const errorResponse = (description: string) => effectJsonResponse(errorResponseSchema, description)

/** A 200 whose body is a plain string of `contentType` (the markdown export). */
const textResponse = (
  contentType: string,
  description: string
): ReturnType<typeof effectJsonResponse> =>
  ({ content: { [contentType]: { schema: { type: 'string' } } }, description }) as never

/**
 * The 200 entry carrying, beside its own components, those of the base schemas
 * its body extends by name — otherwise the `allOf` reference would dangle.
 */
const withBaseComponents = (
  entry: ReturnType<typeof effectJsonResponse>,
  baseSchemas: ReadonlyArray<Schema.Top> = []
): ReturnType<typeof effectJsonResponse> =>
  withComponents(entry as object, {
    ...readComponents(entry),
    ...Object.assign({}, ...baseSchemas.map((schema) => convert(schema).components)),
  }) as ReturnType<typeof effectJsonResponse>

/** Whether the read can refuse its query: a query schema or a named refusal, unless lenient. */
const publishesBadRequest = (openapi: AdminReadOperation['openapi']): boolean =>
  openapi.refusesQuery !== false &&
  (openapi.querySchema !== undefined || openapi.badRequestDescription !== undefined)

/**
 * The OpenAPI operation of one registry entry. Declares exactly the codes the
 * handler above can answer: 400 only when the entry reads a query, 404 only
 * when it addresses a resource by path.
 */
export function toAdminReadRouteSpec(operation: AdminReadOperation): RouteSpec {
  const { openapi } = operation
  const parameters = [
    ...(openapi.paramsSchema === undefined ? [] : effectParameters(openapi.paramsSchema, 'path')),
    ...(openapi.querySchema === undefined
      ? ((openapi.queryParameters ?? []) as ReturnType<typeof effectParameters>)
      : effectParameters(openapi.querySchema, 'query')),
  ]
  const refusesQuery = publishesBadRequest(openapi)
  return {
    method: operation.method,
    pathTemplate: toOpenApiPath(operation.path),
    summary: openapi.summary,
    description: openapi.description,
    operationIdBase: openapi.operationIdBase,
    ...(parameters.length === 0 ? {} : { parameters }),
    responses: {
      200: withBaseComponents(
        openapi.responseContentType === undefined
          ? effectJsonResponse(openapi.responseSchema, openapi.responseDescription)
          : textResponse(openapi.responseContentType, openapi.responseDescription),
        openapi.baseSchemas
      ),
      ...(refusesQuery
        ? { 400: errorResponse(openapi.badRequestDescription ?? 'Malformed query') }
        : {}),
      ...(operation.pathParams.length === 0
        ? {}
        : { 404: errorResponse('Not found, or not visible to this caller') }),
      500: errorResponse(`Failed to build ${operation.subject}`),
    },
  }
}
