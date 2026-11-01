/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { optionalField } from '@/domain/kernel/config-parsing/optional-field'

/** One page or article a reader may open that matched the query. */
export const pageSearchHitSchema = Schema.Struct({
  kind: Schema.Literals(['page', 'article']).annotate({ description: 'What the hit is' }),
  url: Schema.String.annotate({ description: 'Address of the page' }),
  title: Schema.String.annotate({ description: 'Title of the page' }),
  excerpt: optionalField(
    Schema.String.annotate({ description: 'Text around the match, on a match in the text' })
  ),
  matchRange: optionalField(
    Schema.Tuple([Schema.Int, Schema.Int]).annotate({
      description: 'Start and end of the match inside the excerpt',
    })
  ),
})

/** Response schema for `GET /api/search/pages`: empty below the selectivity floor. */
export const pageSearchResponseSchema = Schema.Array(pageSearchHitSchema)
