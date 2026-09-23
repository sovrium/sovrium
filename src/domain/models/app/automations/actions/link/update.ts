/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ActionBaseFields } from '../base'
import {
  LinkActionDestinationSchema,
  LinkActionNotesSchema,
  LinkActionSlugSchema,
  LinkActionTagsSchema,
  LinkActionTitleSchema,
  LinkActionUtmPatchSchema,
} from './props'

/**
 * Link Action (type: link, operator: update)
 *
 * Re-point or re-label an existing runtime link, SPARSELY: a prop that is not
 * mentioned is left exactly as it was. That is the same contract
 * `PATCH /api/admin/links/:slug` offers, and it comes from the same place —
 * the shared write path merges the patch against the stored row, so the caller
 * never has to read the link first in order to edit one field of it.
 *
 * `null` is meaningful and distinct from absence on `title` and `notes`:
 * absent leaves the column alone, `null` clears it. Collapsing the two would
 * make an operator note impossible to remove once written.
 *
 * ── `slug` names the target and cannot be changed ───────────────────────────
 *
 * There is no rename. The slug IS the address every share carries and the join
 * key every click event is recorded under, so renaming would break every share
 * already in the world and orphan the history in one move. Retire the link and
 * mint a new one instead — which is exactly what the two sibling operators do.
 *
 * ── A config-declared slug is refused here too ──────────────────────────────
 *
 * Not by this schema, and not by the handler: by the shared use-case, which is
 * the whole point of routing through it. An update path that reserved slugs
 * differently from the create path would be config mutation through a
 * data-shaped side door, arrived at from the direction nobody watches.
 */
export const LinkUpdateActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('link').pipe(
    Schema.annotate({
      description: "Constant value 'link' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('update').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'link' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    slug: LinkActionSlugSchema,
    destination: Schema.optional(LinkActionDestinationSchema),
    // The `NullOr` wrapper is a NEW node and the description on the schema it
    // wraps does not reach it, so each one states its own sparse-edit contract.
    title: Schema.optional(
      Schema.NullOr(LinkActionTitleSchema).annotate({
        description:
          'New human-facing name, shown in the admin console. Templated; `null` clears the name, omitting the key leaves it alone.',
      })
    ),
    tags: Schema.optional(LinkActionTagsSchema),
    notes: Schema.optional(
      Schema.NullOr(LinkActionNotesSchema).annotate({
        description:
          'New operator notes, shown in the admin console only. Templated; `null` clears them, omitting the key leaves them alone.',
      })
    ),
    utm: Schema.optional(LinkActionUtmPatchSchema),
  }).annotate({
    description: 'The short link to change, and the new destination, notes or tracking.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'LinkUpdateAction',
    title: 'Link Update Action',
    description:
      'Apply a sparse edit to an existing runtime link. Omitted props are left unchanged; the slug names the target and cannot be renamed.',
  })
)

/** @public */
export type LinkUpdateAction = Schema.Schema.Type<typeof LinkUpdateActionSchema>
