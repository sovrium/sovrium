/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { OpenAPIHono, createRoute } from '@hono/zod-openapi'
import { healthResponseSchema } from '@/presentation/api/schemas/health-schemas'

/**
 * OpenAPI Schema Generator
 *
 * This file creates a parallel OpenAPI schema using OpenAPIHono.
 * **Important**: This is separate from the runtime API routes in `app.ts`.
 *
 * **Why Separate?**
 * - Runtime routes use regular Hono (for RPC compatibility with `:id` syntax)
 * - OpenAPI schema uses OpenAPIHono (for documentation with `{id}` syntax)
 * - Both share the same Zod schemas for consistency
 *
 * **Usage**:
 * 1. Runtime: Server uses regular Hono routes from `app.ts`
 * 2. Docs: Server exposes this schema at `/api/openapi.json` and `/api/scalar`
 * 3. Export: Script exports this schema to `schemas/0.0.1/app.openapi.json`
 */

/**
 * Create OpenAPI Hono app with all routes
 *
 * This function defines all API routes using OpenAPI syntax for documentation.
 * The routes here are "dummy" implementations - they're only used to generate
 * the OpenAPI schema. The real implementations are in `app.ts`.
 */
const createOpenApiApp = () => {
  const app = new OpenAPIHono()

  // Define health check route with OpenAPI annotations
  const healthRoute = createRoute({
    method: 'get',
    path: '/api/health',
    summary: 'Health check endpoint',
    description:
      'Returns server health status. Used by monitoring tools and E2E tests to verify server is running.',
    operationId: 'healthCheck',
    tags: ['infrastructure'],
    responses: {
      200: {
        content: {
          'application/json': {
            schema: healthResponseSchema,
          },
        },
        description: 'Server is healthy',
      },
    },
  })

  // Mount route with dummy handler (only for schema generation)
  // eslint-disable-next-line functional/no-expression-statements
  app.openapi(healthRoute, (c) => {
    return c.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      app: {
        name: 'Sovrium',
      },
    })
  })

  // Future routes will be added here:
  // app.openapi(listTablesRoute, ...)
  // app.openapi(getTableRoute, ...)

  return app
}

/**
 * Get OpenAPI document as JSON
 *
 * This function generates the complete OpenAPI specification document.
 * It's used by:
 * - `/api/openapi.json` endpoint (runtime documentation)
 * - `/api/scalar` endpoint (Scalar UI)
 * - `scripts/export-openapi.ts` (export to schemas/ folder)
 *
 * @returns OpenAPI 3.1.0 specification document
 */
export const getOpenAPIDocument = () => {
  const app = createOpenApiApp()

  return app.getOpenAPIDocument({
    openapi: '3.1.0',
    info: {
      title: 'Sovrium API',
      version: '0.0.1',
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
    tags: [
      {
        name: 'infrastructure',
        description: 'Infrastructure endpoints (health, metrics)',
      },
    ],
  })
}
