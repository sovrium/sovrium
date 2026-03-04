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

// ─── docs-code-block: Syntax-highlighted code with Shiki + copy button ──────
// vars: { code, lang, langIcon, langLabel }
// lang: yaml | json | typescript | bash | text (default: yaml)
// langIcon: Lucide icon name for the language header (e.g. 'file-text', 'terminal')
// langLabel: Display label for the language header (e.g. 'YAML', 'Terminal')
// Shiki script upgrades [data-shiki] elements post-render; plain text is fallback
export const docsCodeBlock: ComponentTemplate = {
  name: 'docs-code-block',
  type: 'div',
  props: {
    className:
      'docs-code-wrapper relative bg-sovereignty-gray-900 border border-sovereignty-gray-800 rounded-lg overflow-hidden my-4',
  },
  children: [
    {
      type: 'div',
      props: {
        className:
          'flex items-center gap-2 px-4 py-1.5 border-b border-sovereignty-gray-800 text-sovereignty-gray-500',
      },
      children: [
        {
          type: 'icon',
          props: { name: '$langIcon', size: 13, className: 'flex-shrink-0' },
        },
        {
          type: 'span',
          content: '$langLabel',
          props: { className: 'text-[11px] font-medium uppercase tracking-wider' },
        },
      ],
    },
    {
      type: 'div',
      props: {
        className: 'p-4 overflow-x-auto',
        'data-shiki': 'true',
        'data-lang': '$lang',
      },
      children: [
        {
          type: 'pre',
          content: '$code',
          props: {
            className:
              'text-sm font-mono text-sovereignty-gray-300 whitespace-pre-wrap leading-relaxed m-0',
          },
        },
      ],
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

// ─── docs-info-card-icon: Info card with a leading Lucide icon ───────────────
// Used in introduction.ts "Why Sovrium?" section
// vars: { iconName, title, description }
export const docsInfoCardIcon: ComponentTemplate = {
  name: 'docs-info-card-icon',
  type: 'div',
  props: {
    className:
      'bg-sovereignty-gray-900 border border-sovereignty-gray-800 p-6 rounded-lg hover:border-sovereignty-accent/30 transition-colors',
  },
  children: [
    {
      type: 'div',
      props: { className: 'flex items-center gap-2.5 mb-3' },
      children: [
        {
          type: 'div',
          props: {
            className:
              'flex items-center justify-center w-8 h-8 rounded-lg bg-sovereignty-accent/10 text-sovereignty-accent flex-shrink-0',
          },
          children: [
            {
              type: 'icon',
              props: { name: '$iconName', size: 16 },
            },
          ],
        },
        {
          type: 'h4',
          content: '$title',
          props: { className: 'text-lg font-semibold text-sovereignty-light' },
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

// ─── docs-callout: Tip/warning/info box with colored left border ────────────
// vars: { iconName, title, body, borderColor, bgColor, titleColor, iconColor, textColor }
export const docsCallout: ComponentTemplate = {
  name: 'docs-callout',
  type: 'div',
  props: {
    className: 'rounded-lg p-4 my-4 border-l-4 $borderColor $bgColor',
  },
  children: [
    {
      type: 'div',
      props: { className: 'flex items-start gap-3' },
      children: [
        {
          type: 'div',
          props: { className: 'flex-shrink-0 mt-0.5 $iconColor' },
          children: [
            {
              type: 'icon',
              props: { name: '$iconName', size: 16 },
            },
          ],
        },
        {
          type: 'div',
          props: {},
          children: [
            {
              type: 'h4',
              content: '$title',
              props: { className: 'text-sm font-semibold mb-1 $titleColor' },
            },
            {
              type: 'paragraph',
              content: '$body',
              props: { className: 'text-sm leading-relaxed $textColor' },
            },
          ],
        },
      ],
    },
  ],
}

// ─── docs-section-header: Consistent h2 with anchor + description ───────────
// vars: { title, description, anchor }
export const docsSectionHeader: ComponentTemplate = {
  name: 'docs-section-header',
  type: 'div',
  props: { className: 'mb-6' },
  children: [
    {
      type: 'h2',
      content: '$title',
      props: {
        id: '$anchor',
        className: 'text-2xl font-bold text-sovereignty-light mb-2',
        style: 'scroll-margin-top:5rem',
      },
    },
    {
      type: 'paragraph',
      content: '$description',
      props: { className: 'text-sm text-sovereignty-gray-400 leading-relaxed' },
    },
  ],
}

// ─── docs-step: Numbered step with circle + title + description ─────────────
// vars: { stepNumber, title, description }
export const docsStep: ComponentTemplate = {
  name: 'docs-step',
  type: 'div',
  props: { className: 'flex gap-4 mb-6' },
  children: [
    {
      type: 'div',
      props: {
        className:
          'flex-shrink-0 w-8 h-8 rounded-full bg-sovereignty-accent/20 text-sovereignty-accent flex items-center justify-center text-sm font-bold',
      },
      children: [
        {
          type: 'span',
          content: '$stepNumber',
          props: {},
        },
      ],
    },
    {
      type: 'div',
      props: { className: 'flex-1 pt-0.5' },
      children: [
        {
          type: 'h4',
          content: '$title',
          props: { className: 'font-semibold text-sovereignty-light mb-1' },
        },
        {
          type: 'paragraph',
          content: '$description',
          props: { className: 'text-sm text-sovereignty-gray-400 leading-relaxed' },
        },
      ],
    },
  ],
}

// ─── docs-screenshot: Figure with lazy-loaded image + caption ────────────────
// vars: { src, alt, caption }
export const docsScreenshot: ComponentTemplate = {
  name: 'docs-screenshot',
  type: 'div',
  props: { className: 'my-6' },
  children: [
    {
      type: 'div',
      props: {
        className:
          'rounded-lg overflow-hidden border border-sovereignty-gray-800 bg-sovereignty-gray-900',
      },
      children: [
        {
          type: 'image',
          props: {
            src: '$src',
            alt: '$alt',
            className: 'w-full h-auto',
            loading: 'lazy',
          },
        },
      ],
    },
    {
      type: 'paragraph',
      content: '$caption',
      props: {
        className: 'text-xs text-sovereignty-gray-500 mt-2 text-center italic',
      },
    },
  ],
}

// ─── docs-property-row: Single row for property references ───────────────────
// vars: { name, description }
export const docsPropertyRow: ComponentTemplate = {
  name: 'docs-property-row',
  type: 'div',
  props: {
    className:
      'grid grid-cols-[minmax(120px,auto)_1fr] gap-4 py-3 px-4 border-b border-sovereignty-gray-800 last:border-0',
  },
  children: [
    {
      type: 'span',
      content: '$name',
      props: {
        className: 'font-mono text-sm text-sovereignty-accent font-semibold break-all min-w-0',
      },
    },
    {
      type: 'span',
      content: '$description',
      props: { className: 'text-sm text-sovereignty-gray-400' },
    },
  ],
}
