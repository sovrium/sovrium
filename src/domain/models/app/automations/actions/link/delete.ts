/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ActionBaseFields } from '../base'
import { LinkActionSlugSchema } from './props'

/**
 * Link Action (type: link, operator: delete)
 *
 * Retire a runtime link without erasing it. The row survives, so the click
 * history keyed to that slug survives with it — a hard delete would destroy the
 * campaign record along with the link, which is the one part of a finished
 * campaign anybody still wants a month later.
 *
 * A repeat delete is a no-op rather than a failure: the shared write path
 * reports `changed: false` for a link already retired, so a workflow that runs
 * twice does not fail the second time.
 *
 * `slug` is the only prop, and that is the whole surface: there is nothing to
 * configure about retiring a link.
 */
export const LinkDeleteActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('link').pipe(
    Schema.annotate({
      description: "Constant value 'link' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('delete').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'link' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    slug: LinkActionSlugSchema,
  }).annotate({
    description: 'The short link to delete.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'LinkDeleteAction',
    title: 'Link Delete Action',
    description:
      'Soft-delete a runtime link so it stops resolving while its click history survives. Fails the step for a config-declared slug.',
  })
)

/** @public */
export type LinkDeleteAction = Schema.Schema.Type<typeof LinkDeleteActionSchema>
