/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import {
  type ResourceGroupSpec,
  type RouteSpec,
  type StaticGroupSpec,
  toPascalCase,
} from './route-spec'
import type { App } from '@/domain/models/app'

/**
 * Re-attach the resource path parameter to a route's `request` for fallback
 * (app-absent) mode.
 *
 * In config-driven mode the resource id is baked into the concrete path
 * (`/api/tables/contacts/records`), so a {@link RouteSpec} declares its
 * `request.params` WITHOUT it. The app-absent fallback keeps the generic
 * `{tableId}`-style placeholder in the path, so the params schema must declare
 * that parameter again — otherwise `createRoute` emits a doc whose declared
 * params do not match the path.
 */
function addPathParam(request: RouteSpec['request'], paramName: string): RouteSpec['request'] {
  const pathParam = { [paramName]: z.string().describe(`${paramName} identifier`) }
  const existingParams = request?.params as z.ZodObject<z.ZodRawShape> | undefined
  return {
    ...request,
    params: existingParams === undefined ? z.object(pathParam) : existingParams.extend(pathParam),
  } as RouteSpec['request']
}

/**
 * Register every route of a resource-scoped group on the OpenAPI app.
 *
 * Config-driven mode (`config` present, collection non-empty): emits one
 * concrete route per configured resource × `RouteSpec`, each under a
 * per-resource tag (`Table: contacts`) with a `__ResourceName`-suffixed
 * operationId.
 *
 * Fallback mode (no `config`, or an empty collection): emits one generic
 * route per `RouteSpec` using the group's generic placeholder and tag — this
 * keeps the schema valid for a future static `export:openapi` and for apps
 * that have not configured any resource of this kind.
 */
export function expandRoutesPerResource(
  openApiApp: OpenAPIHono,
  group: ResourceGroupSpec,
  config?: App
): void {
  const resources = config === undefined ? [] : group.collection(config)

  if (resources.length === 0) {
    group.routes.forEach((spec) =>
      openApiApp.openapi(
        createRoute({
          method: spec.method,
          path: spec.pathTemplate.replaceAll(group.resourcePlaceholder, group.genericPlaceholder),
          summary: spec.summary,
          description: spec.description,
          operationId: spec.operationIdBase,
          tags: [group.genericTag],
          request: addPathParam(spec.request, group.genericParamName),
          responses: spec.responses,
        }),
        (c) => c.json({} as never)
      )
    )
    return
  }

  resources.forEach((resource) => {
    const tag = `${group.tagPrefix}: ${resource.name}`
    const operationIdSuffix = toPascalCase(resource.name)
    group.routes.forEach((spec) =>
      openApiApp.openapi(
        createRoute({
          method: spec.method,
          path: spec.pathTemplate.replaceAll(group.resourcePlaceholder, resource.name),
          summary: spec.summary,
          description: spec.description,
          operationId: `${spec.operationIdBase}__${operationIdSuffix}`,
          tags: [tag],
          request: spec.request,
          responses: spec.responses,
        }),
        (c) => c.json({} as never)
      )
    )
  })
}

/**
 * Register every route of a static (non-resource-scoped) group under a single
 * fixed tag. Used for groups like health, auth, and account that have no
 * per-resource expansion.
 */
export function registerStaticRoutes(openApiApp: OpenAPIHono, group: StaticGroupSpec): void {
  group.routes.forEach((spec) =>
    openApiApp.openapi(
      createRoute({
        method: spec.method,
        path: spec.pathTemplate,
        summary: spec.summary,
        description: spec.description,
        operationId: spec.operationIdBase,
        tags: [group.tag],
        request: spec.request,
        responses: spec.responses,
      }),
      (c) => c.json({} as never)
    )
  )
}
