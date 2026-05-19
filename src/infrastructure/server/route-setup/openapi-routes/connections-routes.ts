/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from '@hono/zod-openapi'
import { errorResponseSchema } from '@/domain/models/api/_shared/error'
import { connectionUsersResponseSchema } from '@/domain/models/api/connections'
import { type ResourceGroupSpec, type RouteSpec, jsonResponse } from './_shared/route-spec'


const errorResponse = (description: string) => jsonResponse(errorResponseSchema, description)

const routes: readonly RouteSpec[] = [
  {
    method: 'get',
    pathTemplate: '/api/connections/{connectionSlug}/authorize',
    summary: 'Start an OAuth authorization',
    description: 'Redirects to the external provider OAuth authorize URL.',
    operationIdBase: 'authorizeConnection',
    responses: {
      302: { description: 'Redirect to the provider authorize URL' },
      400: errorResponse('Invalid connection or not an OAuth2 connection'),
      401: errorResponse('Not authenticated'),
      404: errorResponse('Connection not found'),
      500: errorResponse('Failed to save OAuth state'),
    },
  },
  {
    method: 'get',
    pathTemplate: '/api/connections/{connectionSlug}/callback',
    summary: 'Handle the OAuth callback',
    description: 'Completes the OAuth flow using the provider authorization code.',
    operationIdBase: 'handleConnectionOAuthCallback',
    request: {
      query: z.object({
        code: z.string().describe('OAuth authorization code'),
        state: z.string().describe('OAuth state token'),
      }),
    },
    responses: {
      200: jsonResponse(
        z.object({ success: z.boolean(), connectionId: z.string() }),
        'Connection established'
      ),
      400: errorResponse('Missing or mismatched code/state'),
      401: errorResponse('Not authenticated'),
      404: errorResponse('Connection not found'),
      500: errorResponse('Failed to persist the connection'),
      502: errorResponse('Token exchange with the provider failed'),
    },
  },
  {
    method: 'get',
    pathTemplate: '/api/connections/{connectionSlug}/status',
    summary: 'Get connection status',
    description: 'Returns the current OAuth connection status for the authenticated user.',
    operationIdBase: 'getConnectionStatus',
    responses: {
      200: jsonResponse(
        z.object({
          name: z.string(),
          type: z.string(),
          status: z.enum(['connected', 'disconnected', 'expired']),
          connected: z.boolean(),
          expiresAt: z.string().nullable(),
        }),
        'Connection status'
      ),
      400: errorResponse('Connection name required'),
      401: errorResponse('Not authenticated'),
      404: errorResponse('Connection not found'),
      500: errorResponse('Failed to look up status'),
    },
  },
  {
    method: 'get',
    pathTemplate: '/api/connections/{connectionSlug}/users',
    summary: 'List connection users',
    description: 'Returns the users connected to this OAuth connection. Requires admin role.',
    operationIdBase: 'listConnectionUsers',
    responses: {
      200: jsonResponse(connectionUsersResponseSchema, 'Connected users'),
      400: errorResponse('Invalid connection or not an OAuth2 connection'),
      401: errorResponse('Not authenticated'),
      404: errorResponse('Connection not found'),
      500: errorResponse('Failed to list users'),
    },
  },
  {
    method: 'delete',
    pathTemplate: '/api/connections/{connectionSlug}/disconnect',
    summary: 'Disconnect a connection',
    description: 'Removes the stored OAuth tokens for the authenticated user.',
    operationIdBase: 'disconnectConnection',
    responses: {
      200: jsonResponse(
        z.object({ success: z.boolean(), deleted: z.boolean() }),
        'Connection disconnected'
      ),
      400: errorResponse('Connection name required'),
      401: errorResponse('Not authenticated'),
      404: errorResponse('Connection not found'),
      500: errorResponse('Failed to disconnect'),
    },
  },
]

export const connectionGroupSpec: ResourceGroupSpec = {
  tagPrefix: 'Connection',
  genericTag: 'connections',
  genericTagDescription: 'External service connection (OAuth) endpoints',
  collection: (app) => app.connections ?? [],
  resourcePlaceholder: '{connectionSlug}',
  genericPlaceholder: '{name}',
  genericParamName: 'name',
  routes,
}
