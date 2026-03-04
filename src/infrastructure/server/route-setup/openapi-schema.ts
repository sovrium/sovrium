/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { OpenAPIHono } from '@hono/zod-openapi'
import { resolvePackagePath } from '@/infrastructure/utils/package-paths'
import { registerActivityRoutes } from './openapi-routes/activity-routes'
import { registerAnalyticsRoutes } from './openapi-routes/analytics-routes'
import { registerBatchRoutes } from './openapi-routes/batch-routes'
import { registerHealthRoutes } from './openapi-routes/health-routes'
import { registerRecordRoutes } from './openapi-routes/record-routes'
import { registerTableRoutes } from './openapi-routes/table-routes'
import { registerViewRoutes } from './openapi-routes/view-routes'

// Read version from Sovrium's own package.json (not the consumer's)
const { version: APP_VERSION } = await Bun.file(resolvePackagePath('package.json')).json()

/**
 * OpenAPI Schema Generator
 *
 * This file creates a parallel OpenAPI schema using OpenAPIHono.
 * **Important**: This is separate from the runtime API routes.
 *
 * Located in Infrastructure layer because schema generation is an
 * infrastructure concern (documentation/tooling), not presentation logic.
 *
 * **Why Separate?**
 * - Runtime routes use regular Hono (for RPC compatibility with `:id` syntax)
 * - OpenAPI schema uses OpenAPIHono (for documentation with `{id}` syntax)
 * - Both share the same Zod schemas for consistency
 *
 * **Usage**:
 * 1. Runtime: Server uses regular Hono routes from api-routes.ts
 * 2. Docs: Server exposes this schema at `/api/openapi.json` and `/api/scalar`
 * 3. Export: Script exports this schema to `schemas/{version}/app.openapi.json`
 */

/**
 * Create OpenAPI Hono app with all routes
 *
 * This function defines all API routes using OpenAPI syntax for documentation.
 * The routes here are "dummy" implementations - they're only used to generate
 * the OpenAPI schema. The real implementations are in api-routes.ts.
 */
const createOpenApiApp = () => {
  const app = new OpenAPIHono()

  registerHealthRoutes(app)
  registerTableRoutes(app)
  registerRecordRoutes(app)
  registerBatchRoutes(app)
  registerViewRoutes(app)
  registerActivityRoutes(app)
  registerAnalyticsRoutes(app)

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
      version: APP_VERSION as string,
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
      {
        name: 'tables',
        description: 'Table management endpoints',
      },
      {
        name: 'records',
        description: 'Record CRUD, comments, and history endpoints',
      },
      {
        name: 'views',
        description: 'View management and filtered record access',
      },
      {
        name: 'activity',
        description: 'Activity log and audit trail endpoints',
      },
      {
        name: 'analytics',
        description: 'Analytics collection and reporting endpoints',
      },
    ],
  })
}
