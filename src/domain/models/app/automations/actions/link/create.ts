/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { LinkUtmSchema } from '../../../links/utm'
import { ActionBaseFields } from '../base'
import {
  LinkActionDestinationSchema,
  LinkActionNotesSchema,
  LinkActionSlugSchema,
  LinkActionTagsSchema,
  LinkActionTitleSchema,
} from './props'

/**
 * Link Action (type: link, operator: create)
 *
 * Mint a tracked short link from a workflow, and hand its address back so the
 * next step can use it. That output is what earns the action its place: without
 * it a workflow could mint a link and have no way to send it to anyone, which
 * is the only reason it was minting one.
 *
 * ── `slug` is REQUIRED, deliberately ────────────────────────────────────────
 *
 * A generated slug was considered and rejected: `POST /api/admin/links` also
 * requires one, and `CreateLinkInput.slug` is non-optional on the port, so an
 * "omit to generate" prop would be a promise only the automation path keeps.
 * The whole reason this action calls the shared write path is that a workflow
 * and the console cannot disagree about what a link is; a create surface only
 * one of them has would reopen that gap at the first field.
 *
 * ── What is deliberately NOT here ───────────────────────────────────────────
 *
 * `targets` (weighted rotation) and the lifecycle fields (`validFrom`,
 * `validUntil`, `maxClicks`, `expiredTo`) are supported by the shared write
 * path but are absent from this surface. Both are additive later. Their cost
 * today is real: `targets` brings an exclusive-or with `destination` that no
 * acceptance criterion exercises, and the lifecycle fields are a datetime and
 * two integers that a template can only produce as strings — a coercion layer
 * bought for a case nothing yet asks for.
 */
export const LinkCreateActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('link').pipe(
    Schema.annotate({
      description: "Constant value 'link' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('create').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'link' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    slug: LinkActionSlugSchema,
    destination: LinkActionDestinationSchema,
    title: Schema.optional(LinkActionTitleSchema),
    tags: Schema.optional(LinkActionTagsSchema),
    notes: Schema.optional(LinkActionNotesSchema),
    /**
     * Campaign parameters, in the same nested shape a config-declared link
     * uses — so one campaign reads identically whether a file or a workflow
     * created the link, and `/api/analytics/campaigns` groups both with no
     * mapping layer.
     */
    utm: Schema.optional(LinkUtmSchema),
  }).annotate({
    description:
      'The short link to create: its slug, its destination, and the notes and tracking kept with it.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'LinkCreateAction',
    title: 'Link Create Action',
    description:
      'Mint a tracked short link and return its address for a later step to use. Fails the step rather than shadowing a config-declared slug or overwriting one a live link already holds.',
  })
)

/** @public */
export type LinkCreateAction = Schema.Schema.Type<typeof LinkCreateActionSchema>
