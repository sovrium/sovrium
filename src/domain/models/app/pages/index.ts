/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { PageSchema } from './page'
import type { Page, PageEncoded } from './page'

export const PagesSchema = Schema.Array(PageSchema).pipe(
  Schema.minItems(1),
  Schema.annotations({
    identifier: 'Pages',
    title: 'Pages',
    description:
      'Marketing and content pages with server-side rendering support. Pages use a component-based layout system with reusable component templates for building landing pages, about pages, pricing pages, and other public-facing content. Supports comprehensive metadata, theming, and structured data for SEO optimization.',
  })
)

export type Pages = typeof PagesSchema.Type

export { PageSchema }
export type { Page, PageEncoded }
