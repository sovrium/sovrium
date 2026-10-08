/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ActionBaseFields } from '../base'
import {
  AllowRemoteAssetsSchema,
  DocumentOutputSchema,
  HtmlTemplateSourceSchema,
  TemplateDataSchema,
  TemplateLocaleSchema,
} from './shared'

/** A pixel dimension of the rendered image. */
const PixelsSchema = (description: string) =>
  Schema.Finite.pipe(
    Schema.annotate({ description }),
    Schema.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 8192 }))
  )

/**
 * Document Generate Image Action (type: document, operator: generateImage)
 *
 * Render an SVG or HTML template, filled from `data`, into a PNG, JPEG or WebP.
 *
 * - An SVG template is rasterised inside the binary and needs no engine.
 *   `width` or `height` alone scales it and keeps its proportions.
 * - An HTML template is rendered by the browser engine (`RENDERER_*`) at a
 *   `width` × `height` viewport; with no engine the step fails with
 *   `renderer_unavailable`.
 *
 * Which one a template is: `templateType` when set, else the asset's kind or
 * the key's extension, else — for an inline template — its first element
 * (`<svg` means SVG).
 */
export const DocumentGenerateImageActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('document').pipe(
    Schema.annotate({
      description: "Constant value 'document' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('generateImage').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'document' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    template: HtmlTemplateSourceSchema,
    templateType: Schema.optional(
      Schema.Literals(['svg', 'html']).pipe(
        Schema.annotate({
          description:
            'Whether the template is SVG (rendered in the binary) or HTML (rendered by the browser engine). Omit it to infer from the asset kind, the key extension or the inline text.',
        })
      )
    ),
    data: Schema.optional(TemplateDataSchema),
    format: Schema.optional(
      Schema.Literals(['png', 'jpeg', 'webp']).pipe(
        Schema.annotate({ defaultNote: 'png', description: 'Image format of the output' })
      )
    ),
    quality: Schema.optional(
      Schema.Finite.pipe(
        Schema.annotate({ description: 'Encoding quality from 1 to 100, for jpeg and webp' }),
        Schema.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 100 }))
      )
    ),
    width: Schema.optional(
      PixelsSchema(
        'Width in pixels: the viewport width of an HTML render; for an SVG, alone it scales the image keeping its proportions'
      )
    ),
    height: Schema.optional(
      PixelsSchema(
        'Height in pixels: the viewport height of an HTML render; for an SVG, alone it scales the image keeping its proportions'
      )
    ),
    allowRemoteAssets: Schema.optional(AllowRemoteAssetsSchema),
    preset: Schema.optional(
      Schema.Literals(['og']).pipe(
        Schema.annotate({
          description:
            "'og' renders a social card: an HTML template rendered by the browser engine (RENDERER_*) at a fixed 1200 × 630, as a PNG (or JPEG), never AVIF. It needs the browser engine like any HTML render — with none the step fails with renderer_unavailable. It fixes the size, so width, height, webp and an SVG template are refused with it.",
        })
      )
    ),
    locale: Schema.optional(TemplateLocaleSchema),
    output: DocumentOutputSchema,
  }).pipe(
    Schema.annotate({
      description:
        'The SVG or HTML template and its data, the image format and size, and where it is written.',
    }),
    Schema.check(
      Schema.makeFilter(
        (props) =>
          props.preset !== 'og' ||
          (props.width === undefined &&
            props.height === undefined &&
            props.format !== 'webp' &&
            props.templateType !== 'svg'),
        {
          message:
            "preset 'og' renders an HTML template at a fixed 1200 × 630 as PNG or JPEG; remove width, height, format webp and templateType svg",
        }
      )
    )
  ),
}).pipe(
  Schema.annotate({
    identifier: 'DocumentGenerateImageAction',
    title: 'Document Generate Image Action',
    description: 'Render an SVG or HTML template filled with data into a PNG, JPEG or WebP image',
  })
)

/** @public */
export type DocumentGenerateImageAction = Schema.Schema.Type<
  typeof DocumentGenerateImageActionSchema
>
