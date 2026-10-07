/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { SCIM_GROUP_SCHEMA, SCIM_USER_SCHEMA } from '@/domain/models/api/scim'
import { SCIM_BASE_PATH, scimJson, toScimList } from './scim-resources'
import type { Hono } from 'hono'

/**
 * SCIM discovery (RFC 7644 §4): what this service provider supports, so an
 * identity provider configures itself. Behind the same token gate as every
 * other SCIM route.
 */

const SERVICE_PROVIDER_CONFIG = {
  schemas: ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'],
  documentationUri: 'https://sovrium.com/docs',
  patch: { supported: true },
  bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
  filter: { supported: true, maxResults: 200 },
  changePassword: { supported: false },
  sort: { supported: false },
  etag: { supported: false },
  authenticationSchemes: [
    {
      type: 'oauthbearertoken',
      name: 'Bearer token',
      description: 'The token declared in auth.scim.token, sent as Authorization: Bearer <token>',
      primary: true,
    },
  ],
} as const

const RESOURCE_TYPES = [
  {
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:ResourceType'],
    id: 'User',
    name: 'User',
    endpoint: '/Users',
    schema: SCIM_USER_SCHEMA,
  },
  {
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:ResourceType'],
    id: 'Group',
    name: 'Group',
    endpoint: '/Groups',
    schema: SCIM_GROUP_SCHEMA,
  },
] as const

const SCHEMAS = [
  { id: SCIM_USER_SCHEMA, name: 'User', description: 'A provisioned account' },
  { id: SCIM_GROUP_SCHEMA, name: 'Group', description: 'A group declared in auth.groups' },
] as const

/** Mount the discovery endpoints. */
export const chainScimDiscoveryRoutes = (hono: Hono): Hono => {
  hono.get(`${SCIM_BASE_PATH}/ServiceProviderConfig`, () => scimJson(SERVICE_PROVIDER_CONFIG))
  hono.get(`${SCIM_BASE_PATH}/ResourceTypes`, () =>
    scimJson(toScimList(RESOURCE_TYPES, RESOURCE_TYPES.length, 1))
  )
  hono.get(`${SCIM_BASE_PATH}/Schemas`, () => scimJson(toScimList(SCHEMAS, SCHEMAS.length, 1)))
  return hono
}
