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

const APP_VERSION = await getSovriumVersion()


const createOpenApiApp = (appConfig?: App) => {
  const app = new OpenAPIHono()

  STATIC_GROUPS.forEach((group) => registerStaticRoutes(app, group))

  RESOURCE_GROUPS.forEach((group) => expandRoutesPerResource(app, group, appConfig))

  return app
}

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
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
    tags: [...buildTags(appConfig)],
  })

const documentCache = new WeakMap<object, ReturnType<typeof buildDocument>>()
const noAppKey: object = {}

export const getOpenAPIDocument = (appConfig?: App) => {
  const cacheKey = appConfig ?? noAppKey
  const cached = documentCache.get(cacheKey)
  if (cached !== undefined) {
    return cached
  }
  const document = buildDocument(appConfig)
  documentCache.set(cacheKey, document)
  return document
}
