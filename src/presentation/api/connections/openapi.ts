/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { errorResponseSchema } from '@/domain/models/api/combinators/error'
import { connectionUsersResponseSchema } from '@/domain/models/api/connections'
import { effectJsonResponse, effectParameters } from '@/presentation/api/openapi/route-fragments'
import { type ResourceGroupSpec, type RouteSpec } from '../openapi/route-spec'

/**
 * Connection routes — resource-scoped to `app.connections`. Each configured
 * connection expands into a concrete copy of every route below, tagged
 * `Connection: <name>`.
 */

const errorResponse = (description: string) => effectJsonResponse(errorResponseSchema, description)

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

    parameters: effectParameters(
      Schema.Struct({
        code: Schema.String.annotate({ description: 'OAuth authorization code' }),
        state: Schema.String.annotate({ description: 'OAuth state token' }),
      }),
      'query'
    ),
    responses: {
      200: effectJsonResponse(
        Schema.Struct({
          success: Schema.Boolean,
          connectionId: Schema.String,
        }),
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
      200: effectJsonResponse(
        Schema.Struct({
          name: Schema.String,
          type: Schema.String,
          status: Schema.Literals(['connected', 'disconnected', 'expired']),
          connected: Schema.Boolean,
          expiresAt: Schema.NullOr(Schema.String),
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
      200: effectJsonResponse(connectionUsersResponseSchema, 'Connected users'),
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
      200: effectJsonResponse(
        Schema.Struct({
          success: Schema.Boolean,
          deleted: Schema.Boolean,
        }),
        'Connection disconnected'
      ),
      400: errorResponse('Connection name required'),
      401: errorResponse('Not authenticated'),
      404: errorResponse('Connection not found'),
      500: errorResponse('Failed to disconnect'),
    },
  },
]

/** Connection route group — resource-scoped to the configured connections. */
export const connectionGroupSpec: ResourceGroupSpec = {
  tagPrefix: 'Connection',
  genericTag: 'Connections',
  genericTagDescription: 'External service connection (OAuth) endpoints',
  collection: (app) => app.connections ?? [],
  resourcePlaceholder: '{connectionSlug}',
  genericPlaceholder: '{name}',
  genericParamName: 'name',
  routes,
}
