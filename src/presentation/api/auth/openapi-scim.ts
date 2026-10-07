/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import {
  scimErrorResponseSchema,
  scimGroupRequestSchema,
  scimGroupResponseSchema,
  scimListResponseSchema,
  scimPatchRequestSchema,
  scimUserRequestSchema,
  scimUserResponseSchema,
} from '@/domain/models/api/scim'
import {
  effectJsonBody,
  effectJsonResponse,
  effectParameters,
} from '@/presentation/api/openapi/route-fragments'
import { type StaticGroupSpec } from '../openapi/route-spec'

/**
 * SCIM 2.0 provisioning (`/api/scim/v2/*`), served only when `auth.scim` is
 * declared. Every route answers the app's ordinary 404 to a missing or wrong
 * bearer token, and 429 past 60 requests per address per rate-limit window.
 */

const error = (description: string) => effectJsonResponse(scimErrorResponseSchema, description)
const absent = error('No SCIM here: a missing or wrong token, or SCIM not configured')
const idParam = effectParameters(
  Schema.Struct({ id: Schema.String.annotate({ description: 'The Sovrium user or group id' }) }),
  'path'
)

const discovery = (path: string, summary: string, operationIdBase: string) => ({
  method: 'get' as const,
  pathTemplate: `/api/scim/v2/${path}`,
  summary,
  description: 'SCIM discovery (RFC 7644 §4).',
  operationIdBase,
  responses: { 200: effectJsonResponse(Schema.Unknown, summary), 404: absent },
})

/** The SCIM route group. */
export const scimGroup: StaticGroupSpec = {
  tag: 'SCIM',
  tagDescription:
    'SCIM 2.0 user and group provisioning for an identity provider, authenticated by the auth.scim bearer token',
  routes: [
    discovery(
      'ServiceProviderConfig',
      'Service provider configuration',
      'getScimServiceProviderConfig'
    ),
    discovery('ResourceTypes', 'Resource types', 'getScimResourceTypes'),
    discovery('Schemas', 'Schemas', 'getScimSchemas'),
    {
      method: 'get',
      pathTemplate: '/api/scim/v2/Users',
      summary: 'List users',
      description:
        'Lists users, oldest first. Supports filter=userName eq "…", startIndex and count.',
      operationIdBase: 'listScimUsers',
      responses: {
        200: effectJsonResponse(scimListResponseSchema, 'A page of users'),
        400: error('Unsupported filter'),
        404: absent,
      },
    },
    {
      method: 'post',
      pathTemplate: '/api/scim/v2/Users',
      summary: 'Create a user',
      description: 'Creates an account with the default role. A role in the body grants nothing.',
      operationIdBase: 'createScimUser',
      request: { body: effectJsonBody(scimUserRequestSchema) },
      responses: {
        201: effectJsonResponse(scimUserResponseSchema, 'The created user'),
        400: error('Not a SCIM User'),
        404: absent,
        409: error('userName already taken (uniqueness)'),
      },
    },
    {
      method: 'get',
      pathTemplate: '/api/scim/v2/Users/{id}',
      summary: 'Read a user',
      description: 'Reads one user.',
      operationIdBase: 'getScimUser',
      parameters: idParam,
      responses: { 200: effectJsonResponse(scimUserResponseSchema, 'The user'), 404: absent },
    },
    {
      method: 'patch',
      pathTemplate: '/api/scim/v2/Users/{id}',
      summary: 'Update a user',
      description:
        'Changes the name or active flag. active false ends every session and blocks sign-in; it erases nothing. Roles and emails are never changed.',
      operationIdBase: 'patchScimUser',
      parameters: idParam,
      request: { body: effectJsonBody(scimPatchRequestSchema) },
      responses: {
        200: effectJsonResponse(scimUserResponseSchema, 'The updated user'),
        400: error('Not a SCIM PatchOp'),
        404: absent,
        409: error('Would deactivate the last account able to administer the app'),
      },
    },
    {
      method: 'put',
      pathTemplate: '/api/scim/v2/Users/{id}',
      summary: 'Replace a user',
      description: 'Replaces the name and active flag. Roles and emails are never changed.',
      operationIdBase: 'putScimUser',
      parameters: idParam,
      request: { body: effectJsonBody(scimUserRequestSchema) },
      responses: {
        200: effectJsonResponse(scimUserResponseSchema, 'The user'),
        400: error('Not a SCIM User'),
        404: absent,
        409: error('Would deactivate the last account able to administer the app'),
      },
    },
    {
      method: 'delete',
      pathTemplate: '/api/scim/v2/Users/{id}',
      summary: 'Deactivate a user',
      description:
        'Deactivates the account, never erases it: sessions end, sign-in is blocked, records stay.',
      operationIdBase: 'deleteScimUser',
      parameters: idParam,
      responses: {
        204: { description: 'Deactivated' },
        404: absent,
        409: error('Would deactivate the last account able to administer the app'),
      },
    },
    {
      method: 'get',
      pathTemplate: '/api/scim/v2/Groups',
      summary: 'List groups',
      description: 'Lists the groups declared in auth.groups, with their members.',
      operationIdBase: 'listScimGroups',
      responses: {
        200: effectJsonResponse(scimListResponseSchema, 'The declared groups'),
        404: absent,
      },
    },
    {
      method: 'post',
      pathTemplate: '/api/scim/v2/Groups',
      summary: 'Adopt a declared group',
      description:
        'Adopts a group declared in auth.groups, optionally setting its members. Any other name is refused (invalidValue).',
      operationIdBase: 'createScimGroup',
      request: { body: effectJsonBody(scimGroupRequestSchema) },
      responses: {
        201: effectJsonResponse(scimGroupResponseSchema, 'The group'),
        400: error('Undeclared group (invalidValue) or not a SCIM Group'),
        404: absent,
      },
    },
    {
      method: 'get',
      pathTemplate: '/api/scim/v2/Groups/{id}',
      summary: 'Read a group',
      description: 'Reads one declared group.',
      operationIdBase: 'getScimGroup',
      parameters: idParam,
      responses: { 200: effectJsonResponse(scimGroupResponseSchema, 'The group'), 404: absent },
    },
    {
      method: 'patch',
      pathTemplate: '/api/scim/v2/Groups/{id}',
      summary: "Change a group's members",
      description: 'Adds, removes or replaces members of a declared group. Each change is audited.',
      operationIdBase: 'patchScimGroup',
      parameters: idParam,
      request: { body: effectJsonBody(scimPatchRequestSchema) },
      responses: {
        200: effectJsonResponse(scimGroupResponseSchema, 'The group'),
        400: error('Not a SCIM PatchOp, or an unsupported path'),
        404: absent,
      },
    },
    {
      method: 'put',
      pathTemplate: '/api/scim/v2/Groups/{id}',
      summary: "Replace a group's members",
      description: 'Replaces the members of a declared group. A declared group cannot be renamed.',
      operationIdBase: 'putScimGroup',
      parameters: idParam,
      request: { body: effectJsonBody(scimGroupRequestSchema) },
      responses: {
        200: effectJsonResponse(scimGroupResponseSchema, 'The group'),
        400: error('Not a SCIM Group, or a rename'),
        404: absent,
      },
    },
  ],
}
