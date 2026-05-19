/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from '@hono/zod-openapi'
import { errorResponseSchema } from '@/domain/models/api/_shared/error'
import { shapedLinkSchema } from '@/domain/models/api/pages/share'
import { type RouteSpec, type StaticGroupSpec, jsonResponse } from './_shared/route-spec'


const errorResponse = (description: string) => jsonResponse(errorResponseSchema, description)
const publicError = (description: string) =>
  jsonResponse(z.object({ error: z.string() }), description)

const pageNameParam = z.object({ name: z.string().describe('Page name') })
const tokenParam = z.object({
  name: z.string().describe('Page name'),
  token: z.string().describe('Share-link token'),
})

const routes: readonly RouteSpec[] = [
  {
    method: 'post',
    pathTemplate: '/api/pages/{name}/share',
    summary: 'Create a share link',
    description: 'Creates a share link for a page, optionally password-protected and time-limited.',
    operationIdBase: 'createShareLink',
    request: {
      params: pageNameParam,
      body: {
        content: {
          'application/json': {
            schema: z.object({
              password: z.string().optional(),
              expiresIn: z.string().optional().describe('Relative duration, e.g. "7d"'),
              embedAllowed: z.boolean().optional(),
            }),
          },
        },
      },
    },
    responses: {
      201: jsonResponse(shapedLinkSchema, 'Share link created'),
      400: errorResponse('Missing page name'),
      401: errorResponse('Not authenticated'),
      500: errorResponse('Failed to create the share link'),
    },
  },
  {
    method: 'get',
    pathTemplate: '/api/pages/{name}/share',
    summary: 'List share links',
    description: 'Lists all share links for a page.',
    operationIdBase: 'listShareLinks',
    request: { params: pageNameParam },
    responses: {
      200: jsonResponse(z.object({ links: z.array(shapedLinkSchema) }), 'Share-link list'),
      400: errorResponse('Missing page name'),
      401: errorResponse('Not authenticated'),
      500: errorResponse('Failed to list share links'),
    },
  },
  {
    method: 'patch',
    pathTemplate: '/api/pages/{name}/share/{token}',
    summary: 'Update a share link',
    description: 'Updates a share link. A null password or expiry clears that setting.',
    operationIdBase: 'updateShareLink',
    request: {
      params: tokenParam,
      body: {
        content: {
          'application/json': {
            schema: z.object({
              password: z.string().nullable().optional(),
              expiresIn: z.string().nullable().optional(),
              embedAllowed: z.boolean().optional(),
            }),
          },
        },
      },
    },
    responses: {
      200: jsonResponse(shapedLinkSchema, 'Share link updated'),
      400: errorResponse('Missing token'),
      401: errorResponse('Not authenticated'),
      404: errorResponse('Share link not found'),
      500: errorResponse('Failed to update the share link'),
    },
  },
  {
    method: 'delete',
    pathTemplate: '/api/pages/{name}/share/{token}',
    summary: 'Revoke a share link',
    description: 'Revokes a share link so it can no longer be used.',
    operationIdBase: 'revokeShareLink',
    request: { params: tokenParam },
    responses: {
      200: jsonResponse(
        z.object({ success: z.literal(true), revoked: z.boolean() }),
        'Share link revoked'
      ),
      400: errorResponse('Missing token'),
      401: errorResponse('Not authenticated'),
      500: errorResponse('Failed to revoke the share link'),
    },
  },
  {
    method: 'get',
    pathTemplate: '/shared/{token}',
    summary: 'Resolve a shared link',
    description: 'Public endpoint that resolves a share token to its page and access status.',
    operationIdBase: 'resolveSharedLink',
    request: { params: z.object({ token: z.string().describe('Share-link token') }) },
    responses: {
      200: jsonResponse(
        z.object({
          pageName: z.string(),
          embedAllowed: z.boolean(),
          passwordProtected: z.literal(false),
        }),
        'Shared page accessible'
      ),
      400: publicError('Token required'),
      401: jsonResponse(
        z.object({
          error: z.literal('password_required'),
          passwordProtected: z.literal(true),
          embedAllowed: z.boolean(),
        }),
        'Password required'
      ),
      404: publicError('Not found, revoked, or expired'),
      500: publicError('Failed to resolve the link'),
    },
  },
  {
    method: 'post',
    pathTemplate: '/shared/{token}/auth',
    summary: 'Authenticate a shared link',
    description: 'Public endpoint that verifies the password for a protected shared link.',
    operationIdBase: 'authenticateSharedLink',
    request: {
      params: z.object({ token: z.string().describe('Share-link token') }),
      body: {
        content: { 'application/json': { schema: z.object({ password: z.string() }) } },
      },
    },
    responses: {
      200: jsonResponse(z.object({ success: z.literal(true) }), 'Authenticated'),
      400: publicError('Token or password required'),
      401: publicError('Wrong password'),
      404: publicError('Not found'),
      500: publicError('Authentication failed'),
    },
  },
  {
    method: 'post',
    pathTemplate: '/shared/{token}/submit',
    summary: 'Submit a shared form',
    description: 'Public endpoint that submits a form embedded in a shared page.',
    operationIdBase: 'submitSharedForm',
    request: {
      params: z.object({ token: z.string().describe('Share-link token') }),
      body: { content: { 'application/json': { schema: z.record(z.string(), z.unknown()) } } },
    },
    responses: {
      201: jsonResponse(z.object({ success: z.literal(true), id: z.string() }), 'Form submitted'),
      400: publicError('Token required'),
      403: publicError('Form submissions disabled'),
      404: publicError('Not found'),
      422: publicError('Submission invalid'),
      429: publicError('Rate limited'),
      500: publicError('Submission failed'),
    },
  },
]

export const shareLinkGroup: StaticGroupSpec = {
  tag: 'share-links',
  tagDescription: 'Page share-link creation and public access endpoints',
  routes,
}
