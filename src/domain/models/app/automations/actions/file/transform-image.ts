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

/**
 * File Transform Image Action (type: file, operator: transformImage)
 *
 * Resize, crop, or convert an image file.
 * The transformed file is available as the step output for subsequent actions.
 */
export const FileTransformImageActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('file'),
  operator: Schema.Literal('transformImage'),
  props: Schema.Struct({
    /** Storage key of the source image */
    key: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotations({
          description: 'Storage key of the source image',
        })
      )
    ),

    /** Storage key of the source image (alias of `key`) */
    source: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotations({
          description: 'Storage key of the source image',
        })
      )
    ),

    /** Transformation operation to perform */
    operation: Schema.optional(
      Schema.Literal('resize', 'crop', 'convert').pipe(
        Schema.annotations({
          description: 'Transformation operation: resize, crop, or convert',
        })
      )
    ),

    /** Target width in pixels (resize) or crop region width */
    width: Schema.optional(
      Schema.Number.pipe(
        Schema.positive(),
        Schema.int(),
        Schema.annotations({
          description: 'Target width in pixels (1-2500)',
        })
      )
    ),

    /** Target height in pixels (resize) or crop region height */
    height: Schema.optional(
      Schema.Number.pipe(
        Schema.positive(),
        Schema.int(),
        Schema.annotations({
          description: 'Target height in pixels (1-2500)',
        })
      )
    ),

    /** Crop region X offset in pixels (operation: crop) */
    x: Schema.optional(
      Schema.Number.pipe(
        Schema.nonNegative(),
        Schema.int(),
        Schema.annotations({
          description: 'Crop region X offset in pixels (operation: crop)',
        })
      )
    ),

    /** Crop region Y offset in pixels (operation: crop) */
    y: Schema.optional(
      Schema.Number.pipe(
        Schema.nonNegative(),
        Schema.int(),
        Schema.annotations({
          description: 'Crop region Y offset in pixels (operation: crop)',
        })
      )
    ),

    /** Resize fit strategy */
    fit: Schema.optional(
      Schema.Literal('cover', 'contain', 'fill', 'inside', 'outside').pipe(
        Schema.annotations({
          description: 'Resize fit strategy (default: cover)',
        })
      )
    ),

    /** Output image format (operation: convert) */
    outputFormat: Schema.optional(
      Schema.Literal('jpeg', 'png', 'webp', 'avif').pipe(
        Schema.annotations({
          description: 'Output image format (operation: convert)',
        })
      )
    ),

    /** Output image format (alias of `outputFormat`) */
    format: Schema.optional(
      Schema.Literal('jpeg', 'png', 'webp', 'avif').pipe(
        Schema.annotations({
          description: 'Output image format',
        })
      )
    ),

    /** Output quality for lossy formats */
    quality: Schema.optional(
      Schema.Number.pipe(
        Schema.between(1, 100),
        Schema.annotations({
          description: 'Output quality for lossy formats (1-100, default: 80)',
        })
      )
    ),

    /** Crop region (alternative to top-level x/y/width/height) */
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

    /** Storage destination for transformed file */
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

/** @public */
export type FileTransformImageAction = Schema.Schema.Type<typeof FileTransformImageActionSchema>
