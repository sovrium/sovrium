/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Result, Schema } from 'effect'
import {
  SCIM_ERROR_SCHEMA,
  SCIM_GROUP_SCHEMA,
  SCIM_LIST_RESPONSE_SCHEMA,
  SCIM_USER_SCHEMA,
  type ScimErrorResponse,
  type ScimGroupResponse,
  type ScimListResponse,
  type ScimUserResponse,
} from '@/domain/models/api/scim'
import { splitScimName } from '@/domain/models/app/auth/scim-service'
import type { Context } from 'hono'

/** The media type every SCIM body travels as. */
export const SCIM_MEDIA_TYPE = 'application/scim+json'

/** The base path the SCIM endpoints are mounted under. */
export const SCIM_BASE_PATH = '/api/scim/v2'

/** A user row as SCIM reads it. */
export interface ScimUserRow {
  readonly id: string
  readonly email: string
  readonly name: string
  readonly banned?: boolean | null
  readonly createdAt: Date
  readonly updatedAt: Date
}

/** A declared group as SCIM reads it: the team backing it, and its member ids. */
export interface ScimGroupRow {
  readonly id: string
  readonly name: string
  readonly createdAt: Date
  readonly updatedAt?: Date | null
  readonly memberIds: readonly string[]
}

/** The origin resource locations are written under: `BASE_URL`, else the request's. */
export const scimOrigin = (c: Context): string => {
  const base = (process.env['BASE_URL'] ?? '').replace(/\/+$/, '')
  return base !== '' ? base : new URL(c.req.url).origin
}

const iso = (date: Date | null | undefined): string => (date ?? new Date(0)).toISOString()

/** A user row as a SCIM User resource. */
export const toScimUser = (
  origin: string,
  user: ScimUserRow,
  groups: readonly { readonly id: string; readonly name: string }[]
): ScimUserResponse => {
  const name = splitScimName(user.name)
  return {
    schemas: [SCIM_USER_SCHEMA],
    id: user.id,
    userName: user.email,
    name: { formatted: user.name, ...name },
    displayName: user.name,
    emails: [{ value: user.email, primary: true, type: 'work' }],
    active: user.banned !== true,
    groups: groups.map((group) => ({ value: group.id, display: group.name })),
    meta: {
      resourceType: 'User',
      created: iso(user.createdAt),
      lastModified: iso(user.updatedAt),
      location: `${origin}${SCIM_BASE_PATH}/Users/${user.id}`,
    },
  }
}

/** A declared group as a SCIM Group resource. */
export const toScimGroup = (origin: string, group: ScimGroupRow): ScimGroupResponse => ({
  schemas: [SCIM_GROUP_SCHEMA],
  id: group.id,
  displayName: group.name,
  members: group.memberIds.map((value) => ({ value })),
  meta: {
    resourceType: 'Group',
    created: iso(group.createdAt),
    lastModified: iso(group.updatedAt ?? group.createdAt),
    location: `${origin}${SCIM_BASE_PATH}/Groups/${group.id}`,
  },
})

/** A list response over one page of resources. */
export const toScimList = (
  resources: readonly unknown[],
  totalResults: number,
  startIndex: number
): ScimListResponse => ({
  schemas: [SCIM_LIST_RESPONSE_SCHEMA],
  totalResults,
  startIndex,
  itemsPerPage: resources.length,
  Resources: resources,
})

/** A SCIM JSON response. */
export const scimJson = (
  body: unknown,
  status: 200 | 201 = 200,
  headers: Readonly<Record<string, string>> = {}
): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': SCIM_MEDIA_TYPE, ...headers },
  })

/** A SCIM error response (RFC 7644 §3.12). */
export const scimError = (
  status: 400 | 404 | 409 | 413,
  detail: string,
  scimType?: string
): Response => {
  const body: ScimErrorResponse = {
    schemas: [SCIM_ERROR_SCHEMA],
    status: String(status),
    ...(scimType === undefined ? {} : { scimType }),
    detail,
  }
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': SCIM_MEDIA_TYPE },
  })
}

/**
 * The request body decoded against a SCIM wire schema, or the `400
 * invalidSyntax` error to answer. Read as text and decoded as JSON in one
 * schema step, so nothing downstream sees an unchecked shape.
 */
export const decodeScimBody = async <S extends Schema.Decoder<unknown>>(
  c: Context,
  schema: S,
  what: string
): Promise<S['Type'] | Response> => {
  const decoded = Schema.decodeResult(Schema.fromJsonString(schema))(await c.req.text())
  return Result.isFailure(decoded)
    ? scimError(400, `Not a SCIM ${what}`, 'invalidSyntax')
    : decoded.success
}
