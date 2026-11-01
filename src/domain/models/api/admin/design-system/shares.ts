/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * API contract for `GET /api/admin/design-system/shares` — the live
 * public-share links of the design system, METADATA ONLY.
 *
 * Encodes the body the `design-system.shares.list` read
 * (`application/use-cases/design/specimen-share-read-operations.ts`)
 * answers:
 * `{ items, total }`, each row `{ id, createdAt }`, newest first.
 *
 * ─── WHAT THE ROW DELIBERATELY DOES NOT CARRY ──────────────────────────────
 *
 * No `token`, no `url`, no `tokenHash`, no `createdBy`. The plaintext token is
 * emitted exactly once, by the `POST` that mints it, and only its SHA-256
 * digest is stored; the share URL IS the token, so a URL here would be the
 * token by another name. An operator who lost a link revokes it and mints
 * another — which is what keeps the link revocable. The response is
 * `strictKeys`, so a future field that smuggled any of those back would fail
 * decoding rather than ship.
 *
 * Takes no query parameter.
 */

import { Schema } from 'effect'
import { looseIsoDateTime } from '@/domain/kernel/config-parsing/formats'

/** One live share, as listed: its id and when it was minted. */
const designSystemShareItemSchema = Schema.Struct({
  id: Schema.String.annotate({
    description:
      'The share id: what `DELETE /api/admin/design-system/shares/:id` revokes. Not the token, and not derivable into it.',
  }).pipe(Schema.check(Schema.isMinLength(1))),
  createdAt: looseIsoDateTime({
    description: 'ISO 8601 time the share was minted.',
  }),
}).annotate({ identifier: 'DesignSystemShareItem' })

/**
 * Response schema for `GET /api/admin/design-system/shares`.
 */
export const designSystemSharesResponseSchema = Schema.Struct({
  items: Schema.Array(designSystemShareItemSchema).annotate({
    description:
      'Every live (unrevoked) share of this app, newest first. Metadata only: never the token or the share URL.',
  }),
  total: Schema.Int.annotate({
    description: 'How many shares this response carries.',
  }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'DesignSystemSharesResponse',
})

/** @public */
export type DesignSystemShareItem = typeof designSystemShareItemSchema.Type
/** @public */
export type DesignSystemSharesResponse = typeof designSystemSharesResponseSchema.Type

/**
 * `POST /api/admin/design-system/shares` (HTTP 201): a new share. This is the
 * one response that carries the plaintext token, in the one answer the operator
 * asked for by taking an action.
 */
export const designSystemShareMintResponseSchema = Schema.Struct({
  id: Schema.String.annotate({
    description: 'The share id: what `DELETE /api/admin/design-system/shares/:id` revokes.',
  }).pipe(Schema.check(Schema.isMinLength(1))),
  createdAt: looseIsoDateTime({ description: 'ISO 8601 time the share was minted.' }),
  token: Schema.String.annotate({
    description: 'The share token, shown this once. Only its digest is stored.',
  }).pipe(Schema.check(Schema.isMinLength(1))),
  url: Schema.String.annotate({ description: 'The public link the token opens.' }),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'DesignSystemShareMintResponse',
})

/** @public */
export type DesignSystemShareMintResponse = typeof designSystemShareMintResponseSchema.Type

/**
 * `DELETE /api/admin/design-system/shares/:id`: the share is revoked.
 */
export const designSystemShareRevokeResponseSchema = Schema.Struct({
  success: Schema.Literal(true).annotate({ description: 'The revocation took effect.' }),
  id: Schema.String.annotate({ description: 'The revoked share id.' }),
  revoked: Schema.Literal(true).annotate({ description: 'The share link no longer opens.' }),
}).annotate({ identifier: 'DesignSystemShareRevokeResponse' })

/** @public */
export type DesignSystemShareRevokeResponse = typeof designSystemShareRevokeResponseSchema.Type
