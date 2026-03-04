/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { favicons } from '../favicons'
import { footerI18n } from '../footer'
import { createNavbar, langSwitchScript, mobileMenuScript } from '../navbar'
import { shikiHighlightScript, shikiCustomStyles } from '../shiki'
import type { Page } from '@/index'

// ─── Docs Sidebar Toggle Script ─────────────────────────────────────────────
// Toggles the mobile docs sidebar (hidden by default on small screens).

const docsSidebarToggleScript = {
  code: [
    '(function(){',
    'var btn=document.getElementById("docs-sidebar-toggle");',
    'var nav=document.getElementById("docs-sidebar-mobile");',
    'if(!btn||!nav)return;',
    'btn.addEventListener("click",function(){',
    'var isHidden=nav.classList.contains("hidden");',
    'if(isHidden){nav.classList.remove("hidden")}',
    'else{nav.classList.add("hidden")}',
    '});',
    '})();',
  ].join(''),
  position: 'body-end' as const,
}

// ─── Docs Pages Definition ──────────────────────────────────────────────────

export interface DocsPageEntry {
  readonly id: string
  readonly sidebarLabel: string
  readonly sidebarHref: string
  readonly section: 'get-started' | 'app-schema' | 'resources'
}

export interface DocsSidebarSection {
  readonly id: string
  readonly label?: string
  readonly pages: readonly DocsPageEntry[]
}

const GET_STARTED_PAGES: readonly DocsPageEntry[] = [
  {
    id: 'introduction',
    sidebarLabel: '$t:docs.sidebar.introduction',
    sidebarHref: '$t:docs.sidebar.introduction.href',
    section: 'get-started',
  },
  {
    id: 'installation',
    sidebarLabel: '$t:docs.sidebar.installation',
    sidebarHref: '$t:docs.sidebar.installation.href',
    section: 'get-started',
  },
  {
    id: 'quick-start',
    sidebarLabel: '$t:docs.sidebar.quickStart',
    sidebarHref: '$t:docs.sidebar.quickStart.href',
    section: 'get-started',
  },
]

const APP_SCHEMA_PAGES: readonly DocsPageEntry[] = [
  {
    id: 'overview',
    sidebarLabel: '$t:docs.sidebar.overview',
    sidebarHref: '$t:docs.sidebar.overview.href',
    section: 'app-schema',
  },
  {
    id: 'tables',
    sidebarLabel: '$t:docs.sidebar.tables',
    sidebarHref: '$t:docs.sidebar.tables.href',
    section: 'app-schema',
  },
  {
    id: 'theme',
    sidebarLabel: '$t:docs.sidebar.theme',
    sidebarHref: '$t:docs.sidebar.theme.href',
    section: 'app-schema',
  },
  {
    id: 'pages',
    sidebarLabel: '$t:docs.sidebar.pages',
    sidebarHref: '$t:docs.sidebar.pages.href',
    section: 'app-schema',
  },
  {
    id: 'auth',
    sidebarLabel: '$t:docs.sidebar.auth',
    sidebarHref: '$t:docs.sidebar.auth.href',
    section: 'app-schema',
  },
  {
    id: 'languages',
    sidebarLabel: '$t:docs.sidebar.languages',
    sidebarHref: '$t:docs.sidebar.languages.href',
    section: 'app-schema',
  },
  {
    id: 'analytics',
    sidebarLabel: '$t:docs.sidebar.analytics',
    sidebarHref: '$t:docs.sidebar.analytics.href',
    section: 'app-schema',
  },
]

const RESOURCES_PAGES: readonly DocsPageEntry[] = [
  {
    id: 'api-reference',
    sidebarLabel: '$t:docs.sidebar.apiReference',
    sidebarHref: '$t:docs.sidebar.apiReference.href',
    section: 'resources',
  },
  {
    id: 'resources',
    sidebarLabel: '$t:docs.sidebar.resources',
    sidebarHref: '$t:docs.sidebar.resources.href',
    section: 'resources',
  },
]

export const DOCS_SIDEBAR_SECTIONS: readonly DocsSidebarSection[] = [
  {
    id: 'get-started',
    label: '$t:docs.sidebar.section.getStarted',
    pages: GET_STARTED_PAGES,
  },
  {
    id: 'app-schema',
    label: '$t:docs.sidebar.section.appSchema',
    pages: APP_SCHEMA_PAGES,
  },
  {
    id: 'resources',
    pages: RESOURCES_PAGES,
  },
]

/** Flat list of all docs pages in sidebar order (used for prev/next navigation). */
export const DOCS_PAGES: readonly DocsPageEntry[] = [
  ...GET_STARTED_PAGES,
  ...APP_SCHEMA_PAGES,
  ...RESOURCES_PAGES,
]

// ─── Badge Group Helper ─────────────────────────────────────────────────────
// Structural composition that wraps $ref badge-item components with a title.

export const badgeGroup = (title: string, items: readonly string[]) => ({
  type: 'div' as const,
  props: { className: 'mb-6' },
  children: [
    {
      type: 'h4' as const,
      content: title,
      props: { className: 'text-sm font-semibold text-sovereignty-light mb-2' },
    },
    {
      type: 'div' as const,
      props: { className: 'flex flex-wrap gap-2' },
      children: items.map((item) => ({
        $ref: 'docs-badge-item' as const,
        vars: { label: item },
      })),
    },
  ],
})

// ─── Code Block Helper ──────────────────────────────────────────────────────
// Shortcut for creating a docs-code-block $ref with lang.

export const codeBlock = (code: string, lang: string = 'yaml') => ({
  $ref: 'docs-code-block' as const,
  vars: { code, lang },
})

/** Code block indented to align with step text content (past the numbered circle). */
export const stepCodeBlock = (code: string, lang: string = 'yaml') => ({
  type: 'div' as const,
  props: { className: 'ml-12' },
  children: [codeBlock(code, lang)],
})

// ─── Callout Helpers ────────────────────────────────────────────────────────
// Shortcuts for tip and warning callouts with predefined colors.

export const calloutTip = (title: string, body: string) => ({
  $ref: 'docs-callout' as const,
  vars: {
    icon: '\u{1F4A1}',
    title,
    body,
    borderColor: 'border-sovereignty-accent',
    bgColor: 'bg-sovereignty-accent/5',
    titleColor: 'text-sovereignty-accent',
    textColor: 'text-sovereignty-gray-300',
  },
})

export const calloutWarning = (title: string, body: string) => ({
  $ref: 'docs-callout' as const,
  vars: {
    icon: '\u26A0\uFE0F',
    title,
    body,
    borderColor: 'border-yellow-500',
    bgColor: 'bg-yellow-500/5',
    titleColor: 'text-yellow-400',
    textColor: 'text-sovereignty-gray-300',
  },
})

// ─── Property Table Helper ──────────────────────────────────────────────────
// Builds a table with property-row refs for clean property documentation.

export const propertyTable = (rows: ReadonlyArray<{ name: string; description: string }>) => ({
  type: 'div' as const,
  props: {
    className:
      'overflow-x-auto my-4 border border-sovereignty-gray-800 rounded-lg bg-sovereignty-gray-900',
  },
  children: [
    {
      type: 'div' as const,
      props: {
        className:
          'grid grid-cols-[140px_1fr] sm:grid-cols-[180px_1fr] gap-2 py-2 px-4 border-b border-sovereignty-gray-800',
      },
      children: [
        {
          type: 'span' as const,
          content: 'Property',
          props: {
            className: 'text-xs font-semibold text-sovereignty-gray-500 uppercase tracking-wider',
          },
        },
        {
          type: 'span' as const,
          content: 'Description',
          props: {
            className: 'text-xs font-semibold text-sovereignty-gray-500 uppercase tracking-wider',
          },
        },
      ],
    },
    ...rows.map((row) => ({
      $ref: 'docs-property-row' as const,
      vars: { name: row.name, description: row.description },
    })),
  ],
})

// ─── Section Header Helper ──────────────────────────────────────────────────

export const sectionHeader = (title: string, description: string, anchor: string) => ({
  $ref: 'docs-section-header' as const,
  vars: { title, description, anchor },
})

// ─── Step Helper ────────────────────────────────────────────────────────────

export const step = (stepNumber: string, title: string, description: string) => ({
  $ref: 'docs-step' as const,
  vars: { stepNumber, title, description },
})

// ─── Sidebar Builder ────────────────────────────────────────────────────────

const ACTIVE_CLASS = 'text-sovereignty-accent bg-sovereignty-gray-900 font-medium'
const INACTIVE_CLASS =
  'text-sovereignty-gray-400 hover:text-sovereignty-accent hover:bg-sovereignty-gray-900'

function buildSidebarLinks(activeId: string): readonly object[] {
  return DOCS_SIDEBAR_SECTIONS.flatMap((section) => [
    // Section header label (omitted when no label — standalone links get spacing only)
    ...(section.label
      ? [
          {
            type: 'span' as const,
            content: section.label,
            props: {
              className:
                'block text-[11px] font-semibold uppercase tracking-wider text-sovereignty-gray-500 px-3 pt-5 pb-1 first:pt-0',
            },
          },
        ]
      : [
          {
            type: 'div' as const,
            props: { className: 'pt-4' },
            children: [] as readonly object[],
          },
        ]),
    // Section page links
    ...section.pages.map((page) => ({
      $ref: 'docs-nav-link' as const,
      vars: {
        href: page.sidebarHref,
        label: page.sidebarLabel,
        activeClass: page.id === activeId ? ACTIVE_CLASS : INACTIVE_CLASS,
      },
    })),
  ])
}

// ─── Prev / Next Navigation ─────────────────────────────────────────────────

function buildPrevNext(activeId: string) {
  const idx = DOCS_PAGES.findIndex((p) => p.id === activeId)
  const prev = idx > 0 ? DOCS_PAGES[idx - 1] : undefined
  const next = idx < DOCS_PAGES.length - 1 ? DOCS_PAGES[idx + 1] : undefined

  const prevNode = prev
    ? {
        type: 'link' as const,
        props: {
          href: prev.sidebarHref,
          className:
            'group flex items-center gap-2 text-sovereignty-gray-400 hover:text-sovereignty-accent transition-colors',
        },
        children: [
          {
            type: 'span' as const,
            content: '\u2190',
            props: { className: 'transition-transform group-hover:-translate-x-1' },
          },
          {
            type: 'span' as const,
            content: prev.sidebarLabel,
            props: {},
          },
        ],
      }
    : { type: 'div' as const, props: {} }

  const nextNode = next
    ? {
        type: 'link' as const,
        props: {
          href: next.sidebarHref,
          className:
            'group flex items-center gap-2 text-sovereignty-gray-400 hover:text-sovereignty-accent transition-colors ml-auto',
        },
        children: [
          {
            type: 'span' as const,
            content: next.sidebarLabel,
            props: {},
          },
          {
            type: 'span' as const,
            content: '\u2192',
            props: { className: 'transition-transform group-hover:translate-x-1' },
          },
        ],
      }
    : undefined

  return {
    type: 'div' as const,
    props: {
      className:
        'flex justify-between items-center mt-16 pt-8 border-t border-sovereignty-gray-800',
    },
    children: nextNode ? [prevNode, nextNode] : [prevNode],
  }
}

// ─── Page Factory ───────────────────────────────────────────────────────────

interface DocsPageOptions {
  readonly activeId: string
  readonly path: string
  readonly metaTitle: string
  readonly metaDescription: string
  readonly content: readonly object[]
}

export function docsPage(options: DocsPageOptions): Page {
  const { activeId, path, metaTitle, metaDescription, content } = options

  return {
    name: `docs-${activeId}`,
    path,
    meta: {
      title: metaTitle,
      description: metaDescription,
      favicons,
      customElements: shikiCustomStyles,
    },
    scripts: {
      inlineScripts: [
        mobileMenuScript,
        langSwitchScript,
        docsSidebarToggleScript,
        shikiHighlightScript,
      ],
    },
    sections: [
      // ── Navbar ──────────────────────────────────────────────────────────
      createNavbar('docs'),

      // ── Main Content (Sidebar + Content) ────────────────────────────────
      {
        type: 'section',
        props: {
          className: 'bg-sovereignty-darker text-sovereignty-light min-h-screen',
        },
        children: [
          {
            type: 'container',
            props: { className: 'max-w-6xl mx-auto px-4 py-12' },
            children: [
              // Mobile sidebar toggle button
              {
                type: 'div',
                props: { className: 'lg:hidden mb-6' },
                children: [
                  {
                    type: 'button',
                    content: '$t:docs.sidebar.toggle',
                    props: {
                      id: 'docs-sidebar-toggle',
                      type: 'button',
                      className:
                        'w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-sovereignty-gray-300 bg-sovereignty-gray-900 border border-sovereignty-gray-800 rounded-lg hover:bg-sovereignty-gray-800 transition-colors',
                    },
                  },
                ],
              },

              {
                type: 'div',
                props: { className: 'flex flex-col lg:flex-row gap-12' },
                children: [
                  // ── Mobile Sidebar (collapsible) ──────────────────────
                  {
                    type: 'nav',
                    props: {
                      id: 'docs-sidebar-mobile',
                      className: 'hidden lg:hidden mb-6',
                    },
                    children: [
                      {
                        type: 'div',
                        props: {
                          className: 'border-l border-sovereignty-gray-800 pl-2 space-y-1',
                        },
                        children: buildSidebarLinks(activeId),
                      },
                    ],
                  },

                  // ── Desktop Sidebar (always visible) ──────────────────
                  {
                    type: 'nav',
                    props: {
                      className:
                        'lg:w-56 flex-shrink-0 lg:sticky lg:top-20 lg:self-start hidden lg:block',
                    },
                    children: [
                      {
                        type: 'div',
                        props: {
                          className: 'border-l border-sovereignty-gray-800 pl-2 space-y-1',
                        },
                        children: buildSidebarLinks(activeId),
                      },
                    ],
                  },

                  // ── Content ───────────────────────────────────────────
                  {
                    type: 'div',
                    props: { className: 'flex-1 min-w-0 space-y-12' },
                    children: [...content, buildPrevNext(activeId)],
                  },
                ],
              },
            ],
          },
        ],
      },

      // ── Footer ──────────────────────────────────────────────────────────
      footerI18n,
    ],
  } as Page
}
