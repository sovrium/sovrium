/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { AutoSaveConfigSchema } from '@/domain/models/app/pages/components/auto-save'
import { ComponentSearchSchema } from '@/domain/models/app/pages/components/component-search'
import componentsOverviewBody from '@/domain/models/app/pages/components/component-types/component-types.docs.md' with { type: 'file' }
import contentComponentsBody from '@/domain/models/app/pages/components/component-types/content/content-components.docs.md' with { type: 'file' }
import mediaComponentsBody from '@/domain/models/app/pages/components/component-types/content/media-components.docs.md' with { type: 'file' }
import reusableComponentsBody from '@/domain/models/app/pages/components/component-types/custom/custom.docs.md' with { type: 'file' }
import layoutComponentsBody from '@/domain/models/app/pages/components/component-types/layout/layout-components.docs.md' with { type: 'file' }
import sidebarClientNavigationBody from '@/domain/models/app/pages/components/component-types/layout/sidebar-client-navigation.docs.md' with { type: 'file' }
import sidebarNavigationBody from '@/domain/models/app/pages/components/component-types/layout/sidebar-navigation.docs.md' with { type: 'file' }
import componentModulesBody from '@/domain/models/app/pages/components/component-types/modules/modules.docs.md' with { type: 'file' }
import structuralComponentsBody from '@/domain/models/app/pages/components/component-types/structural/structural.docs.md' with { type: 'file' }
import { VisibilitySchema } from '@/domain/models/app/pages/components/visibility'
import { componentType } from './component-directives'
import { presentationComponentArticles } from './components-presentation'
import { defineArticle, defineSection } from './define'

/**
 * Components — the section manifest.
 *
 * Every `body` is imported `with { type: 'file' }`, so the value is a PATH and
 * the prose is never loaded until something reads it.
 *
 * `documents` is positional: its Nth entry is what the fragment's Nth
 * `sovrium:options` directive expands. Most sections fill it with imported
 * schemas, so deleting one fails `tsc` here. A component type cannot be
 * imported — it is a field bag rather than an exported schema — so its entry is
 * {@link componentType}, which throws on a name the catalogue does not hold.
 * `docs-structure.test.ts` asserts the round trip over all ninety names.
 */
export const section = defineSection({
  slug: 'components',
  title: 'Components',
  order: 3200,
  tab: 'pages',
  articles: [
    defineArticle({
      slug: 'components-overview',
      title: 'The Component Model',
      description:
        'How Sovrium’s component types are built — the tree, the property bag, and the category map that points at each reference page.',
      keywords: ['sovrium', 'components', 'component model', 'props', 'children', 'content'],
      order: 3200,
      sidebarLabel: 'Component Model',
      body: componentsOverviewBody,
      documents: [],
      stories: [
        'US-ADMIN-DESIGN-SYSTEM-SCHEMA-ENDPOINTS',
        'US-PAGES-COMMON-SCHEMAS-COMPONENT-CONFIGURATION',
        'US-PAGES-COMMON-SCHEMAS-STATIC-TYPES',
        'US-PAGES-CREATING-PAGES-004',
        'US-PAGES-CREATING-PAGES-005',
        'US-PAGES-CREATING-PAGES-APP-VARS',
        'US-PAGES-CREATING-PAGES-DEFINE-IDENT',
        'US-PAGES-CREATING-PAGES-NAME-SCRIPT-TOAST',
        'US-PAGES-CREATING-PAGES-QUERY-PROPS',
        'US-PAGES-CREATING-PAGES-REQUIRES',
        'US-PAGES-CREATING-PAGES-ROUTE-PARAM-ALLOW-LIST',
        'US-PAGES-CREATING-PAGES-TRAILING-SLASH',
        'US-PAGES-INTERACTIVITY-INTERACTIONS-003',
        'US-PAGES-PAGE-COMPONENTS-001',
      ],
    }),
    defineArticle({
      slug: 'component-modules',
      title: 'Shared Component Modules',
      description:
        'The nine cross-cutting property modules every component type composes from — what each one means, which types carry it, and where its options are listed.',
      keywords: ['sovrium', 'component modules', 'props', 'children', 'content', 'dataSource'],
      order: 3202,
      sidebarLabel: 'Shared Modules',
      body: componentModulesBody,
      documents: [VisibilitySchema, AutoSaveConfigSchema, ComponentSearchSchema],
      stories: [
        'US-DESIGN-COMPONENT-CLASSES',
        'US-DESIGN-COMPONENT-CLASSES-CONTENT-PARTS',
        'US-PAGES-DATA-COMPONENTS-ROW-VISIBILITY',
      ],
    }),
    defineArticle({
      slug: 'reusable-components',
      title: 'Reusable Components',
      description:
        'Define a component template once in app.components and instantiate it across pages with $ref and vars — plus customHTML, the escape hatch for markup the kit does not cover.',
      keywords: [
        'sovrium',
        'reusable components',
        'component templates',
        '$ref',
        'vars',
        'variable substitution',
        'slot',
        'app shell',
      ],
      order: 3204,
      sidebarLabel: 'Reusable Components',
      body: reusableComponentsBody,
      documents: [],
      stories: [
        'US-DESIGN-SYSTEM-COMPONENT-TYPES-CUSTOM',
        'US-PAGES-PAGE-COMPONENTS-004',
        'US-PAGES-PAGE-COMPONENTS-006',
      ],
    }),
    defineArticle({
      slug: 'layout-components',
      title: 'Layout Components',
      description:
        'Structural page components — container, flex, grid, card and split-pane. The sidebar has its own page.',
      keywords: ['sovrium', 'layout', 'container', 'flex', 'grid', 'responsive grid'],
      order: 3210,
      sidebarLabel: 'Layout Components',
      body: layoutComponentsBody,
      documents: [componentType('container'), componentType('card'), componentType('split-pane')],
      stories: [
        'US-DESIGN-SYSTEM-COMPONENT-TYPES-LAYOUT',
        'US-PAGES-LAYOUT-TABS-CONTAINER-001',
        'US-PAGES-LAYOUT-TABS-CONTAINER-002',
      ],
    }),
    defineArticle({
      slug: 'sidebar-navigation',
      title: 'Sidebar Navigation',
      description:
        'The sidebar layout component — declarative navigation groups, fetched entries, expanding sections, the current-entry mark, the icon rail, and the drawer on narrow screens.',
      keywords: ['sovrium', 'sidebar', 'navigation', 'app shell', 'groups', 'landmark'],
      order: 3212,
      sidebarLabel: 'Sidebar',
      body: sidebarNavigationBody,
      documents: [componentType('sidebar')],
      stories: [
        'US-PAGES-LAYOUT-APP-SHELL-PATTERN-001',
        'US-PAGES-LAYOUT-APP-SHELL-PATTERN-002',
        'US-PAGES-LAYOUT-APP-SHELL-SIDEBAR',
        'US-PAGES-NAVIGATION-SIDEBAR-DISCLOSURE',
        'US-PAGES-NAVIGATION-SIDEBAR-DRAWER',
        'US-PAGES-NAVIGATION-SIDEBAR-ENTRY-PROPS',
        'US-PAGES-NAVIGATION-SIDEBAR-GROUPS',
        'US-PAGES-NAVIGATION-SIDEBAR-SECTIONS',
      ],
    }),
    defineArticle({
      slug: 'sidebar-client-navigation',
      title: 'Client-side Navigation',
      description:
        'Moving between pages without a reload — clientSideNavigation swaps the content region on a sidebar link click and keeps loaded data on screen, and trackNavigation keeps the current-entry mark true after a swap.',
      keywords: ['sovrium', 'sidebar', 'navigation', 'client-side navigation', 'spa', 'no reload'],
      order: 3213,
      sidebarLabel: 'Client-side Navigation',
      body: sidebarClientNavigationBody,
      documents: [],
      stories: ['US-PAGES-NAVIGATION-SIDEBAR-CLIENT-CURRENT', 'US-PAGES-NAVIGATION-SPA-NAVIGATION'],
    }),
    defineArticle({
      slug: 'structural-components',
      title: 'Dividers & Spacers',
      description:
        'The two structural components that carry no content — divider draws a rule, optionally labelled, and spacer reserves vertical whitespace.',
      keywords: ['sovrium', 'divider', 'spacer', 'separator', 'horizontal rule', 'whitespace'],
      order: 3214,
      sidebarLabel: 'Dividers & Spacers',
      body: structuralComponentsBody,
      documents: [],
      stories: ['US-DESIGN-SYSTEM-COMPONENT-TYPES-STRUCTURAL'],
    }),
    defineArticle({
      slug: 'content-components',
      title: 'Content Components',
      description:
        'Text and prose blocks — text and markdown, highlighted code with frames and composed content, keycaps, an auto-generated table of contents, and the search box.',
      keywords: ['sovrium', 'content', 'text', 'markdown', 'code block', 'syntax highlighting'],
      order: 3220,
      sidebarLabel: 'Content Components',
      body: contentComponentsBody,
      documents: [
        componentType('text'),
        componentType('code'),
        componentType('kbd'),
        componentType('search-input'),
      ],
      stories: [
        'US-DESIGN-SYSTEM-COMPONENT-TYPES-CONTENT',
        'US-DESIGN-SYSTEM-COMPONENT-TYPES-CONTENT-KBD',
        'US-PAGES-LAYOUT-CODE-CONTENT-FROM',
        'US-PAGES-LAYOUT-CONTENT-BLOCKS-001',
        'US-PAGES-LAYOUT-CONTENT-BLOCKS-002',
        'US-PAGES-LAYOUT-CONTENT-BLOCKS-003',
        'US-PAGES-LAYOUT-CONTENT-BLOCKS-004',
        'US-PAGES-LAYOUT-CONTENT-BLOCKS-005',
        'US-PAGES-LAYOUT-CONTENT-BLOCKS-006',
        'US-PAGES-LAYOUT-CONTENT-BLOCKS-007',
        'US-PAGES-LAYOUT-CONTENT-BLOCKS-008',
        // The pages search requirement (search-term highlighting) moved to the
        // `search-components` article: highlighting is a `listDisplay` and
        // in-component-search behaviour, not a property of the input this
        // article documents.
      ],
    }),
    defineArticle({
      slug: 'media-components',
      title: 'Media Components',
      description: 'Media page components — image, icon, video, audio, iframe, and qr-code.',
      keywords: ['sovrium', 'image', 'icon', 'lucide', 'video', 'audio'],
      order: 3224,
      sidebarLabel: 'Media Components',
      body: mediaComponentsBody,
      documents: [componentType('image'), componentType('qr-code'), componentType('file-preview')],
      stories: [
        'US-PAGES-LAYOUT-ICONS',
        'US-PAGES-MEDIA-MEDIA-COMPONENTS-001',
        'US-PAGES-MEDIA-MEDIA-COMPONENTS-002',
        'US-PAGES-MEDIA-MEDIA-COMPONENTS-003',
        'US-PAGES-MEDIA-MEDIA-COMPONENTS-004',
        'US-PAGES-MEDIA-MEDIA-COMPONENTS-005',
      ],
    }),
    ...presentationComponentArticles,
  ],
})
