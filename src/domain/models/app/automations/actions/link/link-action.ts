/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { LinkCreateActionSchema } from './create'
import { LinkDeleteActionSchema } from './delete'
import { LinkUpdateActionSchema } from './update'

/**
 * Link Action — union of the three link lifecycle operators.
 *
 * Every one of them routes through the SAME application use-case the admin
 * console's mutation routes call. That is not a tidiness preference: a handler
 * with its own write path would have to re-derive the reserved-slug and
 * config-declared-slug refusals, and a second copy of a guard is a guard that
 * eventually disagrees with the first. When it does, the direction that fails
 * is this one — an automation minting over a slug the config file owns, weeks
 * before anyone reads a campaign report with a hole in it.
 */
export const LinkActionSchema = Schema.Union([
  LinkCreateActionSchema,
  LinkUpdateActionSchema,
  LinkDeleteActionSchema,
]).pipe(
  Schema.annotate({
    identifier: 'LinkAction',
    title: 'Link Action',
    description:
      'Create, update or soft-delete a tracked short link from a workflow, returning its address for a later step.',
  })
)

/** @public */
export type LinkAction = Schema.Schema.Type<typeof LinkActionSchema>
