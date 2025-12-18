/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { hc } from 'hono/client'
import type { ApiType } from '@/infrastructure/server/route-setup/api-routes'

/**
 * Hono RPC Client Factory
 *
 * Creates a fully typed API client for making requests to the Sovrium API.
 * The client provides:
 * - Full TypeScript autocomplete for all endpoints
 * - Type-safe request parameters and response data
 * - Automatic URL construction
 * - Native fetch-based implementation
 *
 * **Benefits of Hono RPC**:
 * - Zero code generation - types extracted directly from server routes
 * - No OpenAPI client generation step required
 * - Real-time type safety - changes to server routes immediately reflected
 * - Minimal bundle size - uses native fetch
 *
 * @param baseUrl - Base URL of the API server (e.g., 'http://localhost:3000')
 * @returns Typed RPC client for making API requests
 *
 * @example
 * Basic usage:
 * ```typescript
 * import { createApiClient } from '@/presentation/api/client'
 *
 * const client = createApiClient('http://localhost:3000')
 *
 * // GET /api/health - fully typed!
 * const res = await client.api.health.$get()
 * const data = await res.json()
 * // data is typed as HealthResponse { status: 'ok', timestamp: string, app: { name: string } }
 * console.log(data.status) // 'ok'
 * ```
 *
 * @example
 * With error handling:
 * ```typescript
 * const client = createApiClient('http://localhost:3000')
 *
 * try {
 *   const res = await client.api.health.$get()
 *
 *   if (!res.ok) {
 *     throw new Error(`HTTP ${res.status}: ${res.statusText}`)
 *   }
 *
 *   const data = await res.json()
 *   console.log('Health check:', data)
 * } catch (error) {
 *   console.error('Health check failed:', error)
 * }
 * ```
 *
 * @example
 * Future usage with path parameters (when tables API is implemented):
 * ```typescript
 * // GET /api/tables/:id
 * const res = await client.api.tables[':id'].$get({
 *   param: { id: '123' }
 * })
 * const table = await res.json()
 *
 * // POST /api/tables/:id/records
 * const res = await client.api.tables[':id'].records.$post({
 *   param: { id: '123' },
 *   json: { name: 'John', email: 'john@example.com' }
 * })
 * const record = await res.json()
 * ```
 *
 * @example
 * Using in React components with TanStack Query:
 * ```typescript
 * import { useQuery } from '@tanstack/react-query'
 * import { createApiClient } from '@/presentation/api/client'
 *
 * const client = createApiClient('http://localhost:3000')
 *
 * function HealthStatus() {
 *   const { data, isLoading, error } = useQuery({
 *     queryKey: ['health'],
 *     queryFn: async () => {
 *       const res = await client.api.health.$get()
 *       if (!res.ok) throw new Error('Health check failed')
 *       return res.json()
 *     }
 *   })
 *
 *   if (isLoading) return <div>Loading...</div>
 *   if (error) return <div>Error: {error.message}</div>
 *
 *   return <div>Status: {data?.status}</div>
 * }
 * ```
 */
export const createApiClient = (baseUrl: string) => {
  return hc<ApiType>(baseUrl)
}

/**
 * Re-export ApiType for convenience
 *
 * Allows consumers to import both the client and type from the same file.
 */
export type { ApiType }
