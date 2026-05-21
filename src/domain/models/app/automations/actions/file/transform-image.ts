/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'
import { DestinationPropSchema } from './shared'

export const FileTransformImageActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('file'),
  operator: Schema.Literal('transformImage'),
  props: Schema.Struct({
    key: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotations({
          description: 'Storage key of the source image',
        })
      )
    ),

    source: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotations({
          description: 'Storage key of the source image',
        })
      )
    ),

    operation: Schema.optional(
      Schema.Literal('resize', 'crop', 'convert').pipe(
        Schema.annotations({
          description: 'Transformation operation: resize, crop, or convert',
        })
      )
    ),

    width: Schema.optional(
      Schema.Number.pipe(
        Schema.positive(),
        Schema.int(),
        Schema.annotations({
          description: 'Target width in pixels (1-2500)',
        })
      )
    ),

    height: Schema.optional(
      Schema.Number.pipe(
        Schema.positive(),
        Schema.int(),
        Schema.annotations({
          description: 'Target height in pixels (1-2500)',
        })
      )
    ),

    x: Schema.optional(
      Schema.Number.pipe(
        Schema.nonNegative(),
        Schema.int(),
        Schema.annotations({
          description: 'Crop region X offset in pixels (operation: crop)',
        })
      )
    ),

    y: Schema.optional(
      Schema.Number.pipe(
        Schema.nonNegative(),
        Schema.int(),
        Schema.annotations({
          description: 'Crop region Y offset in pixels (operation: crop)',
        })
      )
    ),

    fit: Schema.optional(
      Schema.Literal('cover', 'contain', 'fill', 'inside', 'outside').pipe(
        Schema.annotations({
          description: 'Resize fit strategy (default: cover)',
        })
      )
    ),

    outputFormat: Schema.optional(
      Schema.Literal('jpeg', 'png', 'webp', 'avif').pipe(
        Schema.annotations({
          description: 'Output image format (operation: convert)',
        })
      )
    ),

    format: Schema.optional(
      Schema.Literal('jpeg', 'png', 'webp', 'avif').pipe(
        Schema.annotations({
          description: 'Output image format',
        })
      )
    ),

    quality: Schema.optional(
      Schema.Number.pipe(
        Schema.between(1, 100),
        Schema.annotations({
          description: 'Output quality for lossy formats (1-100, default: 80)',
        })
      )
    ),

    crop: Schema.optional(
      Schema.Struct({
        x: Schema.Number,
        y: Schema.Number,
        width: Schema.Number,
        height: Schema.Number,
      }).pipe(
        Schema.annotations({
          description: 'Crop region (x, y, width, height in pixels)',
        })
      )
    ),

    destination: DestinationPropSchema,
  }).pipe(
    Schema.filter((props) => (props.key ?? props.source) !== undefined, {
      message: () => 'transformImage requires `key` (or `source`)',
    })
  ),
}).pipe(
  Schema.annotations({
    identifier: 'FileTransformImageAction',
    title: 'File Transform Image Action',
    description: 'Resize, crop, or convert an image file',
  })
)

export type FileTransformImageAction = Schema.Schema.Type<typeof FileTransformImageActionSchema>
