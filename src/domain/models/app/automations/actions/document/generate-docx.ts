/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ActionBaseFields } from '../base'
import {
  BinaryTemplateSourceSchema,
  DocumentOutputSchema,
  TemplateDataSchema,
  TemplateLocaleSchema,
} from './shared'

/**
 * Document Generate DOCX Action (type: document, operator: generateDocx)
 *
 * Fill a Word template with `data`, inside the binary (no engine needed).
 *
 * The template's tags are the templating language of every template:
 * `{{client.name}}`, `{{#each lines}}…{{/each}}` around a table row or a
 * paragraph, `{{#if client.vip}}…{{/if}}` around paragraphs. A tag Word split
 * across several runs is recognised; every XML part carrying text is filled
 * (body, headers, footers); values are XML-escaped.
 */
export const DocumentGenerateDocxActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('document').pipe(
    Schema.annotate({
      description: "Constant value 'document' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('generateDocx').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'document' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    template: BinaryTemplateSourceSchema,
    data: Schema.optional(TemplateDataSchema),
    locale: Schema.optional(TemplateLocaleSchema),
    output: DocumentOutputSchema,
  }).pipe(
    Schema.annotate({
      description: 'The .docx template and its data, and where the filled document is written.',
    })
  ),
}).pipe(
  Schema.annotate({
    identifier: 'DocumentGenerateDocxAction',
    title: 'Document Generate DOCX Action',
    description: 'Fill a Word (.docx) template with data',
  })
)

/** @public */
export type DocumentGenerateDocxAction = Schema.Schema.Type<typeof DocumentGenerateDocxActionSchema>
