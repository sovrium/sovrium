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

/** A page length a print layout takes: a number and a print or screen unit. */
const PageLengthSchema = Schema.String.pipe(
  Schema.annotate({
    description: "A length: a number followed by mm, cm, in, pt or px (e.g. '20mm', '0.5in')",
  }),
  Schema.check(
    Schema.isPattern(/^(?:\d+\.?\d*|\.\d+)(?:mm|cm|in|pt|px)$/, {
      message: 'A page length must be a number followed by mm, cm, in, pt or px (e.g. `20mm`).',
    })
  )
)

/**
 * Document Generate PDF Action (type: document, operator: generatePdf)
 *
 * Render an HTML template, filled from `data`, into a PDF through the browser
 * engine (`RENDERER_*`). With no engine the step fails with
 * `renderer_unavailable`; it never falls back to a degraded output — which is
 * exactly what the removed `file/generatePdf` did.
 *
 * `header` and `footer` are rendered by the engine outside the page, with the
 * same `data` plus `{{pageNumber}}` and `{{totalPages}}`, filled on every page.
 */
export const DocumentGeneratePdfActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('document').pipe(
    Schema.annotate({
      description: "Constant value 'document' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('generatePdf').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'document' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    template: HtmlTemplateSourceSchema,
    data: Schema.optional(TemplateDataSchema),
    pageSize: Schema.optional(
      Schema.Literals(['A3', 'A4', 'A5', 'Letter', 'Legal']).pipe(
        Schema.annotate({ defaultNote: 'A4', description: 'Paper size of every page' })
      )
    ),
    orientation: Schema.optional(
      Schema.Literals(['portrait', 'landscape']).pipe(
        Schema.annotate({ defaultNote: 'portrait', description: 'Page orientation' })
      )
    ),
    margins: Schema.optional(
      Schema.Struct({
        top: Schema.optional(PageLengthSchema),
        right: Schema.optional(PageLengthSchema),
        bottom: Schema.optional(PageLengthSchema),
        left: Schema.optional(PageLengthSchema),
      }).pipe(
        Schema.annotate({
          description:
            'Space between the page edges and the content; an omitted side keeps the engine default',
        })
      )
    ),
    header: Schema.optional(
      HtmlTemplateSourceSchema.pipe(
        Schema.annotate({
          description:
            'Template printed at the top of every page, with the same data plus {{pageNumber}} and {{totalPages}}',
        })
      )
    ),
    footer: Schema.optional(
      HtmlTemplateSourceSchema.pipe(
        Schema.annotate({
          description:
            'Template printed at the bottom of every page, with the same data plus {{pageNumber}} and {{totalPages}}',
        })
      )
    ),
    allowRemoteAssets: Schema.optional(AllowRemoteAssetsSchema),
    locale: Schema.optional(TemplateLocaleSchema),
    output: DocumentOutputSchema,
  }).pipe(
    Schema.annotate({
      description:
        'The HTML template and its data, the page setup, the header and footer, and where the PDF is written.',
    })
  ),
}).pipe(
  Schema.annotate({
    identifier: 'DocumentGeneratePdfAction',
    title: 'Document Generate PDF Action',
    description: 'Render an HTML template filled with data into a paginated PDF',
  })
)

/** @public */
export type DocumentGeneratePdfAction = Schema.Schema.Type<typeof DocumentGeneratePdfActionSchema>
