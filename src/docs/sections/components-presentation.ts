/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import actionAllowOriginsBody from '@/domain/models/app/pages/components/action-allow-origins.docs.md' with { type: 'file' }
import contentComponentsBody from '@/domain/models/app/pages/components/component-types/content/content-components.docs.md' with { type: 'file' }
import mediaComponentsBody from '@/domain/models/app/pages/components/component-types/content/media-components.docs.md' with { type: 'file' }
import displayComponentsBody from '@/domain/models/app/pages/components/component-types/display/display.docs.md' with { type: 'file' }
import stepperComponentBody from '@/domain/models/app/pages/components/component-types/display/stepper.docs.md' with { type: 'file' }
import feedbackComponentsBody from '@/domain/models/app/pages/components/component-types/feedback/feedback.docs.md' with { type: 'file' }
import interactiveComponentsBody from '@/domain/models/app/pages/components/component-types/interactive/interactive.docs.md' with { type: 'file' }
import navigationComponentsBody from '@/domain/models/app/pages/components/component-types/navigation/navigation.docs.md' with { type: 'file' }
import overlayComponentsBody from '@/domain/models/app/pages/components/component-types/overlays/overlays.docs.md' with { type: 'file' }
import socialComponentsBody from '@/domain/models/app/pages/components/component-types/specialty/social-components.docs.md' with { type: 'file' }
import { componentType } from './component-directives'
import { defineArticle, defineSection } from './define'

/**
 * The Presentation Components section: the types that write, show, navigate,
 * overlay and respond (content, media, display, stepper, navigation, overlays,
 * feedback, interactive and social). Its own rail group so the Components
 * groups stay short enough to scan; article slugs are unchanged.
 */
export const componentsPresentation = defineSection({
  slug: 'components-presentation',
  title: 'Presentation Components',
  order: 3201,
  tab: 'pages',
  articles: [
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
    defineArticle({
      slug: 'display-components',
      title: 'Display Components',
      description:
        'The eleven types that present content: empty state, scroll area, swatch, avatar, description list, marquee, accordion, tabs, list item, record field, timeline.',
      keywords: ['sovrium', 'static table', 'empty state', 'scroll area', 'swatch', 'design token'],
      order: 3228,
      sidebarLabel: 'Display Components',
      body: displayComponentsBody,
      documents: [
        componentType('empty'),
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
      slug: 'stepper-component',
      title: 'The Stepper Component',
      description:
        'stepper — one task split into ordered steps, kept in the address, each step’s body any component.',
      keywords: ['sovrium', 'stepper', 'wizard', 'steps', 'multi-step'],
      order: 3229,
      sidebarLabel: 'Stepper',
      body: stepperComponentBody,
      documents: [componentType('stepper')],
      stories: [],
    }),
    defineArticle({
      slug: 'navigation-components',
      title: 'Navigation Components',
      description:
        'The eight types that move a reader around: navigation-menu, dropdown-menu, context-menu, menubar, breadcrumb, command-palette, notification-bell, pagination.',
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
        componentType('command'),
        componentType('notification-bell'),
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
        'US-PAGES-NAVIGATION-NOTIFICATION-BELL',
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
        componentType('sheet'),
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
        'US-PAGES-OVERLAYS-RECORD-DRAWER-VISIBLE-WHEN',
        'US-PAGES-OVERLAYS-RECORD-DRAWER-VALUE-LABELS',
        'US-PAGES-OVERLAYS-RECORD-DRAWER-SYSTEM-CHANNEL',
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
        'The clickable, inline primitives — button, link, alert, badge, button-group, theme-toggle and consent-choice.',
      keywords: ['sovrium', 'button', 'link', 'alert', 'badge', 'status badge', 'opt-out'],
      order: 3244,
      sidebarLabel: 'Interactive Components',
      body: interactiveComponentsBody,
      documents: [
        componentType('button'),
        componentType('link'),
        componentType('alert'),
        componentType('badge'),
        componentType('theme-toggle'),
        componentType('consent-choice'),
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
        'US-PAGES-INTERACTIVITY-CONSENT-CHOICE',
        'US-PAGES-NAVIGATION-006',
      ],
    }),
    defineArticle({
      slug: 'action-allow-origins',
      title: 'Sending a member to another site',
      description:
        'How an action sends the member to the address its run returned, such as a checkout, on the exact origins `onSuccess.allowOrigins` lists, refusing any other.',
      keywords: [
        'sovrium',
        'allowOrigins',
        'onSuccess',
        'navigate',
        '$response',
        'checkout',
        'redirect',
        'origin',
      ],
      order: 3246,
      sidebarLabel: 'Sending to another site',
      body: actionAllowOriginsBody,
      documents: [],
      stories: [],
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
  ],
})
