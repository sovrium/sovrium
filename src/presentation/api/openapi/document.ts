/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { OpenAPIHono } from '@hono/zod-openapi'
import { getSovriumVersion } from '@/infrastructure/process/version'
import { mergeComponents } from '@/presentation/api/openapi/merge-components'
import {
  collectGroupComponents,
  expandRoutesPerResource,
  registerStaticRoutes,
} from './expand-routes'
import { RESOURCE_GROUPS, STATIC_GROUPS, buildTags } from './group-registry'
import type { App } from '@/domain/models/app'

// Sovrium's own version (not the consumer app's). Backed by the build-time
// `__SOVRIUM_VERSION__` define so the compiled binary needs no package.json.
const APP_VERSION = await getSovriumVersion()

/**
 * OpenAPI Schema Generator
 *
 * Creates a parallel OpenAPI schema using OpenAPIHono — separate from the
 * runtime API routes (runtime uses regular Hono with `:id` syntax; OpenAPI
 * uses `{id}` syntax).
 *
 * The two no longer share one schema library. `src/domain/models/api/` is
 * Effect Schema, and its fragments reach this document through
 * `./route-fragments.ts` and `./schema-to-json.ts`, which convert them and hand
 * back the named components merged below. Zod survives only where
 * `@hono/zod-openapi` requires it — the `createRoute` declarations themselves —
 * and those components are registered by `zod-to-openapi` rather than by the
 * merge. So a route is described by whichever of the two its declaration was
 * written against, and `assertNoDanglingRefs` is what keeps the halves
 * referring to components that exist.
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

  // Named components from the Effect-Schema routes, merged across EVERY group
  // before any is registered. Merging document-wide is what makes the collision
  // check meaningful: two groups claiming one `identifier` is precisely the case
  // that inspecting either group alone cannot see, and the failure it prevents
  // is silent — Effect keys $defs by identifier, so the loser's whole subtree
  // would vanish from a document that still validates. Zod's `.openapi('Name')`
  // components are registered by zod-to-openapi itself and are asserted against
  // these by `assertNoDanglingRefs` once the document exists.
  const effectComponents = mergeComponents([
    ...STATIC_GROUPS.map(collectGroupComponents),
    ...RESOURCE_GROUPS.map(collectGroupComponents),
  ])
  Object.entries(effectComponents).forEach(([name, definition]) =>
    app.openAPIRegistry.registerComponent('schemas', name, definition)
  )

  // Static route groups (declarative spec model).
  STATIC_GROUPS.forEach((group) => registerStaticRoutes(app, group))

  // Config-driven resource groups (declarative spec model).
  RESOURCE_GROUPS.forEach((group) => expandRoutesPerResource(app, group, appConfig))

  return app
}

/**
 * Refuse a document containing a `$ref` no component satisfies.
 *
 * A dangling reference renders as an empty schema in Scalar and drops the type
 * from every generated client, while the document still parses as valid
 * OpenAPI — the same silent-loss shape as a component-name collision, reached
 * by the opposite route. Both halves of the document are covered: Zod's
 * `.openapi('Name')` components and the hoisted Effect ones land in the same
 * namespace, so one walk checks both.
 */
const assertNoDanglingRefs = (document: unknown, declared: ReadonlySet<string>): void => {
  const referencedNames = (value: unknown): readonly string[] => {
    if (Array.isArray(value)) return value.flatMap(referencedNames)
    if (typeof value !== 'object' || value === null) return []
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
      key === '$ref' && typeof child === 'string' && child.startsWith(COMPONENT_REF)
        ? [child.slice(COMPONENT_REF.length)]
        : referencedNames(child)
    )
  }
  const missing = [...new Set(referencedNames(document))].filter((name) => !declared.has(name))
  if (missing.length > 0) {
    // A dangling $ref produces a VALID document whose types render empty in Scalar
    // and vanish from every generated client — the same silent-loss shape as a
    // name collision, reached from the opposite direction. No caller can recover,
    // and shipping the document IS the failure being prevented.
    // eslint-disable-next-line functional/no-throw-statements -- see above
    throw new Error(
      `OpenAPI document references undeclared component(s): ${missing.toSorted().join(', ')}. ` +
        'A schema was referenced by name but never registered — check its `identifier` ' +
        'annotation, or its `.openapi()` registration.'
    )
  }
}

/** Where every hoisted schema is referenced from. */
const COMPONENT_REF = '#/components/schemas/'

/**
 * Build the OpenAPI document from scratch. Expensive — instantiates a fresh
 * `OpenAPIHono` and registers every route group; prefer the memoized
 * `getOpenAPIDocument`.
 */
const buildDocument = (appConfig?: App) => {
  const document = createOpenApiApp(appConfig).getOpenAPI31Document({
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
  assertNoDanglingRefs(document, new Set(Object.keys(document.components?.schemas ?? {})))
  return document
}

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
