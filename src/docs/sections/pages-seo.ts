/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  CustomElementSchema,
  FaviconItemSchema,
  FaviconsConfigSchema,
  ItemListSourceSchema,
  MetaSchema,
  OpenGraphSchema,
  PreloadItemSchema,
  StructuredDataSchema,
  TwitterCardSchema,
} from '@/domain/models/app/pages/meta'
import seoCrawlersBody from '@/domain/models/app/pages/seo-crawlers.docs.md' with { type: 'file' }
import seoMetaBody from '@/domain/models/app/pages/seo-meta.docs.md' with { type: 'file' }
import seoStructuredDataBody from '@/domain/models/app/pages/seo-structured-data.docs.md' with { type: 'file' }
import { defineArticle, defineSection } from './define'

/**
 * Page SEO — the section manifest.
 *
 * Why `pages[].meta` is a section of its own and why its directives overlap:
 * `[internal ref]`, § `pages-seo`.
 * Shape, ordering and the gates that hold a manifest: the same page,
 * "The conventions every manifest follows".
 */
export const section = defineSection({
  slug: 'pages-seo',
  title: 'SEO & Metadata',
  order: 3020,
  tab: 'build',
  articles: [
    defineArticle({
      slug: 'seo-meta',
      title: 'SEO & Metadata',
      description:
        'The page `meta` block — title, description and canonical URL, plus Open Graph and social-card metadata for sharing.',
      keywords: [
        'sovrium',
        'SEO',
        'meta tags',
        'title',
        'description',
        'canonical',
        'robots',
        'noindex',
        'Open Graph',
        'social cards',
        'i18n metadata',
      ],
      order: 3020,
      sidebarLabel: 'SEO & Metadata',
      body: seoMetaBody,
      documents: [MetaSchema, OpenGraphSchema, TwitterCardSchema],
      stories: [
        'US-PAGES-META-BASIC-META',
        'US-PAGES-META-OPEN-GRAPH',
        'US-PAGES-META-PERFORMANCE-HINTS-ANALYTICS-INTEGRATION',
        'US-PAGES-META-TWITTER-CARDS-001',
        'US-PAGES-META-TWITTER-CARDS-002',
      ],
    }),
    defineArticle({
      slug: 'seo-structured-data',
      title: 'Structured Data & Favicons',
      description:
        'Emit Schema.org JSON-LD by hand or synthesise it per article, declare favicons for every device, and add preload and DNS-prefetch resource hints.',
      keywords: [
        'sovrium',
        'structured data',
        'JSON-LD',
        'schema.org',
        'TechArticle',
        'breadcrumbs',
        'favicons',
        'apple touch icon',
        'preload',
        'dns-prefetch',
        'customElements',
      ],
      order: 3024,
      sidebarLabel: 'Structured Data & Icons',
      body: seoStructuredDataBody,
      documents: [
        StructuredDataSchema,
        ItemListSourceSchema,
        FaviconsConfigSchema,
        FaviconItemSchema,
        PreloadItemSchema,
        CustomElementSchema,
      ],
      stories: [
        'US-PAGES-META-STRUCTURED-DATA-001',
        'US-PAGES-META-STRUCTURED-DATA-002',
        'US-PAGES-META-STRUCTURED-DATA-003',
        'US-PAGES-META-STRUCTURED-DATA-004',
        'US-PAGES-META-STRUCTURED-DATA-005',
        'US-PAGES-META-STRUCTURED-DATA-006',
        'US-PAGES-META-STRUCTURED-DATA-007',
        'US-PAGES-META-FAVICONS',
        'US-PAGES-META-PERFORMANCE-HINTS-RESOURCE-HINTS',
      ],
    }),
    defineArticle({
      slug: 'seo-crawlers',
      title: 'Crawlers, Sitemaps & Feeds',
      description:
        "The machine-readable files an app serves (/sitemap.xml, /robots.txt, /feed.xml, each article's Markdown twin): what fills them, what `sovrium build` writes.",
      keywords: [
        'sovrium',
        'sitemap',
        'robots.txt',
        'RSS feed',
        'hreflang',
        'BASE_URL',
        'markdown',
        'AI crawlers',
        'GPTBot',
        'static build',
      ],
      order: 3028,
      sidebarLabel: 'Crawlers & Sitemaps',
      body: seoCrawlersBody,
      documents: [],
      stories: [],
    }),
  ],
})
