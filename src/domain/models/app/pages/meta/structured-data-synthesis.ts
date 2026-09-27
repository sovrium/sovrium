/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * The content-directory JSON-LD synthesis toggle, written in
 * `meta.structuredData`.
 *
 * `meta.structuredData` carries two things: this toggle, and — as the older
 * name of `meta.schema` — authored JSON-LD. An object carrying `enabled` is the
 * toggle and is decoded against this struct, so a mistyped key is refused
 * rather than silently becoming a `TechArticle`; anything else stays raw
 * JSON-LD, passed through as before.
 */
export const StructuredDataSynthesisSchema = Schema.Struct({
  enabled: Schema.Boolean.annotate({
    description:
      'Generate JSON-LD for every article of a content directory from its frontmatter. Only `true` turns synthesis on.',
  }),
  type: Schema.optional(
    Schema.Literals(['TechArticle', 'Article']).annotate({
      description:
        'Schema.org type of the generated article: `TechArticle` (the default) or `Article`.',
    })
  ),
  breadcrumbs: Schema.optional(
    Schema.Boolean.annotate({
      description:
        'Also emit a BreadcrumbList for the article’s position in the navigation (default `true`).',
    })
  ),
  organization: Schema.optional(
    Schema.String.annotate({
      description: 'Organization named as the publisher of every generated article.',
    })
  ),
}).annotate({
  title: 'Structured-data synthesis',
  description:
    'Generate TechArticle or Article JSON-LD, plus an optional breadcrumb list, for each article of a content-directory page.',
})

/** @public */
export type StructuredDataSynthesis = Schema.Schema.Type<typeof StructuredDataSynthesisSchema>

/** True when a `meta.structuredData` value is shaped as the synthesis toggle. */
export const isStructuredDataToggleShape = (value: unknown): boolean =>
  value !== null && typeof value === 'object' && !Array.isArray(value) && 'enabled' in value

/**
 * `meta.structuredData`: the synthesis toggle, or authored JSON-LD under its
 * older name. The JSON-LD branch refuses a toggle-shaped object, so a toggle
 * that fails its struct is reported rather than accepted as raw data.
 */
export const StructuredDataFieldSchema = Schema.Union([
  StructuredDataSynthesisSchema,
  Schema.Unknown.pipe(
    Schema.check(
      Schema.makeFilter((value) =>
        isStructuredDataToggleShape(value)
          ? 'A structuredData object carrying `enabled` is the synthesis toggle: `type` must be TechArticle or Article, `breadcrumbs` a boolean and `organization` a string.'
          : true
      )
    )
  ),
]).annotate({
  description:
    'The content-directory synthesis toggle (an object carrying `enabled`), or authored JSON-LD under the older name of `schema`.',
})
