/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { AutoSaveConfigSchema } from '@/domain/models/app/pages/components/auto-save'
import { ComponentSearchSchema } from '@/domain/models/app/pages/components/component-search'
import aiChatComponentBody from '@/domain/models/app/pages/components/component-types/ai/ai.docs.md' with { type: 'file' }
import componentsOverviewBody from '@/domain/models/app/pages/components/component-types/component-types.docs.md' with { type: 'file' }
import contentComponentsBody from '@/domain/models/app/pages/components/component-types/content/content-components.docs.md' with { type: 'file' }
import mediaComponentsBody from '@/domain/models/app/pages/components/component-types/content/media-components.docs.md' with { type: 'file' }
import reusableComponentsBody from '@/domain/models/app/pages/components/component-types/custom/custom.docs.md' with { type: 'file' }
import displayComponentsBody from '@/domain/models/app/pages/components/component-types/display/display.docs.md' with { type: 'file' }
import feedbackComponentsBody from '@/domain/models/app/pages/components/component-types/feedback/feedback.docs.md' with { type: 'file' }
import interactiveComponentsBody from '@/domain/models/app/pages/components/component-types/interactive/interactive.docs.md' with { type: 'file' }
import layoutComponentsBody from '@/domain/models/app/pages/components/component-types/layout/layout-components.docs.md' with { type: 'file' }
import sidebarNavigationBody from '@/domain/models/app/pages/components/component-types/layout/sidebar-navigation.docs.md' with { type: 'file' }
import componentModulesBody from '@/domain/models/app/pages/components/component-types/modules/modules.docs.md' with { type: 'file' }
import navigationComponentsBody from '@/domain/models/app/pages/components/component-types/navigation/navigation.docs.md' with { type: 'file' }
import overlayComponentsBody from '@/domain/models/app/pages/components/component-types/overlays/overlays.docs.md' with { type: 'file' }
import socialComponentsBody from '@/domain/models/app/pages/components/component-types/specialty/social-components.docs.md' with { type: 'file' }
import structuralComponentsBody from '@/domain/models/app/pages/components/component-types/structural/structural.docs.md' with { type: 'file' }
import { VisibilitySchema } from '@/domain/models/app/pages/components/visibility'
import { componentType } from './component-directives'
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
      stories: ['US-PAGES-DATA-COMPONENTS-ROW-VISIBILITY'],
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
      ],
      order: 3204,
      sidebarLabel: 'Reusable Components',
      body: reusableComponentsBody,
      documents: [],
      stories: ['US-DESIGN-SYSTEM-COMPONENT-TYPES-CUSTOM', 'US-PAGES-PAGE-COMPONENTS-004'],
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
        'The sidebar layout component — declarative navigation groups, fetched entries, expanding sections, the current-entry mark, and the icon rail.',
      keywords: ['sovrium', 'sidebar', 'navigation', 'app shell', 'groups', 'landmark'],
      order: 3212,
      sidebarLabel: 'Sidebar',
      body: sidebarNavigationBody,
      documents: [componentType('sidebar')],
      stories: [
        'US-PAGES-LAYOUT-APP-SHELL-PATTERN-001',
        'US-PAGES-LAYOUT-APP-SHELL-PATTERN-002',
        'US-PAGES-LAYOUT-APP-SHELL-SIDEBAR',
        'US-PAGES-NAVIGATION-SIDEBAR-CLIENT-CURRENT',
        'US-PAGES-NAVIGATION-SIDEBAR-DISCLOSURE',
        'US-PAGES-NAVIGATION-SIDEBAR-ENTRY-PROPS',
        'US-PAGES-NAVIGATION-SIDEBAR-GROUPS',
        'US-PAGES-NAVIGATION-SIDEBAR-SECTIONS',
      ],
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
        // `[internal ref]` (search-term highlighting) moved to the
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
      documents: [componentType('image'), componentType('qr-code')],
      stories: [
        'US-PAGES-LAYOUT-ICONS',
        'US-PAGES-MEDIA-MEDIA-COMPONENTS-001',
        'US-PAGES-MEDIA-MEDIA-COMPONENTS-002',
        'US-PAGES-MEDIA-MEDIA-COMPONENTS-003',
        'US-PAGES-MEDIA-MEDIA-COMPONENTS-004',
        'US-PAGES-MEDIA-MEDIA-COMPONENTS-005',
      ],
    }),
    defineArticle({
      slug: 'display-components',
      title: 'Display Components',
      description:
        'The eleven types that present content rather than list it — empty states, scroll areas, swatches, avatars, description lists, marquees, accordions, tabs, list items, a single record field, and the timeline.',
      keywords: ['sovrium', 'static table', 'empty state', 'scroll area', 'swatch', 'design token'],
      order: 3228,
      sidebarLabel: 'Display Components',
      body: displayComponentsBody,
      documents: [
        componentType('empty-state'),
        componentType('scroll-area'),
        componentType('swatch'),
        componentType('avatar'),
        componentType('description-list'),
        componentType('record-field'),
        componentType('marquee'),
        componentType('timeline'),
        componentType('accordion'),
        componentType('tabs'),
      ],
      stories: [
        'US-DESIGN-SYSTEM-COMPONENT-TYPES-DISPLAY',
        'US-DESIGN-SYSTEM-COMPONENT-TYPES-DISPLAY-AVATAR',
        'US-DESIGN-SYSTEM-COMPONENT-TYPES-DISPLAY-DESCRIPTION-LIST',
        'US-PAGES-DATA-COMPONENTS-DATA-TIMELINE-BASIC-TIMELINE-VIEW',
        'US-PAGES-DATA-COMPONENTS-DATA-TIMELINE-SYSTEM-READ-ENDPOINT-DATA-SOURCE',
      ],
    }),
    defineArticle({
      slug: 'navigation-components',
      title: 'Navigation Components',
      description:
        'The seven types that move a reader around — navigation-menu, dropdown-menu, context-menu, menubar, breadcrumb, command-palette and pagination.',
      keywords: [
        'sovrium',
        'navigation menu',
        'dropdown menu',
        'context menu',
        'menubar',
        'breadcrumb',
      ],
      order: 3232,
      sidebarLabel: 'Navigation Components',
      body: navigationComponentsBody,
      documents: [
        componentType('navigation-menu'),
        componentType('dropdown-menu'),
        componentType('context-menu'),
        componentType('menubar'),
        componentType('breadcrumb'),
        componentType('command-palette'),
        componentType('pagination'),
      ],
      stories: [
        'US-DESIGN-SYSTEM-COMPONENT-TYPES-NAVIGATION-GAPS',
        'US-PAGES-LAYOUT-NAVIGATION',
        'US-PAGES-NAVIGATION-001',
        'US-PAGES-NAVIGATION-002',
        'US-PAGES-NAVIGATION-003',
        'US-PAGES-NAVIGATION-ACTIVE-ITEM-MARKER',
        'US-PAGES-NAVIGATION-BREADCRUMB-DERIVED',
        'US-PAGES-NAVIGATION-COMMAND-PALETTE-CONFIG',
        'US-PAGES-NAVIGATION-SPLIT-BUTTON',
      ],
    }),
    defineArticle({
      slug: 'overlay-components',
      title: 'Overlay Components',
      description:
        'The seven types that float above the page — dialog, alert-dialog, drawer, popover, tooltip, hover-card and toast.',
      keywords: ['sovrium', 'dialog', 'modal', 'drawer', 'popover', 'tooltip'],
      order: 3236,
      sidebarLabel: 'Overlay Components',
      body: overlayComponentsBody,
      documents: [
        componentType('dialog'),
        componentType('alert-dialog'),
        componentType('drawer'),
        componentType('popover'),
        componentType('tooltip'),
        componentType('hover-card'),
      ],
      stories: [
        'US-DESIGN-SYSTEM-COMPONENT-TYPES-OVERLAYS-GAPS',
        'US-PAGES-DATA-COMPONENTS-RECORD-DETAIL-VIEW-001',
        'US-PAGES-DATA-COMPONENTS-RECORD-DETAIL-VIEW-002',
        'US-PAGES-DATA-COMPONENTS-RECORD-DETAIL-VIEW-003',
        'US-PAGES-DATA-COMPONENTS-RECORD-DETAIL-VIEW-005',
        'US-PAGES-DATA-COMPONENTS-RECORD-DETAIL-VIEW-006',
        'US-PAGES-DATA-COMPONENTS-RECORD-DETAIL-VIEW-007',
        'US-PAGES-OVERLAYS-001',
        'US-PAGES-OVERLAYS-002',
        'US-PAGES-OVERLAYS-003',
        'US-PAGES-OVERLAYS-004',
        'US-PAGES-OVERLAYS-005',
        'US-PAGES-OVERLAYS-006',
        'US-PAGES-OVERLAYS-007',
        'US-PAGES-OVERLAYS-008',
        'US-PAGES-OVERLAYS-009',
        'US-PAGES-OVERLAYS-010',
      ],
    }),
    defineArticle({
      slug: 'feedback-components',
      title: 'Feedback Components',
      description: 'Status and loading-feedback components — progress, spinner, and skeleton.',
      keywords: ['sovrium', 'progress', 'progress bar', 'progress circle', 'spinner', 'loader'],
      order: 3240,
      sidebarLabel: 'Feedback Components',
      body: feedbackComponentsBody,
      documents: [componentType('progress'), componentType('skeleton')],
      stories: [
        'US-DESIGN-SYSTEM-COMPONENT-TYPES-FEEDBACK',
        'US-PAGES-FEEDBACK-PROGRESS',
        'US-PAGES-FEEDBACK-PROGRESS-CIRCLE',
        'US-PAGES-FEEDBACK-PROGRESS-STEPS',
        'US-PAGES-FEEDBACK-SKELETON',
        'US-PAGES-FEEDBACK-TOAST-NOTIFICATIONS-001',
        'US-PAGES-FEEDBACK-TOAST-NOTIFICATIONS-002',
      ],
    }),
    defineArticle({
      slug: 'interactive-components',
      title: 'Interactive Components',
      description:
        'The clickable, inline primitives — button, link, alert, badge, button-group and theme-toggle.',
      keywords: ['sovrium', 'button', 'link', 'alert', 'badge', 'status badge'],
      order: 3244,
      sidebarLabel: 'Interactive Components',
      body: interactiveComponentsBody,
      documents: [
        componentType('button'),
        componentType('link'),
        componentType('alert'),
        componentType('badge'),
        componentType('theme-toggle'),
      ],
      stories: [
        'US-DESIGN-SYSTEM-COMPONENT-TYPES-INTERACTIVE',
        'US-PAGES-DISPLAY-STATUS-INDICATOR',
        'US-PAGES-INTERACTIVITY-INTERACTIVE-PATTERNS-ACTION-FEEDBACK',
        'US-PAGES-INTERACTIVITY-INTERACTIVE-PATTERNS-CONFIRM-OBJECT',
        'US-PAGES-INTERACTIVITY-INTERACTIVE-PATTERNS-FETCH-BUTTON',
        'US-PAGES-INTERACTIVITY-INTERACTIVE-PATTERNS-INTERACTIVE-UI-LIFECYCLE',
        'US-PAGES-INTERACTIVITY-INTERACTIVE-PATTERNS-SESSION-IDENTITY',
        'US-PAGES-INTERACTIVITY-INTERACTIVE-PATTERNS-SESSION-TEXT',
        'US-PAGES-NAVIGATION-006',
      ],
    }),
    defineArticle({
      slug: 'social-components',
      title: 'Social Components',
      description:
        'Threaded record comments, public guest comments, the inline comment count — and how sharing is composed from types that already exist.',
      keywords: [
        'sovrium',
        'comments',
        'guest comments',
        'moderation',
        'threading',
        'comment count',
      ],
      order: 3248,
      sidebarLabel: 'Social Components',
      body: socialComponentsBody,
      documents: [componentType('comments')],
      stories: [
        'US-PAGES-SOCIAL-COMMENTS-001',
        'US-PAGES-SOCIAL-COMMENTS-002',
        'US-PAGES-SOCIAL-COMMENTS-003',
        'US-PAGES-SOCIAL-COMMENTS-004',
        'US-PAGES-SOCIAL-COMMENTS-005',
        'US-PAGES-SOCIAL-COMMENTS-006',
        'US-PAGES-SOCIAL-COMMENTS-RECORD-BINDING',
        'US-PAGES-SOCIAL-PUBLIC-COMMENTS-001',
        'US-PAGES-SOCIAL-PUBLIC-COMMENTS-002',
        'US-PAGES-SOCIAL-PUBLIC-COMMENTS-003',
        'US-PAGES-SOCIAL-PUBLIC-COMMENTS-004',
        'US-PAGES-SOCIAL-PUBLIC-COMMENTS-005',
      ],
    }),
    defineArticle({
      slug: 'ai-chat-component',
      title: 'The AI Chat Component',
      description:
        'ai-chat — an embedded chat panel backed by one of the app’s configured agents, and how it gives way where AI cannot run.',
      keywords: ['sovrium', 'ai-chat', 'agent', 'chat panel', 'assistant', 'runtime capability'],
      order: 3252,
      sidebarLabel: 'AI Chat',
      body: aiChatComponentBody,
      documents: [componentType('ai-chat')],
      stories: [],
    }),
  ],
})
