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
 * Resize or convert an image file.
 * The transformed file is available as the step output for subsequent actions.
 *
 * ## Cropping is not offered
 *
 * The image pipeline exposes no crop primitive, so this action deliberately
 * declares none: there is no `operation: 'crop'`, no `x` / `y` offsets, and no
 * `crop` region object. A configuration asking for a crop is REJECTED at
 * validation rather than accepted and quietly ignored — the failure a config
 * author can see and fix, instead of one that corrupts every output forever.
 *
 * ## Why `fit` is mandatory for a two-dimension resize
 *
 * Naming both `width` and `height` is ambiguous: the pipeline can either
 * stretch the image to exactly those dimensions (`fill`, distorting it) or
 * scale it down until it fits within them (`inside`, preserving its aspect
 * ratio and therefore usually producing something SMALLER than requested).
 * Neither is a safe default — one silently distorts, the other silently
 * returns different dimensions than asked for — so the author must say which
 * they mean. A single-dimension resize carries no such ambiguity and needs no
 * `fit`.
 */
export const FileTransformImageActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('file').pipe(
    Schema.annotate({
      description: "Constant value 'file' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('transformImage').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'file' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    /** Storage key of the source image */
    key: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotate({
          description: 'Storage key of the source image',
        })
      )
    ),

    /** Storage key of the source image (alias of `key`) */
    source: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotate({
          description: 'Storage key of the source image',
        })
      )
    ),

    /** Transformation operation to perform */
    operation: Schema.optional(
      Schema.Literals(['resize', 'convert']).pipe(
        Schema.annotate({
          description: 'Transformation operation: resize or convert',
        })
      )
    ),

    /** Target width in pixels */
    width: Schema.optional(
      Schema.Finite.pipe(
        Schema.annotate({
          description: 'Target width in pixels (1-2500)',
        }),
        Schema.check(Schema.isGreaterThan(0), Schema.isInt())
      )
    ),

    /** Target height in pixels */
    height: Schema.optional(
      Schema.Finite.pipe(
        Schema.annotate({
          description: 'Target height in pixels (1-2500)',
        }),
        Schema.check(Schema.isGreaterThan(0), Schema.isInt())
      )
    ),

    /** Resize fit strategy — required when both `width` and `height` are set */
    fit: Schema.optional(
      Schema.Literals(['fill', 'inside']).pipe(
        Schema.annotate({
          description:
            'How a two-dimension resize uses the box: `fill` stretches to exactly ' +
            'width x height (distorts); `inside` scales down to fit within the box, ' +
            'preserving the aspect ratio (output may be smaller than requested). ' +
            'Required when both `width` and `height` are set; ignored otherwise.',
        })
      )
    ),

    /**
     * Output image format (operation: convert).
     *
     * `avif` was withdrawn. `Bun.Image`'s `bun` backend — the one that runs on
     * Linux, and so in the compiled binary and the deployment container —
     * ships no AV1 encoder, so an AVIF conversion worked on a maintainer's
     * macOS laptop and failed in production. Because these are LITERALS rather
     * than an open string, a config still naming `avif` is REFUSED by
     * `sovrium validate` and at boot; it is not silently coerced.
     */
    outputFormat: Schema.optional(
      Schema.Literals(['jpeg', 'png', 'webp']).pipe(
        Schema.annotate({
          description: 'Output image format (operation: convert)',
        })
      )
    ),

    /** Output image format (alias of `outputFormat`) */
    format: Schema.optional(
      Schema.Literals(['jpeg', 'png', 'webp']).pipe(
        Schema.annotate({
          description: 'Output image format',
        })
      )
    ),

    /** Output quality for lossy formats */
    quality: Schema.optional(
      Schema.Finite.pipe(
        Schema.annotate({
          description: 'Output quality for lossy formats (1-100, default: 80)',
        }),
        Schema.check(Schema.isBetween({ minimum: 1, maximum: 100 }))
      )
    ),

    /** Storage destination for transformed file */
    destination: DestinationPropSchema,
  })
    .annotate({
      description:
        'The image to transform, the size and fit to produce, the output format, and where it is written.',
    })
    .pipe(
      Schema.check(
        Schema.makeFilter((props) => (props.key ?? props.source) !== undefined, {
          message: 'transformImage requires `key` (or `source`)',
        }),
        Schema.makeFilter(
          (props) =>
            props.width === undefined || props.height === undefined || props.fit !== undefined,
          {
            message:
              'transformImage requires `fit` (`fill` or `inside`) when both `width` and `height` are set',
          }
        )
      )
    ),
}).pipe(
  Schema.annotate({
    identifier: 'FileTransformImageAction',
    title: 'File Transform Image Action',
    description: 'Resize or convert an image file',
  })
)

/** @public */
export type FileTransformImageAction = Schema.Schema.Type<typeof FileTransformImageActionSchema>
