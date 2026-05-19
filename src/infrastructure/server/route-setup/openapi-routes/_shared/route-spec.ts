/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { App } from '@/domain/models/app'
import type { createRoute, z } from '@hono/zod-openapi'

type CreateRouteConfig = Parameters<typeof createRoute>[0]

export type RouteSpec = {
  readonly method: CreateRouteConfig['method']
  readonly pathTemplate: string
  readonly summary: string
  readonly description: string
  readonly operationIdBase: string
  readonly request?: CreateRouteConfig['request']
  readonly responses: CreateRouteConfig['responses']
}

export type ResourceGroupSpec = {
  readonly tagPrefix: string
  readonly genericTag: string
  readonly genericTagDescription: string
  readonly collection: (app: App) => readonly { readonly name: string }[]
  readonly resourcePlaceholder: string
  readonly genericPlaceholder: string
  readonly genericParamName: string
  readonly routes: readonly RouteSpec[]
}

export type StaticGroupSpec = {
  readonly tag: string
  readonly tagDescription: string
  readonly routes: readonly RouteSpec[]
}

export const toPascalCase = (kebab: string): string =>
  kebab
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')

export const jsonResponse = (schema: z.ZodType, description: string) => ({
  content: { 'application/json': { schema } },
  description,
})
