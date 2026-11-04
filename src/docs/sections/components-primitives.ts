/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import aiChatComponentBody from '@/domain/models/app/pages/components/component-types/ai/ai.docs.md' with { type: 'file' }
import attachmentComponentBody from '@/domain/models/app/pages/components/component-types/content/attachment.docs.md' with { type: 'file' }
import questionnaireComponentBody from '@/domain/models/app/pages/components/component-types/data/questionnaire.docs.md' with { type: 'file' }
import bubbleComponentBody from '@/domain/models/app/pages/components/component-types/display/bubble.docs.md' with { type: 'file' }
import collapsibleComponentBody from '@/domain/models/app/pages/components/component-types/display/collapsible.docs.md' with { type: 'file' }
import markerComponentBody from '@/domain/models/app/pages/components/component-types/display/marker.docs.md' with { type: 'file' }
import messageComponentBody from '@/domain/models/app/pages/components/component-types/display/message.docs.md' with { type: 'file' }
import dayCalendarComponentBody from '@/domain/models/app/pages/components/component-types/form-controls/day-calendar.docs.md' with { type: 'file' }
import labelComponentBody from '@/domain/models/app/pages/components/component-types/form-controls/label.docs.md' with { type: 'file' }
import aspectRatioComponentBody from '@/domain/models/app/pages/components/component-types/layout/aspect-ratio.docs.md' with { type: 'file' }
import messageScrollerComponentBody from '@/domain/models/app/pages/components/component-types/layout/message-scroller.docs.md' with { type: 'file' }
import drawerComponentBody from '@/domain/models/app/pages/components/component-types/overlays/bottom-drawer.docs.md' with { type: 'file' }
import { componentType } from './component-directives'
import { defineArticle, defineSection } from './define'

/**
 * The More Components section: one article per type that has a page of its
 * own, the chat anatomy (ai-chat, bubble, marker, attachment, message,
 * message-scroller) among them. Its own rail group so the Components groups
 * stay short enough to scan; article slugs are unchanged.
 */
export const componentsMore = defineSection({
  slug: 'components-more',
  title: 'More Components',
  order: 3202,
  tab: 'pages',
  articles: [
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
    defineArticle({
      slug: 'bubble-component',
      title: 'The Bubble Component',
      description:
        'bubble — the surface of one chat turn, its tail on the side of the thread it sits on.',
      keywords: ['sovrium', 'bubble', 'chat', 'message', 'speech bubble'],
      order: 3230,
      sidebarLabel: 'Bubble',
      body: bubbleComponentBody,
      documents: [componentType('bubble')],
      stories: [],
    }),
    defineArticle({
      slug: 'aspect-ratio-component',
      title: 'The Aspect Ratio Component',
      description:
        'aspect-ratio — one image, video or map held at a fixed width-to-height shape at every screen width.',
      keywords: ['sovrium', 'aspect ratio', 'ratio', 'video', 'image', 'frame'],
      order: 3260,
      sidebarLabel: 'Aspect Ratio',
      body: aspectRatioComponentBody,
      documents: [componentType('aspect-ratio')],
      stories: ['US-DESIGN-SYSTEM-COMPONENT-TYPES-LAYOUT-ASPECT-RATIO'],
    }),
    defineArticle({
      slug: 'label-component',
      title: 'The Label Component',
      description:
        'label — the name of one form control, wired to it so a click on the words focuses the control.',
      keywords: ['sovrium', 'label', 'form', 'accessible name', 'for'],
      order: 3261,
      sidebarLabel: 'Label',
      body: labelComponentBody,
      documents: [componentType('label')],
      stories: [],
    }),
    defineArticle({
      slug: 'collapsible-component',
      title: 'The Collapsible Component',
      description:
        'collapsible — one region behind one trigger, shown or hidden in place, with or without a script.',
      keywords: ['sovrium', 'collapsible', 'disclosure', 'details', 'summary', 'show more'],
      order: 3262,
      sidebarLabel: 'Collapsible',
      body: collapsibleComponentBody,
      documents: [componentType('collapsible')],
      stories: ['US-DESIGN-SYSTEM-COMPONENT-TYPES-DISPLAY-COLLAPSIBLE'],
    }),
    defineArticle({
      slug: 'marker-component',
      title: 'The Marker Component',
      description:
        'marker — an inline note in a thread or a list: a status, a system line, a labelled break, a link back.',
      keywords: ['sovrium', 'marker', 'thread', 'status', 'separator', 'system message'],
      order: 3263,
      sidebarLabel: 'Marker',
      body: markerComponentBody,
      documents: [componentType('marker')],
      stories: ['US-DESIGN-SYSTEM-COMPONENT-TYPES-DISPLAY-MARKER'],
    }),
    defineArticle({
      slug: 'attachment-component',
      title: 'The Attachment Component',
      description:
        'attachment — a file shown as a chip: its icon or thumbnail, its name and size, and a link to open it.',
      keywords: ['sovrium', 'attachment', 'file', 'chip', 'upload', 'download'],
      order: 3264,
      sidebarLabel: 'Attachment',
      body: attachmentComponentBody,
      documents: [componentType('attachment')],
      stories: ['US-DESIGN-SYSTEM-COMPONENT-TYPES-CONTENT-ATTACHMENT'],
    }),
    defineArticle({
      slug: 'message-component',
      title: 'The Message Component',
      description:
        'message — one turn of a conversation: who said it, when, on which side of the thread, around the bubble that holds it.',
      keywords: ['sovrium', 'message', 'chat', 'conversation', 'thread', 'turn'],
      order: 3265,
      sidebarLabel: 'Message',
      body: messageComponentBody,
      documents: [componentType('message')],
      stories: ['US-DESIGN-SYSTEM-COMPONENT-TYPES-DISPLAY-MESSAGE'],
    }),
    defineArticle({
      slug: 'message-scroller-component',
      title: 'The Message Scroller Component',
      description:
        'message-scroller — the scroll frame of a conversation: it opens at the latest turn and keeps its place.',
      keywords: ['sovrium', 'message scroller', 'chat', 'thread', 'scroll', 'log'],
      order: 3266,
      sidebarLabel: 'Message Scroller',
      body: messageScrollerComponentBody,
      documents: [componentType('message-scroller')],
      stories: ['US-DESIGN-SYSTEM-COMPONENT-TYPES-LAYOUT-MESSAGE-SCROLLER'],
    }),
    defineArticle({
      slug: 'questionnaire-component',
      title: 'The Questionnaire Component',
      description:
        'questionnaire — one question per screen, answered by choosing, submitted once through a form of the app.',
      keywords: ['sovrium', 'questionnaire', 'survey', 'quiz', 'onboarding', 'form'],
      order: 3267,
      sidebarLabel: 'Questionnaire',
      body: questionnaireComponentBody,
      documents: [componentType('questionnaire')],
      stories: ['US-DESIGN-SYSTEM-COMPONENT-TYPES-DATA-QUESTIONNAIRE'],
    }),
    defineArticle({
      slug: 'drawer-component',
      title: 'The Drawer Component',
      description:
        'drawer — a panel that rises from the bottom edge, rests at its snap points and is dragged down to dismiss.',
      keywords: ['sovrium', 'drawer', 'bottom sheet', 'mobile', 'overlay', 'snap points'],
      order: 3268,
      sidebarLabel: 'Drawer',
      body: drawerComponentBody,
      documents: [componentType('drawer')],
      stories: ['US-DESIGN-SYSTEM-COMPONENT-TYPES-OVERLAYS-DRAWER'],
    }),
    defineArticle({
      slug: 'calendar-component',
      title: 'The Calendar Component',
      description:
        'calendar — a month of days to pick one date, a range, or several, inline on the page, submitted as ISO text.',
      keywords: ['sovrium', 'calendar', 'date', 'range', 'day picker', 'booking'],
      order: 3269,
      sidebarLabel: 'Calendar',
      body: dayCalendarComponentBody,
      documents: [componentType('calendar')],
      stories: ['US-DESIGN-SYSTEM-COMPONENT-TYPES-FORM-CONTROLS-CALENDAR'],
    }),
  ],
})
