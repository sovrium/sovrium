/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// sovrium-library: block/command@0.37.0#11d80c9163ba

// in-console navigation and `trackNavigation` re-derives the current row on
// the client. `admin-spa-nav` and the palette sit OUTSIDE that frame, so a swap
// never unmounts them.
// ── The ⌘K palette ──────────────────────────────────────────────────────────────
// INSTALLED from the library's `command` block; its bindings are `search`
// (cross-entity search over `/api/admin/search`) and `groups` (the one
// authored row below). Declared rather than inherited: `app.ts` turns the
// generic record palette off, since two palettes on one ⌘K open two overlays.
// `kindLabels` is absent on purpose — the engine names each kind the search
// returns, and a third copy of that vocabulary could drift silently. It draws
// no markup until the first ⌘K, and stays outside the SPA swap region so the
// listener survives a navigation.
//
// « Go to » comes first: every destination of the sidebar in its order, plus
// the account's own two pages, each captioned with the sidebar group it sits
// in (typing matches the caption too). It is the palette's empty state, so an
// operator who opens ⌘K and types nothing already has somewhere to go. An item
// whose page needs a declared kind carries the same `declares` gate as that
// page, so the palette never offers an address that would 404.
//
// « Ask about this app » takes the words typed so far (`$query`) to the
// Overview's assistant, unsent. Its group carries the composer's own gate — a
// model to answer and a caller allowed to act — so a read-only operator's page
// never carries the row.

import type { TemplateNodeEncoded } from '@/domain/models/app/components'

export const consoleShellPalette: TemplateNodeEncoded = {
  type: 'command',
  search: {
    endpoint: '/api/admin/search',
    placeholder: '$t:admin.palette.placeholder',
  },
  groups: [
    {
      label: '$t:admin.palette.goTo.group',
      items: [
        { label: '$t:admin.nav.overview', icon: 'house', href: '/' },
        {
          label: '$t:admin.crumb.runs',
          description: '$t:admin.nav.group.activity',
          icon: 'zap',
          href: '/runs',
          visibility: { declares: 'automations' },
        },
        {
          label: '$t:admin.crumb.submissions',
          description: '$t:admin.nav.group.activity',
          icon: 'inbox',
          href: '/submissions',
          visibility: { declares: 'forms' },
        },
        {
          label: '$t:admin.crumb.conversations',
          description: '$t:admin.nav.group.activity',
          icon: 'messages-square',
          href: '/conversations',
          visibility: { declares: 'agents' },
        },
        {
          label: '$t:admin.crumb.records',
          description: '$t:admin.nav.group.data',
          icon: 'table',
          href: '/records',
          visibility: { declares: 'tables' },
        },
        {
          label: '$t:admin.crumb.files',
          description: '$t:admin.nav.group.data',
          icon: 'folder',
          href: '/files',
          visibility: { declares: 'buckets' },
        },
        {
          label: '$t:admin.crumb.signatures',
          description: '$t:admin.nav.group.data',
          icon: 'signature',
          href: '/signatures',
          visibility: { declares: 'signatures' },
        },
        {
          label: '$t:admin.crumb.connections',
          description: '$t:admin.nav.group.data',
          icon: 'plug',
          href: '/connections',
          visibility: { declares: 'connections' },
        },
        {
          label: '$t:admin.crumb.analytics',
          description: '$t:admin.nav.group.audience',
          icon: 'chart-line',
          href: '/analytics',
        },
        {
          label: '$t:admin.crumb.links',
          description: '$t:admin.nav.group.audience',
          icon: 'link',
          href: '/links',
          visibility: { declares: 'links' },
        },
        {
          label: '$t:admin.crumb.templates',
          description: '$t:admin.nav.group.audience',
          icon: 'layout-template',
          href: '/templates',
          visibility: { declares: 'assets.templates' },
        },
        {
          label: '$t:admin.crumb.users',
          description: '$t:admin.nav.group.people',
          icon: 'users',
          href: '/users',
        },
        {
          label: '$t:admin.crumb.organisation',
          description: '$t:admin.nav.group.people',
          icon: 'network',
          href: '/organisation',
          visibility: { declares: 'data' },
        },
        {
          label: '$t:admin.crumb.env',
          description: '$t:admin.nav.group.instance',
          icon: 'braces',
          href: '/env',
        },
        {
          label: '$t:admin.crumb.auditLog',
          description: '$t:admin.nav.group.instance',
          icon: 'clipboard-list',
          href: '/audit-log',
        },
        {
          label: '$t:admin.crumb.changelog',
          description: '$t:admin.nav.group.instance',
          icon: 'history',
          href: '/changelog',
        },
        {
          label: '$t:admin.crumb.decisions',
          description: '$t:admin.nav.group.instance',
          icon: 'scroll-text',
          href: '/decisions',
          visibility: { declares: 'decisions' },
        },
        {
          label: '$t:admin.crumb.footprint',
          description: '$t:admin.nav.group.instance',
          icon: 'leaf',
          href: '/footprint',
        },
        {
          label: '$t:admin.crumb.api',
          description: '$t:admin.nav.group.developers',
          icon: 'book-open',
          href: '/api',
        },
        {
          label: '$t:admin.crumb.mcp',
          description: '$t:admin.nav.group.developers',
          icon: 'bot',
          href: '/mcp',
        },
        {
          label: '$t:admin.crumb.apiKeys',
          description: '$t:admin.nav.group.developers',
          icon: 'key-round',
          href: '/api-keys',
          visibility: { declares: 'auth.apiKeys' },
        },
        {
          label: '$t:admin.nav.design.overview',
          description: '$t:admin.nav.group.design',
          icon: 'palette',
          href: '/design-system',
        },
        {
          label: '$t:admin.nav.design.foundations',
          description: '$t:admin.nav.group.design',
          icon: 'swatch-book',
          href: '/design-system/foundations',
        },
        {
          label: '$t:admin.nav.design.components',
          description: '$t:admin.nav.group.design',
          icon: 'component',
          href: '/design-system/components',
          visibility: { declares: 'components' },
        },
        {
          label: '$t:admin.nav.design.brand',
          description: '$t:admin.nav.group.design',
          icon: 'badge',
          href: '/design-system/brand',
          visibility: { declares: 'design.brand' },
        },
        {
          label: '$t:admin.nav.design.voice',
          description: '$t:admin.nav.group.design',
          icon: 'message-square-quote',
          href: '/design-system/voice',
          visibility: { declares: 'design.voice' },
        },
        {
          label: '$t:admin.crumb.profile',
          description: '$t:admin.palette.goTo.group.account',
          icon: 'user',
          href: '/profile',
        },
        {
          label: '$t:admin.crumb.gdpr',
          description: '$t:admin.palette.goTo.group.account',
          icon: 'shield',
          href: '/gdpr',
        },
      ],
    },
    {
      label: '$t:admin.palette.ask.group',
      visibility: {
        runtime: 'ai',
        capability: 'edit-operations',
      },
      items: [
        {
          label: '$t:admin.palette.ask.label',
          emptyLabel: '$t:admin.palette.ask.empty',
          icon: 'message-square',
          href: '/?q=$query',
        },
      ],
    },
    {
      label: '$t:admin.palette.help.group',
      items: [{ label: '$t:admin.palette.help.report', icon: 'life-buoy', href: '/report' }],
    },
  ],
}
