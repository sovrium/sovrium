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

function addPathParam(request: RouteSpec['request'], paramName: string): RouteSpec['request'] {
  const pathParam = { [paramName]: z.string().describe(`${paramName} identifier`) }
  const existingParams = request?.params as z.ZodObject<z.ZodRawShape> | undefined
  return {
    ...request,
    params: existingParams === undefined ? z.object(pathParam) : existingParams.extend(pathParam),
  } as RouteSpec['request']
}

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
