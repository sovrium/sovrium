/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { favicons } from '../favicons'
import { footerI18n } from '../footer'
import {
  createNavbar,
  createSearchModal,
  langSwitchScript,
  mobileMenuScript,
  searchScript,
} from '../navbar'
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

// ─── TOC (Table of Contents) Types ──────────────────────────────────────────

export interface TocEntry {
  readonly label: string
  readonly anchor: string
  readonly children?: readonly TocEntry[]
}

// ─── Docs Pages Definition ──────────────────────────────────────────────────

export interface DocsPageEntry {
  readonly id: string
  readonly sidebarLabel: string
  readonly sidebarHref: string
  readonly section: 'get-started' | 'app-schema' | 'references'
}

/** An external link rendered in the sidebar (not a routable page). */
export interface DocsSidebarExternalLink {
  readonly label: string
  readonly href: string
  readonly external: true
}

export interface DocsSidebarSection {
  readonly id: string
  readonly label?: string
  readonly icon?: string
  readonly pages: readonly DocsPageEntry[]
  readonly externalLinks?: readonly DocsSidebarExternalLink[]
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

const REFERENCES_PAGES: readonly DocsPageEntry[] = [
  {
    id: 'api-reference',
    sidebarLabel: '$t:docs.sidebar.apiReference',
    sidebarHref: '$t:docs.sidebar.apiReference.href',
    section: 'references',
  },
  {
    id: 'json-schema',
    sidebarLabel: '$t:docs.sidebar.jsonSchema',
    sidebarHref: '$t:docs.sidebar.jsonSchema.href',
    section: 'references',
  },
]

const REFERENCES_EXTERNAL_LINKS: readonly DocsSidebarExternalLink[] = [
  {
    label: '$t:docs.sidebar.llmReference',
    href: '/llms.txt',
    external: true,
  },
  {
    label: '$t:docs.sidebar.roadmap',
    href: 'https://github.com/sovrium/sovrium/issues/7107',
    external: true,
  },
  {
    label: '$t:docs.sidebar.contributing',
    href: 'https://github.com/sovrium/sovrium/blob/main/CONTRIBUTING.md',
    external: true,
  },
  {
    label: '$t:docs.sidebar.license',
    href: 'https://github.com/sovrium/sovrium/blob/main/LICENSE.md',
    external: true,
  },
]

export const DOCS_SIDEBAR_SECTIONS: readonly DocsSidebarSection[] = [
  {
    id: 'get-started',
    label: '$t:docs.sidebar.section.getStarted',
    icon: 'rocket',
    pages: GET_STARTED_PAGES,
  },
  {
    id: 'app-schema',
    label: '$t:docs.sidebar.section.appSchema',
    icon: 'file-code-2',
    pages: APP_SCHEMA_PAGES,
  },
  {
    id: 'references',
    label: '$t:docs.sidebar.section.references',
    icon: 'book-open',
    pages: REFERENCES_PAGES,
    externalLinks: REFERENCES_EXTERNAL_LINKS,
  },
]

/** Flat list of all docs pages in sidebar order (used for prev/next navigation). */
export const DOCS_PAGES: readonly DocsPageEntry[] = [
  ...GET_STARTED_PAGES,
  ...APP_SCHEMA_PAGES,
  ...REFERENCES_PAGES,
]

// ─── Subsection Header Helper ───────────────────────────────────────────────
// Consistent h3 styling matching the quick-start page reference standard.
// Use for TOC-linked subsections within a section (h3 level).

export const subsectionHeader = (title: string, description: string, anchor?: string) => ({
  type: 'div' as const,
  props: { className: 'mb-4' },
  children: [
    {
      type: 'h3' as const,
      content: title,
      props: {
        className: 'text-xl font-bold mb-2 text-sovereignty-light',
        ...(anchor ? { id: anchor, style: 'scroll-margin-top:5rem' } : {}),
      },
    },
    ...(description
      ? [
          {
            type: 'paragraph' as const,
            content: description,
            props: { className: 'text-sm text-sovereignty-gray-400 leading-relaxed' },
          },
        ]
      : []),
  ],
})

// ─── Badge Group Helper ─────────────────────────────────────────────────────
// Structural composition that wraps $ref badge-item components with a title.
// Title renders as h3 (subsection level) when an anchor is provided (TOC-linked),
// or as h4 (minor label) when no anchor.

export const badgeGroup = (title: string, items: readonly string[], anchor?: string) => ({
  type: 'div' as const,
  props: { className: 'mb-6' },
  children: [
    ...(title
      ? [
          {
            type: (anchor ? 'h3' : 'h4') as 'h3' | 'h4',
            content: title,
            props: {
              className: anchor
                ? 'text-xl font-bold text-sovereignty-light mb-3'
                : 'text-sm font-semibold text-sovereignty-light mb-2',
              ...(anchor ? { id: anchor, style: 'scroll-margin-top:5rem' } : {}),
            },
          },
        ]
      : []),
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
// Shortcut for creating a docs-code-block $ref with lang, icon, and label.

const LANG_META: Record<string, { icon: string; label: string }> = {
  bash: { icon: 'terminal', label: 'Terminal' },
  shell: { icon: 'terminal', label: 'Terminal' },
  json: { icon: 'braces', label: 'JSON' },
  yaml: { icon: 'file-text', label: 'YAML' },
  yml: { icon: 'file-text', label: 'YAML' },
  typescript: { icon: 'file-code', label: 'TypeScript' },
  ts: { icon: 'file-code', label: 'TypeScript' },
  javascript: { icon: 'file-code', label: 'JavaScript' },
  js: { icon: 'file-code', label: 'JavaScript' },
  text: { icon: 'file-text', label: 'Text' },
}

export const codeBlock = (code: string, lang: string = 'yaml') => {
  const meta = LANG_META[lang] ?? { icon: 'file-text', label: lang.toUpperCase() }
  return {
    $ref: 'docs-code-block' as const,
    vars: { code, lang, langIcon: meta.icon, langLabel: meta.label },
  }
}

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
    iconName: 'lightbulb',
    title,
    body,
    borderColor: 'border-sovereignty-accent',
    bgColor: 'bg-sovereignty-accent/5',
    titleColor: 'text-sovereignty-accent',
    iconColor: 'text-sovereignty-accent',
    textColor: 'text-sovereignty-gray-300',
  },
})

export const calloutWarning = (title: string, body: string) => ({
  $ref: 'docs-callout' as const,
  vars: {
    iconName: 'triangle-alert',
    title,
    body,
    borderColor: 'border-yellow-500',
    bgColor: 'bg-yellow-500/5',
    titleColor: 'text-yellow-400',
    iconColor: 'text-yellow-400',
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

// ─── Endpoint Row Helper ────────────────────────────────────────────────────
// Renders a single API endpoint as a flex row with colored method badge + path + description.

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  POST: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  PATCH: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  DELETE: 'bg-red-500/15 text-red-400 border-red-500/30',
}

export const endpointRow = (
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  description: string
) => ({
  type: 'div' as const,
  props: {
    className: 'py-2.5 px-3 rounded-md hover:bg-sovereignty-gray-900/50',
  },
  children: [
    {
      type: 'div' as const,
      props: { className: 'flex items-center gap-3' },
      children: [
        {
          type: 'span' as const,
          content: method,
          props: {
            className: `inline-flex items-center justify-center w-16 shrink-0 text-[11px] font-bold tracking-wider rounded border px-1.5 py-0.5 ${METHOD_COLORS[method] ?? ''}`,
          },
        },
        {
          type: 'span' as const,
          content: path,
          props: {
            className: 'font-mono text-sm text-sovereignty-light break-all',
          },
        },
      ],
    },
    {
      type: 'paragraph' as const,
      content: description,
      props: {
        className: 'text-sm text-sovereignty-gray-400 mt-1 ml-[76px]',
      },
    },
  ],
})

/** Wraps a list of endpointRow() calls with a sub-section title and consistent spacing. */
export const endpointGroup = (
  title: string,
  description: string,
  rows: readonly object[],
  anchor?: string
) => ({
  type: 'div' as const,
  props: { className: 'space-y-1 mt-4 first:mt-0' },
  children: [
    // Only render title/description when non-empty
    ...(title
      ? [
          {
            type: 'h3' as const,
            content: title,
            props: {
              className: 'text-xl font-bold text-sovereignty-light mb-1',
              ...(anchor ? { id: anchor, style: 'scroll-margin-top:5rem' } : {}),
            },
          },
        ]
      : []),
    ...(description
      ? [
          {
            type: 'paragraph' as const,
            content: description,
            props: { className: 'text-sm text-sovereignty-gray-400 mb-3' },
          },
        ]
      : []),
    {
      type: 'div' as const,
      props: {
        className:
          'border border-sovereignty-gray-800 rounded-lg bg-sovereignty-gray-900/30 divide-y divide-sovereignty-gray-800/50',
      },
      children: rows,
    },
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
    // Section header label with optional icon (omitted when no label — standalone links get spacing only)
    ...(section.label
      ? [
          {
            type: 'div' as const,
            props: {
              className: 'flex items-center gap-2 px-3 pt-5 pb-1 first:pt-0',
            },
            children: [
              ...(section.icon
                ? [
                    {
                      type: 'icon' as const,
                      props: {
                        name: section.icon,
                        size: 14,
                        className: 'text-sovereignty-gray-500 flex-shrink-0',
                      },
                    },
                  ]
                : []),
              {
                type: 'span' as const,
                content: section.label,
                props: {
                  className:
                    'text-[11px] font-semibold uppercase tracking-wider text-sovereignty-gray-500',
                },
              },
            ],
          },
        ]
      : [
          {
            type: 'div' as const,
            props: { className: 'pt-4' },
            children: [
              ...(section.icon
                ? [
                    {
                      type: 'div' as const,
                      props: {
                        className: 'flex items-center gap-2 px-3 pb-1',
                      },
                      children: [
                        {
                          type: 'icon' as const,
                          props: {
                            name: section.icon,
                            size: 14,
                            className: 'text-sovereignty-gray-500 flex-shrink-0',
                          },
                        },
                      ],
                    },
                  ]
                : []),
            ],
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
    // External links (rendered with an external-link icon)
    ...(section.externalLinks ?? []).map((link) => ({
      type: 'link' as const,
      props: {
        href: link.href,
        target: '_blank',
        rel: 'noopener noreferrer',
        className: `block py-2 px-3 text-sm transition-colors rounded ${INACTIVE_CLASS}`,
      },
      children: [
        {
          type: 'span' as const,
          props: { className: 'inline-flex items-center gap-1.5' },
          children: [
            {
              type: 'span' as const,
              content: link.label,
              props: {},
            },
            {
              type: 'icon' as const,
              props: {
                name: 'external-link',
                size: 12,
                className: 'opacity-50 flex-shrink-0',
              },
            },
          ],
        },
      ],
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
            props: { className: 'transition-transform group-hover:-translate-x-1' },
            children: [
              {
                type: 'icon' as const,
                props: { name: 'chevron-left', size: 16 },
              },
            ],
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
            props: { className: 'transition-transform group-hover:translate-x-1' },
            children: [
              {
                type: 'icon' as const,
                props: { name: 'chevron-right', size: 16 },
              },
            ],
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

// ─── TOC Scroll Tracking Script ─────────────────────────────────────────────
// Uses a scroll listener to highlight the currently visible section in the
// right-side "On this page" table of contents. Finds the last heading whose
// top is above a threshold (100px from viewport top) to determine the active
// section. Falls back to the first section when scrolled to the very top.

const tocScrollTrackingScript = {
  code: [
    '(function(){',
    'var toc=document.getElementById("docs-toc");',
    'if(!toc)return;',
    'var links=toc.querySelectorAll("a[data-toc-anchor]");',
    'if(!links.length)return;',
    'var ids=[];',
    'links.forEach(function(l){ids.push(l.getAttribute("data-toc-anchor"))});',
    'var els=[];',
    'ids.forEach(function(id){var el=document.getElementById(id);if(el)els.push({id:id,el:el})});',
    'if(!els.length)return;',
    'var activeId=null;',
    'function setActive(id){',
    'if(id===activeId)return;',
    'activeId=id;',
    'links.forEach(function(l){',
    'var a=l.getAttribute("data-toc-anchor");',
    'var isChild=l.hasAttribute("data-toc-child");',
    'var inactiveClass=isChild?"text-sovereignty-gray-500":"text-sovereignty-gray-400";',
    'if(a===id){',
    'l.classList.remove(inactiveClass);',
    'l.classList.add("text-sovereignty-accent","font-medium");',
    '}else{',
    'l.classList.remove("text-sovereignty-accent","font-medium");',
    'l.classList.add(inactiveClass);',
    '}',
    '});',
    '}',
    'var ticking=false;',
    'function update(){',
    'var found=null;',
    'for(var i=0;i<els.length;i++){',
    'if(els[i].el.getBoundingClientRect().top<=100)found=els[i].id;',
    '}',
    'setActive(found||els[0].id);',
    'ticking=false;',
    '}',
    'window.addEventListener("scroll",function(){',
    'if(!ticking){ticking=true;requestAnimationFrame(update)}',
    '},{passive:true});',
    'update();',
    '})();',
  ].join(''),
  position: 'body-end' as const,
}

// ─── TOC Builder ────────────────────────────────────────────────────────────
// Builds the right-side "On this page" navigation from TocEntry array.
// Returns an empty array when there are no entries (page has no sections).

function buildTocLink(entry: TocEntry, isChild: boolean = false): object {
  const className = isChild
    ? 'block py-0.5 text-[12px] leading-snug text-sovereignty-gray-500 hover:text-sovereignty-accent transition-colors duration-150'
    : 'block py-1 text-[13px] leading-snug text-sovereignty-gray-400 hover:text-sovereignty-accent transition-colors duration-150'
  const props: Record<string, string> = {
    href: `#${entry.anchor}`,
    'data-toc-anchor': entry.anchor,
    className,
    ...(isChild ? { 'data-toc-child': '' } : {}),
  }
  return {
    type: 'link' as const,
    content: entry.label,
    props,
  }
}

function buildTocEntries(entries: readonly TocEntry[]): readonly object[] {
  return entries.flatMap((entry) => {
    const parentLink = buildTocLink(entry)
    if (!entry.children || entry.children.length === 0) return [parentLink]
    const childLinks = {
      type: 'div' as const,
      props: { className: 'pl-3 space-y-0.5' },
      children: entry.children.map((child) => buildTocLink(child, true)),
    }
    return [parentLink, childLinks]
  })
}

function buildTocColumn(entries: readonly TocEntry[]): readonly object[] {
  if (entries.length === 0) return []

  return [
    {
      type: 'nav' as const,
      props: {
        id: 'docs-toc',
        'aria-label': 'Table of contents',
        className: 'xl:w-48 flex-shrink-0 xl:sticky xl:top-20 xl:self-start hidden xl:block',
      },
      children: [
        {
          type: 'span' as const,
          content: '$t:docs.toc.heading',
          props: {
            className:
              'block text-[11px] font-semibold uppercase tracking-wider text-sovereignty-gray-500 mb-3',
          },
        },
        {
          type: 'div' as const,
          props: {
            className: 'border-l border-sovereignty-gray-800 pl-3 space-y-1',
          },
          children: buildTocEntries(entries),
        },
      ],
    },
  ]
}

// ─── Page Factory ───────────────────────────────────────────────────────────

interface DocsPageOptions {
  readonly activeId: string
  readonly path: string
  readonly metaTitle: string
  readonly metaDescription: string
  readonly content: readonly object[]
  readonly toc?: readonly TocEntry[]
}

export function docsPage(options: DocsPageOptions): Page {
  const { activeId, path, metaTitle, metaDescription, content, toc = [] } = options
  const tocColumn = buildTocColumn(toc)
  const hasToc = tocColumn.length > 0

  return {
    name: `docs-${activeId}`,
    path,
    meta: {
      title: metaTitle,
      description: metaDescription,
      author: 'ESSENTIAL SERVICES',
      favicons,
      openGraph: {
        title: metaTitle,
        description: metaDescription,
        type: 'website',
        url: `https://sovrium.com${path}`,
        image: 'https://sovrium.com/logos/sovrium-horizontal-dark.svg',
        siteName: 'Sovrium',
      },
      twitter: {
        card: 'summary',
        title: metaTitle,
        description: metaDescription,
        image: 'https://sovrium.com/logos/sovrium-horizontal-dark.svg',
      },
      customElements: shikiCustomStyles,
    },
    scripts: {
      inlineScripts: [
        mobileMenuScript,
        langSwitchScript,
        searchScript,
        docsSidebarToggleScript,
        shikiHighlightScript,
        ...(hasToc ? [tocScrollTrackingScript] : []),
      ],
    },
    sections: [
      // ── Navbar ──────────────────────────────────────────────────────────
      createNavbar('docs'),

      // ── Search Modal ──────────────────────────────────────────────────
      createSearchModal(),

      // ── Main Content (Sidebar + Content + TOC) ─────────────────────────
      {
        type: 'section',
        props: {
          className: 'bg-sovereignty-darker text-sovereignty-light min-h-screen',
        },
        children: [
          {
            type: 'container',
            props: { className: 'max-w-7xl mx-auto px-4 py-12' },
            children: [
              // Mobile sidebar toggle button
              {
                type: 'div',
                props: { className: 'lg:hidden mb-6' },
                children: [
                  {
                    type: 'button',
                    props: {
                      id: 'docs-sidebar-toggle',
                      type: 'button',
                      className:
                        'w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-sovereignty-gray-300 bg-sovereignty-gray-900 border border-sovereignty-gray-800 rounded-lg hover:bg-sovereignty-gray-800 transition-colors',
                    },
                    children: [
                      {
                        type: 'span' as const,
                        content: '$t:docs.sidebar.toggle',
                        props: {},
                      },
                      {
                        type: 'icon' as const,
                        props: {
                          name: 'chevron-down',
                          size: 16,
                          className: 'text-sovereignty-gray-500',
                        },
                      },
                    ],
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

                  // ── Table of Contents (right sidebar) ─────────────────
                  ...tocColumn,
                ],
              },
            ],
          },
        ],
      },

      // ── Footer ──────────────────────────────────────────────────────────
      footerI18n,

      // ── Built with Sovrium Badge ──────────────────────────────────────────
      { component: 'sovrium-badge' },
    ],
  } as Page
}
