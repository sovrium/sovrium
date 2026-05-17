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
    source: TemplateStringSchema.pipe(
      Schema.annotations({
        description: 'Storage key of the source image',
      })
    ),

    /** Target width in pixels */
    width: Schema.optional(
      Schema.Number.pipe(
        Schema.positive(),
        Schema.int(),
        Schema.annotations({
          description: 'Target width in pixels (1-2500)',
        })
      )
    ),

    /** Target height in pixels */
    height: Schema.optional(
      Schema.Number.pipe(
        Schema.positive(),
        Schema.int(),
        Schema.annotations({
          description: 'Target height in pixels (1-2500)',
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

    /** Output image format */
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

    /** Crop region */
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
  }),
}).pipe(
  Schema.annotations({
    identifier: 'FileTransformImageAction',
    title: 'File Transform Image Action',
    description: 'Resize, crop, or convert an image file',
  })
)

/** @public */
export type FileTransformImageAction = Schema.Schema.Type<typeof FileTransformImageActionSchema>
