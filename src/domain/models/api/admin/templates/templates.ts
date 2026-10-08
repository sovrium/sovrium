/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * API contract for the console's read-only Templates pages.
 *
 * - `GET /api/admin/templates` lists the template assets the config declares.
 * - `GET /api/admin/templates/preview?path=<asset path>` renders one with its
 *   `sampleData`, exactly as an automation would (same engine, same escaping,
 *   same sandbox), and returns the result for the console to show in a
 *   sandboxed frame.
 *
 * Read-only by construction: there is no write verb on either
 * route, and an asset is never returned as its raw bytes — a preview is a
 * RENDER, so the private file itself is never downloadable through this
 * surface either. Both routes answer 404 to anyone who is not an admin.
 */

import { Schema } from 'effect'
import { optionalField } from '@/domain/models/api/combinators/optional-field'

/** What a preview renders a template into. */
const TEMPLATE_PREVIEW_KINDS = ['html', 'svg', 'text', 'email', 'none'] as const

/** One template asset, as the console lists it. */
export const adminTemplateSchema = Schema.Struct({
  path: Schema.String.annotate({ description: 'Asset path, as declared in `assets`' }),
  kind: Schema.Literals(['html', 'svg', 'partial', 'text', 'docx', 'xlsx', 'pptx']).annotate({
    description: 'What the template is',
  }),
  description: optionalField(
    Schema.String.annotate({ description: 'The description the config gives it' })
  ),
  hasSampleData: Schema.Boolean.annotate({
    description: 'Whether the asset declares sampleData to preview it with',
  }),
  usedBy: Schema.Array(
    Schema.String.annotate({ description: 'An automation step reading it, as <automation>.<step>' })
  ).annotate({ description: 'The automation steps that read this template' }),
}).annotate({ title: 'Admin Template', description: 'One template asset of the app' })

/** @public */
export type AdminTemplate = Schema.Schema.Type<typeof adminTemplateSchema>

/** `GET /api/admin/templates` */
export const adminTemplatesResponseSchema = Schema.Struct({
  templates: Schema.Array(adminTemplateSchema).annotate({
    description: 'Every declared template asset, in declaration order',
  }),
}).annotate({ title: 'Admin Templates', description: 'The template assets of the app' })

/** @public */
export type AdminTemplatesResponse = Schema.Schema.Type<typeof adminTemplatesResponseSchema>

/** `GET /api/admin/templates/preview?path=…` */
export const adminTemplatePreviewResponseSchema = Schema.Struct({
  path: Schema.String.annotate({ description: 'Asset path of the previewed template' }),
  rendersAs: Schema.Literals(TEMPLATE_PREVIEW_KINDS).annotate({
    description:
      "What the preview holds: html, svg or text markup; email (the HTML as email/send delivers it); none for a Word, Excel or PowerPoint template, which renders to a file — use 'sovrium render' for those",
  }),
  content: optionalField(
    Schema.String.annotate({
      description: 'The rendered template, escaped and sanitized as a run would; absent for none',
    })
  ),
  usedSampleData: Schema.Boolean.annotate({
    description: 'false when the asset declares no sampleData and the preview used empty values',
  }),
}).annotate({
  title: 'Admin Template Preview',
  description: 'A template rendered with its sample data, for display in a sandboxed frame',
})

/** @public */
export type AdminTemplatePreviewResponse = Schema.Schema.Type<
  typeof adminTemplatePreviewResponseSchema
>
