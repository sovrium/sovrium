/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveOpenApiSchema, type OpenAPISpec } from '../lib/schema-resolver.js'

export interface ApiSchemaComparison {
  totalEndpoints: number
  currentTotalEndpoints: number
  implementedEndpoints: number
  missingEndpoints: number
  completionPercent: number
  missingEndpointPaths: Array<{ path: string; method: string }>
  implementedEndpointPaths: Array<{ path: string; method: string }>
  currentEndpointPaths: Array<{ path: string; method: string }>
}

/**
 * Compare two OpenAPI schemas and calculate implementation progress
 *
 * Resolves all $ref pointers before comparison to ensure accurate diff
 * calculation between modular goal schemas and flattened current schemas.
 */
export async function compareApiSchemas(
  goalSchemaPath: string,
  currentSchemaPath: string
): Promise<ApiSchemaComparison> {
  // Load and resolve OpenAPI schemas (dereference all $ref pointers)
  const goalSchema = await resolveOpenApiSchema(goalSchemaPath)
  const currentSchema = await resolveOpenApiSchema(currentSchemaPath)

  // Extract all endpoint paths with methods from both schemas
  const goalEndpoints = extractEndpoints(goalSchema)
  const currentEndpoints = extractEndpoints(currentSchema)

  // Create sets for comparison
  const currentSet = new Set(currentEndpoints.map((e) => `${e.method.toUpperCase()} ${e.path}`))

  // Calculate diff
  const missingEndpoints = goalEndpoints.filter(
    (e) => !currentSet.has(`${e.method.toUpperCase()} ${e.path}`)
  )
  const implementedEndpoints = goalEndpoints.filter((e) =>
    currentSet.has(`${e.method.toUpperCase()} ${e.path}`)
  )

  const completionPercent = Math.round((implementedEndpoints.length / goalEndpoints.length) * 100)

  return {
    totalEndpoints: goalEndpoints.length,
    currentTotalEndpoints: currentEndpoints.length,
    implementedEndpoints: implementedEndpoints.length,
    missingEndpoints: missingEndpoints.length,
    completionPercent,
    missingEndpointPaths: missingEndpoints.sort((a, b) => {
      if (a.path !== b.path) return a.path < b.path ? -1 : 1
      return a.method < b.method ? -1 : 1
    }),
    implementedEndpointPaths: implementedEndpoints.sort((a, b) => {
      if (a.path !== b.path) return a.path < b.path ? -1 : 1
      return a.method < b.method ? -1 : 1
    }),
    currentEndpointPaths: currentEndpoints.sort((a, b) => {
      if (a.path !== b.path) return a.path < b.path ? -1 : 1
      return a.method < b.method ? -1 : 1
    }),
  }
}

/**
 * Extract all endpoint paths with methods from OpenAPI schema
 * Returns array of {path, method} objects
 */
function extractEndpoints(schema: OpenAPISpec): Array<{ path: string; method: string }> {
  const endpoints: Array<{ path: string; method: string }> = []

  if (!schema.paths || typeof schema.paths !== 'object') {
    return endpoints
  }

  for (const [path, methods] of Object.entries(schema.paths)) {
    if (!methods || typeof methods !== 'object') {
      continue
    }

    for (const method of Object.keys(methods)) {
      // Only include valid HTTP methods
      const validMethods = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head']
      if (validMethods.includes(method.toLowerCase())) {
        endpoints.push({
          path,
          method: method.toLowerCase(),
        })
      }
    }
  }

  return endpoints
}
