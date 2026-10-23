/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { looseIsoDateTime } from '@/domain/models/api/combinators/formats'

/**
 * Wire contracts of the link previews a `bubble` with `linkPreviews: true`
 * draws under a stored message.
 *
 * ## No route takes an address from a reader
 *
 * A preview is computed by the SERVER, in the background, for the addresses
 * found in a record when it is stored, through the guarded egress. The routes
 * below are READS of that cache, and both are scoped to a record the caller may
 * read: `GET /api/tables/{table}/records/{id}/link-previews` lists the cards of
 * the addresses that record holds, and
 * `GET /api/tables/{table}/records/{id}/link-previews/{previewId}` serves the
 * card's picture. A record the caller may not read answers 404, like the
 * record itself. Neither route accepts an address, so neither can make the
 * server fetch anything, and neither can be asked whether some address was ever
 * posted somewhere — a cache keyed by address and readable by address would
 * answer that.
 *
 * ## Text only, and capped
 *
 * A card is the parsed `<head>` fields of a public page, each length-capped,
 * escaped where drawn, never the page's HTML. Its picture is never the third
 * party's address: the server fetched it once, through the same guard, checked
 * it is an `image/*` within {@link LINK_PREVIEW_IMAGE_MAX_BYTES}, and serves it
 * from the app, so the reader's browser never contacts the other site.
 */

/** How long a successful read of an address is reused, in seconds (24 hours). @public */
export const LINK_PREVIEW_TTL_SECONDS = 86_400

/** How long a failed read is remembered before the address is tried again, in seconds (one hour). @public */
export const LINK_PREVIEW_FAILURE_TTL_SECONDS = 3600

/** The most of a page read to find its `<head>` fields, in bytes. @public */
export const LINK_PREVIEW_HEAD_MAX_BYTES = 262_144

/** The largest picture the app keeps and serves for a card, in bytes. @public */
export const LINK_PREVIEW_IMAGE_MAX_BYTES = 2_097_152

/** The longest title, description and site name a card keeps. @public */
export const LINK_PREVIEW_FIELD_MAX_LENGTH = {
  title: 300,
  description: 1000,
  siteName: 100,
} as const

/**
 * The id of a cached preview: the SHA-256 of its normalised address, in hex.
 * Normalised means scheme and host lower-cased, the default port and the
 * fragment dropped — so one page posted twice with two spellings is read once.
 */
const previewIdSchema = Schema.String.annotate({
  description:
    'The id of a cached preview: the SHA-256 of its normalised address, in lower-case hex.',
}).pipe(Schema.check(Schema.isPattern(/^[0-9a-f]{64}$/)))

/** One card, as the record's previews list it. @public */
export const linkPreviewSchema = Schema.Struct({
  id: previewIdSchema,
  url: Schema.String.annotate({
    description:
      'The address as it appears in the message, http or https. The card links to it; the server never fetches it again for a reader.',
  }),
  title: Schema.NullOr(
    Schema.String.annotate({
      description:
        "The page's title (`og:title`, else `<title>`), at most 300 characters. `null` when it has none.",
    }).pipe(Schema.check(Schema.isMaxLength(LINK_PREVIEW_FIELD_MAX_LENGTH.title)))
  ),
  description: Schema.NullOr(
    Schema.String.annotate({
      description:
        "The page's description (`og:description`, else `<meta name=description>`), at most 1000 characters. `null` when it has none.",
    }).pipe(Schema.check(Schema.isMaxLength(LINK_PREVIEW_FIELD_MAX_LENGTH.description)))
  ),
  siteName: Schema.NullOr(
    Schema.String.annotate({
      description:
        "The site's name (`og:site_name`), at most 100 characters. `null` when it has none.",
    }).pipe(Schema.check(Schema.isMaxLength(LINK_PREVIEW_FIELD_MAX_LENGTH.siteName)))
  ),
  imageUrl: Schema.NullOr(
    Schema.String.annotate({
      description:
        "Where the card's picture is served FROM THE APP: `/api/tables/{table}/records/{id}/link-previews/{previewId}`. Never the third party's address. `null` when the page names no picture, or its picture was refused (not an image, or too large).",
    }).pipe(
      Schema.check(
        Schema.isPattern(/^\/api\/tables\/[^/]+\/records\/[^/]+\/link-previews\/[0-9a-f]{64}$/)
      )
    )
  ),
  fetchedAt: looseIsoDateTime({ description: 'When the server read the page.' }),
}).annotate({ strictKeys: true, title: 'sovrium:strict-keys', identifier: 'LinkPreview' })

/** @public */
export type LinkPreview = typeof linkPreviewSchema.Type

/**
 * `GET /api/tables/{table}/records/{id}/link-previews` — the cards of the
 * addresses the record holds, in the order they appear. An address not read
 * yet, or whose read failed, has no card. @public
 */
export const linkPreviewListResponseSchema = Schema.Struct({
  previews: Schema.Array(linkPreviewSchema).annotate({
    description:
      'One card per address of the record that was read successfully, in the order the addresses appear.',
  }),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'LinkPreviewListResponse',
})

/** @public */
export type LinkPreviewListResponse = typeof linkPreviewListResponseSchema.Type

/**
 * Path parameters of the picture route. The table and the record are the
 * caller's read gate; the preview id must be one of that record's cards, or the
 * route answers 404. @public
 */
export const linkPreviewImageParamsSchema = Schema.Struct({
  table: Schema.String.annotate({ description: 'The table holding the message.' }),
  id: Schema.String.annotate({ description: 'The id of the message record.' }),
  previewId: previewIdSchema,
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'LinkPreviewImageParams',
})

/** @public */
export type LinkPreviewImageParams = typeof linkPreviewImageParamsSchema.Type
