/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { isoDateTime } from '@/domain/models/api/combinators/formats'
import { optionalField } from '@/domain/models/api/combinators/optional-field'

/**
 * SCIM 2.0 wire contracts (RFC 7643 resources, RFC 7644 protocol) for the
 * provisioning endpoints mounted under `/api/scim/v2/`. Bodies travel as
 * `application/scim+json`.
 */

/** The core User resource schema URN. */
export const SCIM_USER_SCHEMA = 'urn:ietf:params:scim:schemas:core:2.0:User'
/** The core Group resource schema URN. */
export const SCIM_GROUP_SCHEMA = 'urn:ietf:params:scim:schemas:core:2.0:Group'
/** The list-response message URN. */
export const SCIM_LIST_RESPONSE_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:ListResponse'
/** The PATCH message URN. */
export const SCIM_PATCH_OP_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:PatchOp'
/** The error message URN. */
export const SCIM_ERROR_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:Error'

/** Resource metadata (RFC 7643 §3.1). */
export const scimMetaSchema = Schema.Struct({
  resourceType: Schema.Literals(['User', 'Group']).annotate({
    description: 'The resource type',
  }),
  created: isoDateTime({ description: 'When the resource was created' }),
  lastModified: isoDateTime({ description: 'When the resource last changed' }),
  location: Schema.String.annotate({ description: 'The canonical URL of the resource' }),
}).annotate({ description: 'Resource metadata' })

/** A user's name components (RFC 7643 §4.1.1). */
export const scimNameSchema = Schema.Struct({
  formatted: optionalField(Schema.String.annotate({ description: 'The full name, as displayed' })),
  givenName: optionalField(Schema.String.annotate({ description: 'The first name' })),
  familyName: optionalField(Schema.String.annotate({ description: 'The last name' })),
}).annotate({ description: 'The components of the user name' })

/** One email address of a user. */
export const scimEmailSchema = Schema.Struct({
  value: Schema.String.annotate({ description: 'The email address' }),
  primary: optionalField(
    Schema.Boolean.annotate({ description: 'Whether this is the primary address' })
  ),
  type: optionalField(Schema.String.annotate({ description: 'A label such as work' })),
}).annotate({ description: 'An email address' })

/** A reference from a user to a group it belongs to, or from a group to a member. */
export const scimMemberReferenceSchema = Schema.Struct({
  value: Schema.String.annotate({ description: 'The id of the referenced resource' }),
  display: optionalField(Schema.String.annotate({ description: 'Its display name' })),
}).annotate({ description: 'A reference to another SCIM resource' })

/** The User resource as a request body (POST, PUT). */
export const scimUserRequestSchema = Schema.Struct({
  schemas: Schema.Array(Schema.String).annotate({
    description: `Must contain ${SCIM_USER_SCHEMA}`,
  }),
  externalId: optionalField(
    Schema.String.annotate({ description: 'The identity provider id for this user' })
  ),
  userName: Schema.String.annotate({
    description: 'The unique sign-in name; Sovrium uses it as the email when emails is absent',
  }).check(Schema.isMinLength(1)),
  name: optionalField(scimNameSchema),
  displayName: optionalField(Schema.String.annotate({ description: 'The display name' })),
  emails: optionalField(
    Schema.Array(scimEmailSchema).annotate({ description: 'The email addresses' })
  ),
  active: optionalField(
    Schema.Boolean.annotate({
      description: 'false deactivates: every session ends and sign-in is blocked',
    })
  ),
}).annotate({ description: 'A SCIM User, as sent by the identity provider' })

/** @public */
export type ScimUserRequest = Schema.Schema.Type<typeof scimUserRequestSchema>

/** The User resource as returned. */
export const scimUserResponseSchema = Schema.Struct({
  schemas: Schema.Array(Schema.String).annotate({ description: 'The resource schema URNs' }),
  id: Schema.String.annotate({ description: 'The Sovrium user id' }),
  externalId: optionalField(
    Schema.String.annotate({ description: 'The identity provider id for this user' })
  ),
  userName: Schema.String.annotate({ description: 'The unique sign-in name' }),
  name: optionalField(scimNameSchema),
  displayName: optionalField(Schema.String.annotate({ description: 'The display name' })),
  emails: Schema.Array(scimEmailSchema).annotate({ description: 'The email addresses' }),
  active: Schema.Boolean.annotate({ description: 'Whether the user may sign in' }),
  groups: Schema.Array(scimMemberReferenceSchema).annotate({
    description: 'The groups the user belongs to (read-only)',
  }),
  meta: scimMetaSchema,
}).annotate({ description: 'A SCIM User' })

/** @public */
export type ScimUserResponse = Schema.Schema.Type<typeof scimUserResponseSchema>

/** The Group resource as a request body (POST, PUT). */
export const scimGroupRequestSchema = Schema.Struct({
  schemas: Schema.Array(Schema.String).annotate({
    description: `Must contain ${SCIM_GROUP_SCHEMA}`,
  }),
  externalId: optionalField(
    Schema.String.annotate({ description: 'The identity provider id for this group' })
  ),
  displayName: Schema.String.annotate({
    description: 'The group name; must match a group declared in auth.groups',
  }).check(Schema.isMinLength(1)),
  members: optionalField(
    Schema.Array(scimMemberReferenceSchema).annotate({ description: 'The member user ids' })
  ),
}).annotate({ description: 'A SCIM Group, as sent by the identity provider' })

/** @public */
export type ScimGroupRequest = Schema.Schema.Type<typeof scimGroupRequestSchema>

/** The Group resource as returned. */
export const scimGroupResponseSchema = Schema.Struct({
  schemas: Schema.Array(Schema.String).annotate({ description: 'The resource schema URNs' }),
  id: Schema.String.annotate({ description: 'The Sovrium group id' }),
  externalId: optionalField(
    Schema.String.annotate({ description: 'The identity provider id for this group' })
  ),
  displayName: Schema.String.annotate({ description: 'The group name' }),
  members: Schema.Array(scimMemberReferenceSchema).annotate({ description: 'The members' }),
  meta: scimMetaSchema,
}).annotate({ description: 'A SCIM Group' })

/** @public */
export type ScimGroupResponse = Schema.Schema.Type<typeof scimGroupResponseSchema>

/** One PATCH operation (RFC 7644 §3.5.2). `op` is matched case-insensitively. */
export const scimPatchOperationSchema = Schema.Struct({
  op: Schema.String.annotate({
    description: 'add, remove or replace, matched case-insensitively',
    examples: ['replace', 'add', 'Remove'],
  }),
  path: optionalField(
    Schema.String.annotate({
      description: 'The attribute path, such as active or members',
      examples: ['active', 'members', 'members[value eq "2819c223"]'],
    })
  ),
  value: optionalField(Schema.Unknown.annotate({ description: 'The value to apply' })),
}).annotate({ description: 'A SCIM PATCH operation' })

/** A PATCH request body. */
export const scimPatchRequestSchema = Schema.Struct({
  schemas: Schema.Array(Schema.String).annotate({
    description: `Must contain ${SCIM_PATCH_OP_SCHEMA}`,
  }),
  Operations: Schema.Array(scimPatchOperationSchema).annotate({
    description: 'The operations, applied in order',
  }),
}).annotate({ description: 'A SCIM PATCH request' })

/** @public */
export type ScimPatchRequest = Schema.Schema.Type<typeof scimPatchRequestSchema>

/** A list response (RFC 7644 §3.4.2). */
export const scimListResponseSchema = Schema.Struct({
  schemas: Schema.Array(Schema.String).annotate({
    description: `Contains ${SCIM_LIST_RESPONSE_SCHEMA}`,
  }),
  totalResults: Schema.Number.annotate({
    description: 'How many resources match the query',
  }).check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)),
  startIndex: Schema.Number.annotate({
    description: 'The 1-based index of the first resource returned',
  }).check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(1)),
  itemsPerPage: Schema.Number.annotate({
    description: 'How many resources this page returns',
  }).check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)),
  Resources: Schema.Array(Schema.Unknown).annotate({
    description: 'The User or Group resources of this page',
  }),
}).annotate({ description: 'A SCIM list response' })

/** @public */
export type ScimListResponse = Schema.Schema.Type<typeof scimListResponseSchema>

/** An error response (RFC 7644 §3.12). */
export const scimErrorResponseSchema = Schema.Struct({
  schemas: Schema.Array(Schema.String).annotate({ description: `Contains ${SCIM_ERROR_SCHEMA}` }),
  status: Schema.String.annotate({
    description: 'The HTTP status, as a string',
    examples: ['400'],
  }),
  scimType: optionalField(
    Schema.String.annotate({
      description: 'The SCIM error type',
      examples: ['invalidValue', 'uniqueness', 'invalidFilter'],
    })
  ),
  detail: optionalField(Schema.String.annotate({ description: 'A human-readable explanation' })),
}).annotate({ description: 'A SCIM error' })

/** @public */
export type ScimErrorResponse = Schema.Schema.Type<typeof scimErrorResponseSchema>
