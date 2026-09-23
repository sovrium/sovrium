/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { PageAccessExtendedSchema } from '@/domain/models/app/pages/access'
import { AutoSaveConfigSchema } from '@/domain/models/app/pages/components/auto-save'
import { ClickInteractionSchema } from '@/domain/models/app/pages/components/interactions/click'
import { EntranceAnimationSchema } from '@/domain/models/app/pages/components/interactions/entrance'
import { HoverInteractionSchema } from '@/domain/models/app/pages/components/interactions/hover'
import { InteractionsSchema } from '@/domain/models/app/pages/components/interactions/interactions'
import { ScrollInteractionSchema } from '@/domain/models/app/pages/components/interactions/scroll'
import { ContentDirSchema } from '@/domain/models/app/pages/content-dir'
import { DataSourceSchema } from '@/domain/models/app/pages/data-source'
import interactionsBody from '@/domain/models/app/pages/interactions.docs.md' with { type: 'file' }
import interactivityScriptsBody from '@/domain/models/app/pages/interactivity-scripts.docs.md' with { type: 'file' }
import { PageLayoutSchema } from '@/domain/models/app/pages/layout'
import { MarkdownSchema } from '@/domain/models/app/pages/markdown'
import { PageSchema } from '@/domain/models/app/pages/page'
import pagesCollectionsBody from '@/domain/models/app/pages/pages-collections.docs.md' with { type: 'file' }
import pagesDataBindingBody from '@/domain/models/app/pages/pages-data-binding.docs.md' with { type: 'file' }
import pagesLayoutsAccessBody from '@/domain/models/app/pages/pages-layouts-access.docs.md' with { type: 'file' }
import pagesOverviewBody from '@/domain/models/app/pages/pages-overview.docs.md' with { type: 'file' }
import pagesReferencesBody from '@/domain/models/app/pages/pages-references.docs.md' with { type: 'file' }
import pagesRoutingBody from '@/domain/models/app/pages/pages-routing.docs.md' with { type: 'file' }
import { PageParamPropSchema } from '@/domain/models/app/pages/params'
import { PageQueryPropSchema } from '@/domain/models/app/pages/query'
import {
  ExternalScriptSchema,
  FeatureConfigSchema,
  InlineScriptSchema,
  ScriptsSchema,
} from '@/domain/models/app/pages/scripts'
import { PageWindowSchema } from '@/domain/models/app/pages/window'
import { SystemSourceSchema } from '@/domain/models/app/system-sources/system-source'
import systemSourcesBody from '@/domain/models/app/system-sources/system-sources.docs.md' with { type: 'file' }
import { defineArticle, defineSection } from './define'

/**
 * Pages — the section manifest.
 *
 * Nine articles over ONE property directory, `src/domain/models/app/pages/`,
 * plus one that documents a sibling property. The fragments are sub-fragments
 * named after the article rather than after the directory, for the same reason
 * `design`'s are: `pages` is a single key of `AppSchema` whose members split
 * several ways a reader cares about — routing, data binding, layout,
 * metadata — and the tree has nowhere to put that split.
 *
 * ─── THE ONE FRAGMENT THAT IS NOT UNDER `pages/` ───────────────────────────
 *
 * `system-sources` documents the ROOT `systemSources` catalogue, which has its
 * own property directory, so its fragment sits there. It is in this SECTION
 * because a reader meets it while binding a component, one article after
 * `pages-data-binding` — the section is the reading order, the directory is
 * the placement, and only the second is decided by the placement rule.
 *
 * ─── THE TWO ARTICLES THAT ARRIVED FROM `theming` ──────────────────────────
 *
 * `interactions` documents `pages[].components[].interactions` and
 * `interactivity-scripts` documents `pages[].scripts`. The published corpus
 * filed both under theming — they are about behaviour that LOOKS like design —
 * and the theming manifest carried them until this section existed. Neither is
 * about `design`, so by the placement rule both moved here, fragment and row
 * together. Their orders are kept from the published corpus, which puts them
 * after the rest of the section; that is the right reading position anyway,
 * since a page has to exist before its behaviour is worth describing.
 *
 * ─── WHERE THE SEO ARTICLES WENT ───────────────────────────────────────────
 *
 * `seo-meta` and `seo-structured-data` are in `pages-seo.ts`. A section
 * manifest is capped at 400 lines and this file reads 434 with them; the split
 * follows the reading rather than only the ceiling, since both are about what
 * a machine makes of the page. `pages-references` is likewise a split of the
 * published `pages-data-binding`, which is 21 KB of two subjects: the binding,
 * and the reference families that read what it resolved.
 */
export const section = defineSection({
  slug: 'pages',
  title: 'Pages',
  order: 3000,
  tab: 'build',
  articles: [
    defineArticle({
      slug: 'pages-overview',
      title: 'Pages Overview',
      description:
        'What a page is — the server-rendered component tree, every page property, the `$app.*` tokens and the `requires` capability gate.',
      keywords: [
        'sovrium',
        'pages',
        'page properties',
        'SSR',
        'server-rendered',
        'component tree',
        'path',
        'requires',
        '$app',
        'sitemap',
      ],
      order: 3000,
      sidebarLabel: 'Pages Overview',
      body: pagesOverviewBody,
      documents: [PageSchema],
      stories: [
        'US-ADMIN-DASHBOARD-PAGE-REQUIRES',
        'US-PAGES-SITEMAP-001',
        'US-PAGES-SITEMAP-002',
        'US-PAGES-SITEMAP-003',
      ],
    }),
    defineArticle({
      slug: 'pages-routing',
      title: 'Routing & Paths',
      description:
        'How a page path resolves — static routes, dynamic `:param` segments, record detail routes, wildcards, trailing slashes and the language segment.',
      keywords: [
        'sovrium',
        'routing',
        'path',
        'dynamic route',
        'param',
        'slug',
        'wildcard',
        'catch-all',
        'trailing slash',
        'language prefix',
        'redirectToFirst',
      ],
      order: 3004,
      sidebarLabel: 'Routing & Paths',
      body: pagesRoutingBody,
      documents: [],
      stories: ['US-PAGES-NAVIGATION-REDIRECT-TO-FIRST'],
    }),
    defineArticle({
      slug: 'pages-data-binding',
      title: 'Data Binding',
      description:
        'Bind a page or component to a table with `dataSource` — filters, sorts, modes, pagination, route binding, and the channel a publisher and a subscriber share.',
      keywords: [
        'sovrium',
        'dataSource',
        'data binding',
        'filter',
        'sort',
        'pagination',
        'mode',
        'single',
        'search',
        'bindTo',
        'publishes',
        '$param',
      ],
      order: 3008,
      sidebarLabel: 'Data Binding',
      body: pagesDataBindingBody,
      documents: [DataSourceSchema],
      stories: [
        'US-PAGES-DATA-COMPONENTS-DATA-BINDING-001',
        'US-PAGES-DATA-COMPONENTS-DATA-BINDING-002',
        'US-PAGES-DATA-COMPONENTS-DATA-BINDING-003',
        'US-PAGES-DATA-COMPONENTS-DATA-BINDING-004',
        'US-PAGES-DATA-COMPONENTS-DATA-BINDING-005',
        'US-PAGES-DATA-COMPONENTS-DATA-BINDING-006',
        'US-PAGES-DATA-COMPONENTS-DATA-BINDING-008',
        'US-PAGES-DATA-COMPONENTS-DATA-BINDING-ROUTE-PARAM-BEYOND-ROWS',
        'US-PAGES-DATA-COMPONENTS-DATA-BINDING-TABLE-BOUND-LIST',
        'US-PAGES-DATA-COMPONENTS-DATA-BINDING-TABLE-ROUTE-PARAM',
      ],
    }),
    defineArticle({
      slug: 'pages-references',
      title: 'Page References',
      description:
        'The reference families a page resolves — `$record`, `$vars`, `$currentUser`, `$t:` and the browser-side `$session` — plus the `query`, `params` and `window` page inputs.',
      keywords: [
        'sovrium',
        '$record',
        '$vars',
        '$currentUser',
        '$session',
        '$query',
        '$window',
        '$t',
        'page inputs',
        'optional segment',
      ],
      order: 3009,
      sidebarLabel: 'Page References',
      body: pagesReferencesBody,
      documents: [PageQueryPropSchema, PageParamPropSchema, PageWindowSchema],
      stories: [
        'US-PAGES-DATA-COMPONENTS-DATA-BINDING-CURRENT-USER-REFERENCES',
        'US-PAGES-DATA-COMPONENTS-DATA-BINDING-RELATIVE-WINDOW',
        'US-PAGES-DATA-COMPONENTS-RECORD-NULL-SUBSTITUTION',
      ],
    }),
    defineArticle({
      slug: 'system-sources',
      title: 'System Sources',
      description:
        'Declare reusable read endpoints once and bind data components to them by name, instead of repeating raw REST paths across your config.',
      keywords: [
        'sovrium',
        'systemSources',
        'system source',
        'dataSource',
        'read endpoint',
        'cursor feed',
        'row template',
        'rowsKey',
      ],
      order: 3010,
      sidebarLabel: 'System Sources',
      body: systemSourcesBody,
      documents: [SystemSourceSchema],
      stories: [
        'US-PAGES-DATA-COMPONENTS-DATA-BINDING-007',
        'US-PAGES-DATA-COMPONENTS-DATA-BINDING-SYSTEM-DETAIL',
        'US-PAGES-DATA-COMPONENTS-DATA-BINDING-SYSTEM-LOAD-MORE',
        'US-PAGES-DATA-COMPONENTS-DATA-BINDING-SYSTEM-ROUTE-PARAM',
        'US-PAGES-DATA-COMPONENTS-DATA-BINDING-SYSTEM-SOURCE',
        'US-PAGES-DATA-COMPONENTS-DATA-CHART-SYSTEM-SOURCE',
        'US-PAGES-DATA-COMPONENTS-DATA-KPI-SYSTEM-SOURCE',
        'US-PAGES-DATA-COMPONENTS-DATA-TABLE-SYSTEM-SOURCE',
        'US-PAGES-DATA-COMPONENTS-PAGE-SYSTEM-RECORD-SSR',
        'US-PAGES-DATA-COMPONENTS-SYSTEM-ROWS-TEMPLATE',
      ],
    }),
    defineArticle({
      slug: 'pages-collections',
      title: 'Collection & Markdown Pages',
      description:
        'Generate one route per table record with `collection`, render a page body from markdown, and fan a whole directory of markdown files into a navigable section.',
      keywords: [
        'sovrium',
        'collection pages',
        'slugField',
        'markdown',
        'frontmatter',
        'toc',
        'contentDir',
        'content directory',
        'sidebar',
        'RSS',
      ],
      order: 3012,
      sidebarLabel: 'Collections & Markdown',
      body: pagesCollectionsBody,
      documents: [MarkdownSchema, ContentDirSchema],
      stories: [
        'US-PAGES-COLLECTION-PAGES',
        'US-PAGES-LAYOUT-MARKDOWN-PAGES-001',
        'US-PAGES-LAYOUT-MARKDOWN-PAGES-002',
        'US-PAGES-LAYOUT-MARKDOWN-PAGES-003',
        'US-PAGES-LAYOUT-MARKDOWN-PAGES-004',
        'US-PAGES-LAYOUT-MARKDOWN-PAGES-005',
        'US-PAGES-LAYOUT-MARKDOWN-PAGES-006',
        'US-PAGES-LAYOUT-MARKDOWN-PAGES-007',
        'US-PAGES-LAYOUT-MARKDOWN-PAGES-008',
        'US-PAGES-LAYOUT-MARKDOWN-PAGES-009',
        'US-PAGES-LAYOUT-MARKDOWN-PAGES-010',
        'US-PAGES-LAYOUT-MARKDOWN-PAGES-011',
        'US-PAGES-LAYOUT-MARKDOWN-PAGES-012',
        'US-PAGES-LAYOUT-MARKDOWN-PAGES-013',
        'US-PAGES-LAYOUT-MARKDOWN-PAGES-014',
        'US-PAGES-LAYOUT-MARKDOWN-PAGES-015',
        'US-PAGES-LAYOUT-MARKDOWN-PAGES-016',
        'US-PAGES-LAYOUT-MARKDOWN-PAGES-017',
        'US-PAGES-LAYOUT-MARKDOWN-PAGES-018',
      ],
    }),
    defineArticle({
      slug: 'pages-layouts-access',
      title: 'Layouts, Sidebars & Access',
      description:
        'Wrap a page body in a data-bound sidebar with `layout`, gate who may load the page with `access`, and alternate one component on what the caller may do.',
      keywords: [
        'sovrium',
        'layout',
        'sidebar',
        'activeIndicator',
        'access control',
        'authenticated',
        'roles',
        'groups',
        'redirectTo',
        'capability',
        'declares',
        'runtime',
      ],
      order: 3016,
      sidebarLabel: 'Layouts & Access',
      body: pagesLayoutsAccessBody,
      documents: [PageLayoutSchema, PageAccessExtendedSchema],
      stories: [
        'US-PAGES-ACCESS-COMPONENT-CAPABILITY-GATE',
        'US-PAGES-ACCESS-COMPONENT-DECLARES-GATE',
        'US-PAGES-ACCESS-COMPONENT-QUERY-GATE',
        'US-PAGES-ACCESS-COMPONENT-RUNTIME-GATE',
        'US-PAGES-ACCESS-PAGE-ACCESS-CONTROL',
        'US-PAGES-ACCESS-PAGE-RECORD-VISIBILITY',
        'US-PAGES-ACCESS-PUBLISHING',
        'US-PAGES-ACCESS-SCOPED-SIDEBAR',
      ],
    }),
    defineArticle({
      slug: 'interactivity-scripts',
      title: 'Scripts',
      description:
        'A page’s `scripts` block — external dependencies, inline snippets, client-side feature flags and config data — plus the sandboxed `customHTML` component.',
      keywords: [
        'sovrium',
        'scripts',
        'inlineScripts',
        'externalScripts',
        'feature flags',
        'integrity',
        'crossorigin',
        'customHTML',
      ],
      order: 3630,
      sidebarLabel: 'Scripts',
      body: interactivityScriptsBody,
      documents: [ScriptsSchema, ExternalScriptSchema, InlineScriptSchema, FeatureConfigSchema],
      stories: [
        'US-PAGES-INTERACTIVITY-CLIPBOARD-OPERATIONS-003',
        'US-PAGES-INTERACTIVITY-CUSTOM-HTML',
        'US-PAGES-INTERACTIVITY-SCRIPTS-INLINE-FEATURES',
        'US-PAGES-INTERACTIVITY-SCRIPTS-LOADING',
      ],
    }),
    defineArticle({
      slug: 'interactions',
      title: 'Interactions & Auto-Save',
      description:
        'Declarative client-side behaviour — click, hover, scroll and entrance triggers, action response handlers, and inline-edit auto-save.',
      keywords: [
        'sovrium',
        'interactions',
        'click',
        'hover',
        'scroll',
        'entrance',
        'action',
        'onSuccess',
        'onError',
        'toast',
        'auto-save',
        'refetch',
      ],
      order: 3634,
      sidebarLabel: 'Interactions & Auto-Save',
      body: interactionsBody,
      documents: [
        InteractionsSchema,
        ClickInteractionSchema,
        HoverInteractionSchema,
        ScrollInteractionSchema,
        EntranceAnimationSchema,
        AutoSaveConfigSchema,
      ],
      stories: [
        'US-PAGES-INTERACTIVITY-AUTO-SAVE-001',
        'US-PAGES-INTERACTIVITY-AUTO-SAVE-002',
        'US-PAGES-INTERACTIVITY-AUTO-SAVE-003',
        'US-PAGES-INTERACTIVITY-AUTO-SAVE-005',
        'US-PAGES-INTERACTIVITY-AUTO-SAVE-007',
        'US-PAGES-INTERACTIVITY-INTERACTIONS-001',
        'US-PAGES-INTERACTIVITY-INTERACTIONS-002',
        'US-PAGES-INTERACTIVITY-INTERACTIONS-004',
        'US-PAGES-INTERACTIVITY-INTERACTIVE-PATTERNS-ACTION-EFFECTS',
      ],
    }),
  ],
})
