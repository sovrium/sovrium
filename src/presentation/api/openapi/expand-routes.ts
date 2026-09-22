/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type OpenAPIHono, createRoute } from '@hono/zod-openapi'
import {
  collectRouteComponents,
  mergeComponents,
} from '@/presentation/api/openapi/merge-components'
import {
  type ResourceGroupSpec,
  type RouteSpec,
  type StaticGroupSpec,
  toPascalCase,
} from './route-spec'
import type { App } from '@/domain/models/app'
import type { Components } from '@/presentation/api/openapi/components-registry'

/**
 * Rank a parameter's location for the grouping order zod-to-openapi emits:
 * path, then query, then header, then everything else.
 */
const parameterLocationRank = (location: unknown): number =>
  location === 'path' ? 0 : location === 'query' ? 1 : location === 'header' ? 2 : 3

/**
 * Re-attach the resource path parameter to a route's `parameters[]` for
 * fallback (app-absent) mode — the direct-`parameters` twin of
 * {@link addPathParam}.
 *
 * A spec that declares Effect-derived `parameters` has no Zod `request.params`
 * for `addPathParam` to extend, so the generic `{tableId}`-style placeholder
 * would otherwise appear in the path while being undeclared, which makes the
 * emitted document self-inconsistent.
 */
function addPathParameter(
  parameters: RouteSpec['parameters'],
  paramName: string
): RouteSpec['parameters'] {
  const generic = {
    name: paramName,
    in: 'path',
    required: true,
    schema: { type: 'string', description: `${paramName} identifier` },
    description: `${paramName} identifier`,
  }
  // Order carries no meaning in OpenAPI — parameters are matched by name — but
  // reproducing zod-to-openapi's is what lets a diff of the two documents serve
  // as a regression signal. That library emits one location group at a time, in
  // `params`, `query`, `header`, `cookie` order, so the generic PATH parameter
  // lands after any existing path parameter and before the first query one.
  // `toSorted` is stable, so a stable sort by location rank reproduces that for
  // either case, where a plain append or prepend only ever gets one right.
  return [...(parameters ?? []), generic].toSorted(
    (left, right) =>
      parameterLocationRank((left as { in?: unknown }).in) -
      parameterLocationRank((right as { in?: unknown }).in)
  ) as RouteSpec['parameters']
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
          // One mechanism, always: the generic placeholder joins the spec's own
          // `parameters[]`. Feeding both channels would emit it twice.
          request: spec.request,
          parameters: addPathParameter(spec.parameters, group.genericParamName),
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
          parameters: spec.parameters,
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
        parameters: spec.parameters,
        responses: spec.responses,
      }),
      (c) => c.json({} as never)
    )
  )
}

/**
 * Every named component the group's routes reference, merged and checked.
 *
 * Collected per group but merged document-wide by the caller, because a
 * component-name collision is a property of the whole document — two groups
 * are exactly where one is most likely to appear, and each group inspected
 * alone would look fine.
 */
export const collectGroupComponents = (group: ResourceGroupSpec | StaticGroupSpec): Components =>
  mergeComponents(group.routes.map(collectRouteComponents))
