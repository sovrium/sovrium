/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import aiChatComponentBody from '@/domain/models/app/pages/components/component-types/ai/ai.docs.md' with { type: 'file' }
import displayComponentsBody from '@/domain/models/app/pages/components/component-types/display/display.docs.md' with { type: 'file' }
import stepperComponentBody from '@/domain/models/app/pages/components/component-types/display/stepper.docs.md' with { type: 'file' }
import feedbackComponentsBody from '@/domain/models/app/pages/components/component-types/feedback/feedback.docs.md' with { type: 'file' }
import interactiveComponentsBody from '@/domain/models/app/pages/components/component-types/interactive/interactive.docs.md' with { type: 'file' }
import navigationComponentsBody from '@/domain/models/app/pages/components/component-types/navigation/navigation.docs.md' with { type: 'file' }
import overlayComponentsBody from '@/domain/models/app/pages/components/component-types/overlays/overlays.docs.md' with { type: 'file' }
import socialComponentsBody from '@/domain/models/app/pages/components/component-types/specialty/social-components.docs.md' with { type: 'file' }
import { componentType } from './component-directives'
import { defineArticle } from './define'

/**
 * The second half of the Components section: the types that present, navigate,
 * overlay and respond — display, navigation, overlays, feedback, interactive,
 * social and the AI chat panel. Split from `components.ts` so each manifest
 * stays inside its size ceiling; `components.ts` spreads this list into its
 * section, so article order and slugs are unchanged.
 */
export const presentationComponentArticles = [
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
    keywords: ['sovrium', 'comments', 'guest comments', 'moderation', 'threading', 'comment count'],
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
]
