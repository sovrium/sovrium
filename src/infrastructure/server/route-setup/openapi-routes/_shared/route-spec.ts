/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { App } from '@/domain/models/app'
import type { createRoute, z } from '@hono/zod-openapi'

/**
 * The config object accepted by `@hono/zod-openapi`'s `createRoute`.
 *
 * Derived from the function signature itself so this model tracks the
 * installed library version — a `@hono/zod-openapi` bump cannot silently
 * desync `RouteSpec` from what `createRoute` actually expects.
 */
type CreateRouteConfig = Parameters<typeof createRoute>[0]

/**
 * A declarative description of one OpenAPI route, decoupled from its concrete
 * path. The `expandRoutesPerResource` / `registerStaticRoutes` mechanisms turn
 * a `RouteSpec` into one or more `createRoute` + `app.openapi` calls.
 *
 * For resource-scoped groups, `request.params` declares ONLY the parameters
 * that remain variable after expansion (e.g. `recordId`) — the resource id
 * itself is baked into the concrete path, so it must NOT appear here.
 */
export type RouteSpec = {
  readonly method: CreateRouteConfig['method']
  /**
   * Path containing the group's resource placeholder, e.g.
   * `/api/tables/{tableSlug}/records/{recordId}`. The placeholder is replaced
   * with a concrete resource name (config-driven mode) or the group's generic
   * placeholder (app-absent fallback).
   */
  readonly pathTemplate: string
  readonly summary: string
  readonly description: string
  /** Base operationId; resource-scoped routes get a `__ResourceName` suffix. */
  readonly operationIdBase: string
  readonly request?: CreateRouteConfig['request']
  readonly responses: CreateRouteConfig['responses']
}

/**
 * A route group scoped to a configured collection (tables, buckets, agents…).
 * Each configured resource produces a concrete copy of every `RouteSpec`,
 * grouped under a per-resource OpenAPI tag (`Table: contacts`).
 */
export type ResourceGroupSpec = {
  /** Per-resource tag prefix, e.g. `Table` → tag `Table: contacts`. */
  readonly tagPrefix: string
  /** Tag used by the generic app-absent fallback, e.g. `records`. */
  readonly genericTag: string
  readonly genericTagDescription: string
  /** Reads the configured collection off the validated `App`. */
  readonly collection: (app: App) => readonly { readonly name: string }[]
  /** Placeholder token in `pathTemplate` to substitute, e.g. `{tableSlug}`. */
  readonly resourcePlaceholder: string
  /** Placeholder used when no app config is available, e.g. `{tableId}`. */
  readonly genericPlaceholder: string
  /** Path-param name re-added to `request.params` in fallback mode, e.g. `tableId`. */
  readonly genericParamName: string
  readonly routes: readonly RouteSpec[]
}

/** A route group with one fixed tag and no per-resource expansion. */
export type StaticGroupSpec = {
  readonly tag: string
  readonly tagDescription: string
  readonly routes: readonly RouteSpec[]
}

/**
 * Convert a kebab-case resource name to PascalCase, for use as an
 * `operationId` suffix (`contacts` → `Contacts`, `user-roles` → `UserRoles`).
 * Resource names are kebab-case validated upstream by `AppSchema`.
 */
export const toPascalCase = (kebab: string): string =>
  kebab
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')

/**
 * Build an `application/json` response entry for a `RouteSpec.responses` map.
 * Keeps route definitions compact — the `content` wrapper is identical for
 * every JSON response.
 */
export const jsonResponse = (schema: z.ZodType, description: string) => ({
  content: { 'application/json': { schema } },
  description,
})
