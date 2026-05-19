/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ActionSchema } from '../../../action'

export const GalleryCardSchema = Schema.Struct({
  coverImage: Schema.optional(
    Schema.String.annotations({
      description: 'Image URL or $record.* variable for card cover image',
      examples: ['$record.image', '$record.thumbnail'],
    })
  ),
  aspectRatio: Schema.optional(
    Schema.String.annotations({
      description: 'Cover image aspect ratio (e.g. 4:3, 16:9, 1:1)',
      examples: ['4:3', '16:9', '1:1'],
    })
  ),
  children: Schema.optional(
    Schema.Array(Schema.Record({ key: Schema.String, value: Schema.Unknown })).pipe(
      Schema.minItems(1),
      Schema.annotations({ description: 'Child component definitions for the card body' })
    )
  ),
  onClick: Schema.optional(ActionSchema),
  hoverOverlay: Schema.optional(
    Schema.Struct({
      children: Schema.optional(
        Schema.Array(Schema.Record({ key: Schema.String, value: Schema.Unknown })).pipe(
          Schema.minItems(1),
          Schema.annotations({ description: 'Components rendered in the hover overlay' })
        )
      ),
    }).annotations({ description: 'Overlay content displayed on card hover' })
  ),
}).annotations({
  identifier: 'GalleryCard',
  title: 'Gallery Card',
  description: 'Template configuration for how records render as gallery cards',
})

export type GalleryCard = Schema.Schema.Type<typeof GalleryCardSchema>
