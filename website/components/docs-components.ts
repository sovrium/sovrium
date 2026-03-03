/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { ComponentTemplate } from '@/index'

// ─── docs-nav-link: Sidebar navigation link for multi-page docs ─────────────
// Used in docs/shared.ts sidebar (8 links per page)
// vars: { href: '/en/docs/tables', label: 'Tables & Fields', activeClass: '...' }
// activeClass is set by docsPage() builder:
//   Active:   'text-sovereignty-accent bg-sovereignty-gray-900 font-medium'
//   Inactive: 'text-sovereignty-gray-400 hover:text-sovereignty-accent hover:bg-sovereignty-gray-900'
export const docsNavLink: ComponentTemplate = {
  name: 'docs-nav-link',
  type: 'link',
  content: '$label',
  props: {
    href: '$href',
    className: 'block py-2 px-3 text-sm transition-colors rounded $activeClass',
  },
}

// ─── docs-code-block: Monospace code display with dark background ───────────
// Used in docs-schema.ts for YAML/JSON code examples
// vars: { code: 'name: my-app\nversion: 1.0.0' }
export const docsCodeBlock: ComponentTemplate = {
  name: 'docs-code-block',
  type: 'div',
  props: {
    className:
      'bg-sovereignty-gray-900 border border-sovereignty-gray-800 rounded-lg p-4 overflow-x-auto my-4',
  },
  children: [
    {
      type: 'span',
      content: '$code',
      props: {
        className:
          'text-sm font-mono text-sovereignty-gray-300 whitespace-pre-wrap block leading-relaxed',
      },
    },
  ],
}

// ─── docs-property-card: Schema property with name, type badge, description ─
// Used in docs-schema.ts Root Properties section (10 cards)
// vars: { name, type, requiredClass, description }
// requiredClass: '' (visible) or 'hidden' (hidden)
export const docsPropertyCard: ComponentTemplate = {
  name: 'docs-property-card',
  type: 'div',
  props: {
    className: 'bg-sovereignty-gray-900 border border-sovereignty-gray-800 p-4 rounded-lg',
  },
  children: [
    {
      type: 'div',
      props: { className: 'flex flex-wrap items-center gap-2 mb-2' },
      children: [
        {
          type: 'span',
          content: '$name',
          props: { className: 'font-mono text-sovereignty-accent font-semibold' },
        },
        {
          type: 'span',
          content: '$type',
          props: {
            className:
              'text-xs px-2 py-0.5 bg-sovereignty-gray-800 rounded text-sovereignty-gray-400 font-mono',
          },
        },
        {
          type: 'span',
          content: 'required',
          props: {
            className:
              '$requiredClass text-xs px-2 py-0.5 bg-sovereignty-accent/20 rounded text-sovereignty-accent',
          },
        },
      ],
    },
    {
      type: 'paragraph',
      content: '$description',
      props: { className: 'text-sm text-sovereignty-gray-400 leading-relaxed' },
    },
  ],
}

// ─── docs-info-card: Titled card for feature descriptions ───────────────────
// Used in docs-schema.ts Theme and Auth sections
// vars: { title, description }
export const docsInfoCard: ComponentTemplate = {
  name: 'docs-info-card',
  type: 'div',
  props: {
    className:
      'bg-sovereignty-gray-900 border border-sovereignty-gray-800 p-6 rounded-lg hover:border-sovereignty-accent/30 transition-colors',
  },
  children: [
    {
      type: 'h4',
      content: '$title',
      props: { className: 'text-lg font-semibold mb-3 text-sovereignty-light' },
    },
    {
      type: 'paragraph',
      content: '$description',
      props: { className: 'text-sm text-sovereignty-gray-400 leading-relaxed' },
    },
  ],
}

// ─── docs-resource-link: Linked resource card with description ──────────────
// Used in docs-schema.ts Resources section (4 cards)
// vars: { label, href, description }
export const docsResourceLink: ComponentTemplate = {
  name: 'docs-resource-link',
  type: 'div',
  props: {
    className:
      'bg-sovereignty-gray-900 border border-sovereignty-gray-800 p-4 rounded-lg hover:border-sovereignty-accent/30 transition-colors',
  },
  children: [
    {
      type: 'link',
      content: '$label',
      props: {
        href: '$href',
        className: 'font-semibold text-sovereignty-accent hover:underline',
      },
    },
    {
      type: 'paragraph',
      content: '$description',
      props: { className: 'text-sm text-sovereignty-gray-400 mt-1' },
    },
  ],
}

// ─── docs-badge-item: Inline monospace badge for field/component types ──────
// Used in docs-schema.ts Tables & Pages sections (100+ badges)
// vars: { label: 'single-line-text' }
export const docsBadgeItem: ComponentTemplate = {
  name: 'docs-badge-item',
  type: 'span',
  content: '$label',
  props: {
    className:
      'text-xs font-mono px-2 py-1 bg-sovereignty-gray-800 rounded text-sovereignty-gray-300 border border-sovereignty-gray-700',
  },
}
