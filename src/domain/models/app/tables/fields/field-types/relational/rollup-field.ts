/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import {
  ROLLUP_AGGREGATION_VOCABULARY,
  isVocabularyTerm,
  unknownTermRefusal,
} from '@/domain/models/app/tables/closed-vocabulary'
import { ViewFiltersSchema } from '../../../views/filters'
import { BaseFieldSchema } from '../base-field'

export const RollupFieldSchema = BaseFieldSchema.pipe(
  Schema.extend(
    Schema.Struct({
      type: Schema.Literal('rollup'),
      relationshipField: Schema.String.pipe(
        Schema.nonEmptyString({ message: () => 'relationshipField is required' }),
        Schema.annotations({ description: 'Name of the relationship field to aggregate from' })
      ),
      relatedField: Schema.String.pipe(
        Schema.nonEmptyString({ message: () => 'relatedField is required' }),
        Schema.annotations({ description: 'Name of the field in the related table to aggregate' })
      ),
      aggregation: Schema.String.pipe(
        Schema.annotations({
          description:
            'Aggregation function to apply. One of (case-insensitive): ' +
            `${ROLLUP_AGGREGATION_VOCABULARY.terms.join(', ')}.`,
        })
      ),
      format: Schema.optional(
        Schema.String.pipe(
          Schema.annotations({
            description: 'Display format for the result',
            examples: ['currency', 'number', 'percentage'],
          })
        )
      ),
      filters: Schema.optional(
        ViewFiltersSchema.pipe(
          Schema.annotations({ description: 'Filters to apply before aggregation' })
        )
      ),
    })
  ),
  // ANNOTATIONS FIRST, REFINEMENT SECOND — the order is load-bearing.
  // `JSONSchema.make` renders a struct refinement from its `from` side and DROPS
  // annotations piped after the `Schema.filter`; writing them below silently
  // stripped this node's title, description AND its worked example out of the
  // published `app.json` that every author's editor reads (measured).
  Schema.annotations({
    title: 'Rollup Field',
    description: 'Aggregates values from related records using functions like SUM, AVG, COUNT.',
    examples: [
      {
        id: 1,
        name: 'total_sales',
        type: 'rollup',
        relationshipField: 'orders',
        relatedField: 'amount',
        aggregation: 'SUM',
      },
    ],
  }),
  // The refusal sits on the STRUCT, not on `aggregation`, so it can name the
  // FIELD the term was declared on. A refinement on the string alone sees only
  // the string, and the decoder renders the path as `tables[0].fields[2]` —
  // useless on a config with several rollups, which is exactly the case where a
  // silent SUM is hardest to spot in the first place.
  Schema.filter((field) =>
    isVocabularyTerm(ROLLUP_AGGREGATION_VOCABULARY, field.aggregation)
      ? undefined
      : unknownTermRefusal({
          kind: 'rollup aggregation',
          value: field.aggregation,
          subject: `field "${field.name}"`,
          vocabulary: ROLLUP_AGGREGATION_VOCABULARY,
        })
  )
)

/** @public */
export type RollupField = Schema.Schema.Type<typeof RollupFieldSchema>
