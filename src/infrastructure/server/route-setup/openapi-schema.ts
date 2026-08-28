/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { OpenAPIHono } from '@hono/zod-openapi'
import { getSovriumVersion } from '@/infrastructure/utils/version'
import {
  expandRoutesPerResource,
  registerStaticRoutes,
} from './openapi-routes/_shared/expand-routes'
import { RESOURCE_GROUPS, STATIC_GROUPS, buildTags } from './openapi-routes/_shared/group-registry'
import type { App } from '@/domain/models/app'

// Sovrium's own version (not the consumer app's). Backed by the build-time
// `__SOVRIUM_VERSION__` define so the compiled binary needs no package.json.
const APP_VERSION = await getSovriumVersion()

/**
 * OpenAPI Schema Generator
 *
 * Creates a parallel OpenAPI schema using OpenAPIHono — separate from the
 * runtime API routes (runtime uses regular Hono with `:id` syntax; OpenAPI
 * uses `{id}` syntax). Both share the same Zod schemas.
 *
 * **Config-driven**: when an `App` config is supplied, resource-scoped groups
 * (records, …) expand into concrete per-resource paths (`/api/tables/contacts/
 * records`) grouped under per-resource tags (`Table: contacts`). Without a
 * config, generic `{id}` paths are emitted — used by a future static
 * `export:openapi` and by apps with no configured resources.
 *
 * Located in the Infrastructure layer because schema generation is an
 * infrastructure concern (documentation/tooling), not presentation logic.
 */

/**
 * Create the OpenAPI Hono app with all routes registered.
 *
 * @param appConfig - Optional validated App config. Drives per-resource
 *   expansion of the config-driven route groups.
 */
const createOpenApiApp = (appConfig?: App) => {
  const app = new OpenAPIHono()

  // Static route groups (declarative spec model).
  STATIC_GROUPS.forEach((group) => registerStaticRoutes(app, group))

  // Config-driven resource groups (declarative spec model).
  RESOURCE_GROUPS.forEach((group) => expandRoutesPerResource(app, group, appConfig))

  return app
}

/**
 * Build the OpenAPI document from scratch. Expensive — instantiates a fresh
 * `OpenAPIHono` and registers every route group; prefer the memoized
 * `getOpenAPIDocument`.
 */
const buildDocument = (appConfig?: App) =>
  createOpenApiApp(appConfig).getOpenAPIDocument({
    openapi: '3.1.0',
    info: {
      title: 'Sovrium API',
      version: APP_VERSION,
      description:
        'REST API specification for Sovrium application.\n\n' +
        '**Generated Schema**: This schema is automatically generated from the runtime implementation. ' +
        'It reflects the currently implemented endpoints and their schemas.\n\n' +
        '**Design Specs**: Hand-written OpenAPI specs in `docs/specifications/app/` define the complete API design. ' +
        'Comparing this generated schema with the design specs shows implementation progress.',
    },
    // Build-time default only. The `/api/openapi.json` handler REPLACES this with
    // the instance's resolved origin on a per-request shallow copy, so a served
    // document never advertises this address. It survives for the app-absent
    // static-export path, which has no request to resolve an origin from.
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
    tags: [...buildTags(appConfig)],
  })

/**
 * Per-`App` memoization cache. The validated `App` is a single frozen object
 * for the lifetime of a server process, so reference identity is a correct
 * cache key; `noAppKey` keys the app-absent (static-export) document. `WeakMap`
 * lets a stale entry be garbage-collected if an app object is ever replaced.
 */
const documentCache = new WeakMap<object, ReturnType<typeof buildDocument>>()
const noAppKey: object = {}

/**
 * Get the OpenAPI document as JSON, memoized per `App` config.
 *
 * Used by the `/api/openapi.json` and `/api/scalar` endpoints. The document is
 * built once per app and reused — per-resource expansion makes a rebuild
 * non-trivial, and the config is immutable for the process lifetime.
 *
 * @param appConfig - Optional validated App config. When provided, the schema
 *   reflects the app's configured resources (concrete paths + per-resource
 *   tags). When omitted, generic `{id}` paths are emitted.
 * @returns OpenAPI 3.1.0 specification document
 */
export const getOpenAPIDocument = (appConfig?: App) => {
  const cacheKey = appConfig ?? noAppKey
  const cached = documentCache.get(cacheKey)
  if (cached !== undefined) {
    return cached
  }
  const document = buildDocument(appConfig)
  // eslint-disable-next-line functional/no-expression-statements -- memoization cache write
  documentCache.set(cacheKey, document)
  return document
}
