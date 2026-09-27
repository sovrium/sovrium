/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'

const NamespaceSchema = Schema.String.pipe(
  Schema.annotate({
    description:
      'Namespace for key isolation (lowercase alphanumeric with hyphens, starts with letter)',
  }),
  Schema.check(Schema.isPattern(/^[a-z][a-z0-9-]*$/))
)

/** Item field read by the step: a plain name or a dot path. */
const ItemFieldSchema = Schema.String.pipe(
  Schema.annotate({ description: 'Field of each item, as a name or a dot path (meta.id).' }),
  Schema.check(Schema.isPattern(/^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$/))
)

/**
 * State Filter-New Action (type: state, operator: filterNew)
 *
 * The polling half of "new transactions since the last run": keep only the
 * items of a list this step has not returned before, identified by `key`,
 * and optionally remember the highest value of a `cursor` field so the next
 * request can ask the API for less. What the step has seen is kept in the
 * app's key-value state, per automation, per step name and per namespace.
 */
export const StateFilterNewActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('state').pipe(
    Schema.annotate({
      description: "Constant value 'state' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('filterNew').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'state' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    input: TemplateStringSchema.pipe(
      Schema.annotate({
        description:
          'Template reference to the list of items, typically the page a previous http step fetched.',
        examples: ['{{steps.fetch.body.transactions}}'],
      })
    ),
    key: ItemFieldSchema.pipe(
      Schema.annotate({
        description:
          'Field that identifies an item. An item whose key this step has returned before is dropped, even if its other fields changed.',
      })
    ),
    cursor: Schema.optional(
      Schema.Struct({
        field: ItemFieldSchema.pipe(
          Schema.annotate({
            description:
              'Field that orders items, an ISO date or a number (settled_at, created_at, id).',
          })
        ),
        stateKey: Schema.String.pipe(
          Schema.annotate({
            description:
              'State key where the highest value seen is stored, in the step namespace. Read it with a state get step before the request to ask the API only for later items.',
          }),
          Schema.check(Schema.isPattern(/^[a-z][a-z0-9-]*$/))
        ),
      }).pipe(
        Schema.annotate({
          description:
            'Remember the highest value of an ordering field. Items at or below the stored value are dropped, and the stored value moves up to the highest value returned.',
        })
      )
    ),
    initial: Schema.optional(
      Schema.Literals(['skip', 'emit']).pipe(
        Schema.annotate({
          defaultNote: 'skip',
          description:
            "What the very first run returns. 'skip': nothing — every item already there is remembered as seen, so switching the automation on does not replay the history. 'emit': every item.",
        })
      )
    ),
    remember: Schema.optional(
      Schema.Finite.pipe(
        Schema.annotate({
          defaultNote: '1000',
          description:
            'How many item keys are kept, the most recent first. Set it above the largest page the API returns.',
        }),
        Schema.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 10_000 }))
      )
    ),
    namespace: Schema.optional(NamespaceSchema),
  }).annotate({
    description:
      'The list to filter, how an item is identified and ordered, and what the first run returns.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'StateFilterNewAction',
    title: 'State Filter-New Action',
    description:
      'Keep only the items this step has not returned before, remembering them between runs',
  })
)

/** @public */
export type StateFilterNewAction = Schema.Schema.Type<typeof StateFilterNewActionSchema>
