/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { favicons } from './favicons'
import { footerI18n } from './footer'
import { langSwitchScript, mobileMenuScript, navbar } from './navbar'
import type { Page } from '@/index'

// ─── Badge Group Helper ─────────────────────────────────────────────────────
// Structural composition that wraps $ref badge-item components with a title.
// Not a reusable visual element itself — just arranges components into a group.

const badgeGroup = (title: string, items: readonly string[]) => ({
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

// ─── Page ───────────────────────────────────────────────────────────────────────

export const docsSchema: Page = {
  name: 'docs-schema',
  path: '/docs/schema',
  meta: {
    title: '$t:docs.meta.title',
    description: '$t:docs.meta.description',
    favicons,
  },
  scripts: {
    inlineScripts: [mobileMenuScript, langSwitchScript],
  },
  sections: [
    // ─── Navbar ───────────────────────────────────────────────────────────
    navbar,

    // ─── Header ─────────────────────────────────────────────────────────────
    {
      type: 'section',
      props: {
        className:
          'py-16 sm:py-20 bg-gradient-to-b from-sovereignty-dark to-sovereignty-darker text-sovereignty-light',
      },
      children: [
        {
          type: 'container',
          props: { className: 'max-w-5xl mx-auto px-4' },
          children: [
            {
              type: 'div',
              props: { className: 'flex items-center gap-3 mb-6' },
              children: [
                {
                  type: 'link',
                  content: '$t:docs.header.backLink',
                  props: {
                    href: '/',
                    className:
                      'text-sm text-sovereignty-gray-400 hover:text-sovereignty-accent transition-colors',
                  },
                },
                {
                  type: 'span',
                  content: 'v0.0.1',
                  props: {
                    className:
                      'text-xs font-mono px-2 py-0.5 bg-sovereignty-gray-800 rounded text-sovereignty-gray-400',
                  },
                },
              ],
            },
            {
              type: 'h1',
              content: '$t:docs.header.title',
              props: { className: 'text-4xl sm:text-5xl md:text-6xl font-bold mb-4' },
            },
            {
              type: 'paragraph',
              content: '$t:docs.header.description',
              props: {
                className: 'text-lg text-sovereignty-gray-300 max-w-3xl leading-relaxed',
              },
            },
          ],
        },
      ],
    },

    // ─── Main Content (Sidebar + Content) ───────────────────────────────────
    {
      type: 'section',
      props: {
        className: 'bg-sovereignty-darker text-sovereignty-light',
      },
      children: [
        {
          type: 'container',
          props: { className: 'max-w-6xl mx-auto px-4 py-12' },
          children: [
            {
              type: 'div',
              props: { className: 'flex flex-col lg:flex-row gap-12' },
              children: [
                // ── Sidebar Navigation ──────────────────────────────────
                {
                  type: 'nav',
                  props: {
                    className:
                      'lg:w-56 flex-shrink-0 lg:sticky lg:top-8 lg:self-start hidden lg:block',
                  },
                  children: [
                    {
                      type: 'div',
                      props: {
                        className: 'border-l border-sovereignty-gray-800 pl-2 space-y-1',
                      },
                      children: [
                        {
                          $ref: 'docs-sidebar-link',
                          vars: { id: 'overview', label: '$t:docs.sidebar.overview' },
                        },
                        {
                          $ref: 'docs-sidebar-link',
                          vars: { id: 'quick-start', label: '$t:docs.sidebar.quickStart' },
                        },
                        {
                          $ref: 'docs-sidebar-link',
                          vars: { id: 'root-properties', label: '$t:docs.sidebar.rootProperties' },
                        },
                        {
                          $ref: 'docs-sidebar-link',
                          vars: { id: 'tables', label: '$t:docs.sidebar.tables' },
                        },
                        {
                          $ref: 'docs-sidebar-link',
                          vars: { id: 'theme', label: '$t:docs.sidebar.theme' },
                        },
                        {
                          $ref: 'docs-sidebar-link',
                          vars: { id: 'pages', label: '$t:docs.sidebar.pages' },
                        },
                        {
                          $ref: 'docs-sidebar-link',
                          vars: { id: 'auth', label: '$t:docs.sidebar.auth' },
                        },
                        {
                          $ref: 'docs-sidebar-link',
                          vars: { id: 'languages', label: '$t:docs.sidebar.languages' },
                        },
                        {
                          $ref: 'docs-sidebar-link',
                          vars: { id: 'analytics', label: '$t:docs.sidebar.analytics' },
                        },
                        {
                          $ref: 'docs-sidebar-link',
                          vars: { id: 'resources', label: '$t:docs.sidebar.resources' },
                        },
                      ],
                    },
                  ],
                },

                // ── Content Sections ────────────────────────────────────
                {
                  type: 'div',
                  props: { className: 'flex-1 min-w-0 space-y-20' },
                  children: [
                    // ══ 1. Overview ═══════════════════════════════════════
                    {
                      type: 'div',
                      props: { id: 'overview' },
                      children: [
                        {
                          type: 'h2',
                          content: '$t:docs.overview.title',
                          props: {
                            className: 'text-2xl sm:text-3xl font-bold mb-2 text-sovereignty-light',
                          },
                        },
                        {
                          type: 'paragraph',
                          content: '$t:docs.overview.description',
                          props: { className: 'text-sovereignty-gray-400 mb-8' },
                        },
                        {
                          $ref: 'docs-code-block',
                          vars: {
                            code: 'name: my-app                  # App identifier (required)\nversion: 1.0.0               # SemVer version\ndescription: My application   # One-line description\ntables: [...]                 # Data models with 41 field types\ntheme: {...}                  # Design tokens (colors, fonts, etc.)\npages: [...]                  # Server-rendered pages (63 component types)\nauth: {...}                   # Authentication & authorization\nlanguages: {...}              # Multi-language support ($t: syntax)\ncomponents: [...]             # Reusable UI templates ($ref, $variable)\nanalytics: {...}              # Privacy-friendly, cookie-free analytics',
                          },
                        },
                        {
                          type: 'paragraph',
                          content: '$t:docs.overview.footnote',
                          props: {
                            className: 'text-sm text-sovereignty-gray-400 mt-4',
                          },
                        },
                      ],
                    },

                    // ══ 2. Quick Start ════════════════════════════════════
                    {
                      type: 'div',
                      props: { id: 'quick-start' },
                      children: [
                        {
                          type: 'h2',
                          content: '$t:docs.quickStart.title',
                          props: {
                            className: 'text-2xl sm:text-3xl font-bold mb-2 text-sovereignty-light',
                          },
                        },
                        {
                          type: 'paragraph',
                          content: '$t:docs.quickStart.description',
                          props: { className: 'text-sovereignty-gray-400 mb-4' },
                        },
                        {
                          $ref: 'docs-code-block',
                          vars: {
                            code: '# 1. The simplest valid config \u2014 just a name\nname: my-app\n\n# 2. Add a table with fields\ntables:\n  - id: 1\n    name: tasks\n    fields:\n      - id: 1\n        name: title\n        type: single-line-text\n        required: true\n      - id: 2\n        name: status\n        type: single-select\n        options:\n          - label: To Do\n            color: gray\n          - label: In Progress\n            color: blue\n          - label: Done\n            color: green\n      - id: 3\n        name: due-date\n        type: date\n      - id: 4\n        name: assignee\n        type: user\n\n# 3. Add a theme and authentication\ntheme:\n  colors:\n    primary: "#3b82f6"\n    background: "#0f172a"\n\nauth:\n  strategies:\n    - type: email-password\n  defaultRole: member',
                          },
                        },
                        {
                          type: 'paragraph',
                          content: '$t:docs.quickStart.runDev',
                          props: {
                            className: 'text-sovereignty-gray-400 mt-4 mb-2',
                          },
                        },
                        { $ref: 'docs-code-block', vars: { code: 'sovrium start app.yaml' } },
                      ],
                    },

                    // ══ 3. Root Properties ════════════════════════════════
                    {
                      type: 'div',
                      props: { id: 'root-properties' },
                      children: [
                        {
                          type: 'h2',
                          content: '$t:docs.rootProps.title',
                          props: {
                            className: 'text-2xl sm:text-3xl font-bold mb-2 text-sovereignty-light',
                          },
                        },
                        {
                          type: 'paragraph',
                          content: '$t:docs.rootProps.description',
                          props: { className: 'text-sovereignty-gray-400 mb-8' },
                        },
                        {
                          type: 'div',
                          props: { className: 'grid grid-cols-1 sm:grid-cols-2 gap-4' },
                          children: [
                            {
                              $ref: 'docs-property-card',
                              vars: {
                                name: 'name',
                                type: 'string',
                                requiredClass: '',
                                description: '$t:docs.rootProps.name.description',
                              },
                            },
                            {
                              $ref: 'docs-property-card',
                              vars: {
                                name: 'version',
                                type: 'string',
                                requiredClass: 'hidden',
                                description: '$t:docs.rootProps.version.description',
                              },
                            },
                            {
                              $ref: 'docs-property-card',
                              vars: {
                                name: 'description',
                                type: 'string',
                                requiredClass: 'hidden',
                                description: '$t:docs.rootProps.description.description',
                              },
                            },
                            {
                              $ref: 'docs-property-card',
                              vars: {
                                name: 'tables',
                                type: 'array',
                                requiredClass: 'hidden',
                                description: '$t:docs.rootProps.tables.description',
                              },
                            },
                            {
                              $ref: 'docs-property-card',
                              vars: {
                                name: 'theme',
                                type: 'object',
                                requiredClass: 'hidden',
                                description: '$t:docs.rootProps.theme.description',
                              },
                            },
                            {
                              $ref: 'docs-property-card',
                              vars: {
                                name: 'pages',
                                type: 'array',
                                requiredClass: 'hidden',
                                description: '$t:docs.rootProps.pages.description',
                              },
                            },
                            {
                              $ref: 'docs-property-card',
                              vars: {
                                name: 'auth',
                                type: 'object',
                                requiredClass: 'hidden',
                                description: '$t:docs.rootProps.auth.description',
                              },
                            },
                            {
                              $ref: 'docs-property-card',
                              vars: {
                                name: 'languages',
                                type: 'object',
                                requiredClass: 'hidden',
                                description: '$t:docs.rootProps.languages.description',
                              },
                            },
                            {
                              $ref: 'docs-property-card',
                              vars: {
                                name: 'components',
                                type: 'array',
                                requiredClass: 'hidden',
                                description: '$t:docs.rootProps.components.description',
                              },
                            },
                            {
                              $ref: 'docs-property-card',
                              vars: {
                                name: 'analytics',
                                type: 'object | boolean',
                                requiredClass: 'hidden',
                                description: '$t:docs.rootProps.analytics.description',
                              },
                            },
                          ],
                        },
                      ],
                    },

                    // ══ 4. Tables & Fields ════════════════════════════════
                    {
                      type: 'div',
                      props: { id: 'tables' },
                      children: [
                        {
                          type: 'h2',
                          content: '$t:docs.tables.title',
                          props: {
                            className: 'text-2xl sm:text-3xl font-bold mb-2 text-sovereignty-light',
                          },
                        },
                        {
                          type: 'paragraph',
                          content: '$t:docs.tables.description',
                          props: { className: 'text-sovereignty-gray-400 mb-6' },
                        },

                        // Table structure example
                        {
                          type: 'h3',
                          content: '$t:docs.tables.structure.title',
                          props: {
                            className: 'text-xl font-semibold mb-3 text-sovereignty-light',
                          },
                        },
                        {
                          $ref: 'docs-code-block',
                          vars: {
                            code: 'tables:\n  - id: 1\n    name: tasks\n    fields:\n      - id: 1\n        name: title\n        type: single-line-text\n        required: true\n      - id: 2\n        name: completed\n        type: checkbox\n    permissions:\n      create: authenticated\n      read: all\n      update: [admin, member]\n      delete: [admin]\n    indexes:\n      - fields: [title]\n        unique: true',
                          },
                        },

                        // Base field properties
                        {
                          type: 'h3',
                          content: '$t:docs.tables.baseFields.title',
                          props: {
                            className: 'text-xl font-semibold mb-3 mt-8 text-sovereignty-light',
                          },
                        },
                        {
                          type: 'paragraph',
                          content: '$t:docs.tables.baseFields.description',
                          props: {
                            className: 'text-sm text-sovereignty-gray-400 mb-6',
                          },
                        },

                        // Field types by category
                        {
                          type: 'h3',
                          content: '$t:docs.tables.fieldTypes.title',
                          props: {
                            className: 'text-xl font-semibold mb-3 mt-8 text-sovereignty-light',
                          },
                        },
                        {
                          type: 'paragraph',
                          content: '$t:docs.tables.fieldTypes.description',
                          props: {
                            className: 'text-sm text-sovereignty-gray-400 mb-4',
                          },
                        },
                        badgeGroup('$t:docs.tables.fieldTypes.text', [
                          'single-line-text',
                          'long-text',
                          'rich-text',
                          'email',
                          'url',
                          'phone-number',
                          'barcode',
                        ]),
                        badgeGroup('$t:docs.tables.fieldTypes.numeric', [
                          'number',
                          'currency',
                          'percent',
                          'rating',
                        ]),
                        badgeGroup('$t:docs.tables.fieldTypes.selection', [
                          'single-select',
                          'multi-select',
                          'checkbox',
                          'status',
                        ]),
                        badgeGroup('$t:docs.tables.fieldTypes.dateTime', [
                          'date',
                          'date-time',
                          'time',
                        ]),
                        badgeGroup('$t:docs.tables.fieldTypes.user', [
                          'user',
                          'created-by',
                          'updated-by',
                        ]),
                        badgeGroup('$t:docs.tables.fieldTypes.relational', ['link', 'lookup']),
                        badgeGroup('$t:docs.tables.fieldTypes.media', [
                          'attachment',
                          'image',
                          'file',
                          'signature',
                        ]),
                        badgeGroup('$t:docs.tables.fieldTypes.computed', [
                          'formula',
                          'auto-number',
                          'rollup',
                        ]),
                        badgeGroup('$t:docs.tables.fieldTypes.advanced', [
                          'json',
                          'geo',
                          'duration',
                          'button',
                          'ai-generated',
                          'last-modified-time',
                          'created-time',
                        ]),

                        // Permissions
                        {
                          type: 'h3',
                          content: '$t:docs.tables.permissions.title',
                          props: {
                            className: 'text-xl font-semibold mb-3 mt-8 text-sovereignty-light',
                          },
                        },
                        {
                          type: 'paragraph',
                          content: '$t:docs.tables.permissions.description',
                          props: {
                            className: 'text-sm text-sovereignty-gray-400 mb-4',
                          },
                        },
                        {
                          $ref: 'docs-code-block',
                          vars: {
                            code: 'permissions:\n  create: authenticated       # Any logged-in user\n  read: all                   # Public access\n  update: [admin, member]     # Specific roles\n  delete: [admin]             # Admin only\n  comment: authenticated',
                          },
                        },
                      ],
                    },

                    // ══ 5. Theme ══════════════════════════════════════════
                    {
                      type: 'div',
                      props: { id: 'theme' },
                      children: [
                        {
                          type: 'h2',
                          content: '$t:docs.theme.title',
                          props: {
                            className: 'text-2xl sm:text-3xl font-bold mb-2 text-sovereignty-light',
                          },
                        },
                        {
                          type: 'paragraph',
                          content: '$t:docs.theme.description',
                          props: { className: 'text-sovereignty-gray-400 mb-8' },
                        },
                        {
                          type: 'grid',
                          props: {
                            className: 'grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8',
                          },
                          children: [
                            {
                              $ref: 'docs-info-card',
                              vars: {
                                title: '$t:docs.theme.colors.title',
                                description: '$t:docs.theme.colors.description',
                              },
                            },
                            {
                              $ref: 'docs-info-card',
                              vars: {
                                title: '$t:docs.theme.fonts.title',
                                description: '$t:docs.theme.fonts.description',
                              },
                            },
                            {
                              $ref: 'docs-info-card',
                              vars: {
                                title: '$t:docs.theme.spacing.title',
                                description: '$t:docs.theme.spacing.description',
                              },
                            },
                            {
                              $ref: 'docs-info-card',
                              vars: {
                                title: '$t:docs.theme.shadows.title',
                                description: '$t:docs.theme.shadows.description',
                              },
                            },
                            {
                              $ref: 'docs-info-card',
                              vars: {
                                title: '$t:docs.theme.animations.title',
                                description: '$t:docs.theme.animations.description',
                              },
                            },
                            {
                              $ref: 'docs-info-card',
                              vars: {
                                title: '$t:docs.theme.breakpoints.title',
                                description: '$t:docs.theme.breakpoints.description',
                              },
                            },
                            {
                              $ref: 'docs-info-card',
                              vars: {
                                title: '$t:docs.theme.borderRadius.title',
                                description: '$t:docs.theme.borderRadius.description',
                              },
                            },
                          ],
                        },
                        {
                          $ref: 'docs-code-block',
                          vars: {
                            code: 'theme:\n  colors:\n    primary: "#3b82f6"\n    secondary: "#8b5cf6"\n    background: "#0a0e1a"\n    text: "#e8ecf4"\n  fonts:\n    heading:\n      family: Inter\n      weights: [600, 700]\n      lineHeight: "1.2"\n    body:\n      family: Inter\n      size: "16px"\n  spacing:\n    container: "max-w-7xl mx-auto px-4"\n    section: "py-16 sm:py-20"\n  shadows:\n    card: "0 4px 6px rgba(0, 0, 0, 0.1)"',
                          },
                        },
                      ],
                    },

                    // ══ 6. Pages & Components ═════════════════════════════
                    {
                      type: 'div',
                      props: { id: 'pages' },
                      children: [
                        {
                          type: 'h2',
                          content: '$t:docs.pages.title',
                          props: {
                            className: 'text-2xl sm:text-3xl font-bold mb-2 text-sovereignty-light',
                          },
                        },
                        {
                          type: 'paragraph',
                          content: '$t:docs.pages.description',
                          props: { className: 'text-sovereignty-gray-400 mb-6' },
                        },

                        // Page structure
                        {
                          type: 'h3',
                          content: '$t:docs.pages.structure.title',
                          props: {
                            className: 'text-xl font-semibold mb-3 text-sovereignty-light',
                          },
                        },
                        {
                          $ref: 'docs-code-block',
                          vars: {
                            code: 'pages:\n  - name: home\n    path: /\n    meta:\n      title: "My App - Home"\n      description: "Welcome to my application"\n      openGraph:\n        title: "My App"\n        description: "A Sovrium-powered application"\n        image: "/og-image.png"\n    sections:\n      - type: section\n        props:\n          className: "py-20 bg-gray-900"\n        children:\n          - type: h1\n            content: "Welcome"\n          - type: paragraph\n            content: "Built with Sovrium"',
                          },
                        },

                        // Component types
                        {
                          type: 'h3',
                          content: '$t:docs.pages.componentTypes.title',
                          props: {
                            className: 'text-xl font-semibold mb-3 mt-8 text-sovereignty-light',
                          },
                        },
                        {
                          type: 'paragraph',
                          content: '$t:docs.pages.componentTypes.description',
                          props: {
                            className: 'text-sm text-sovereignty-gray-400 mb-4',
                          },
                        },
                        badgeGroup('$t:docs.pages.componentTypes.layout', [
                          'section',
                          'container',
                          'flex',
                          'grid',
                          'div',
                          'span',
                          'header',
                          'footer',
                          'nav',
                        ]),
                        badgeGroup('$t:docs.pages.componentTypes.typography', [
                          'h1',
                          'h2',
                          'h3',
                          'h4',
                          'h5',
                          'h6',
                          'paragraph',
                          'blockquote',
                        ]),
                        badgeGroup('$t:docs.pages.componentTypes.navActions', [
                          'link',
                          'button',
                          'breadcrumb',
                          'pagination',
                          'dropdown',
                        ]),
                        badgeGroup('$t:docs.pages.componentTypes.media', [
                          'image',
                          'video',
                          'audio',
                          'icon',
                          'iframe',
                          'embed',
                          'figure',
                          'figcaption',
                        ]),
                        badgeGroup('$t:docs.pages.componentTypes.formElements', [
                          'form',
                          'input',
                          'textarea',
                          'select',
                          'option',
                          'label',
                        ]),
                        badgeGroup('$t:docs.pages.componentTypes.dataDisplay', [
                          'table',
                          'thead',
                          'tbody',
                          'tfoot',
                          'tr',
                          'th',
                          'td',
                          'ul',
                          'ol',
                          'li',
                        ]),
                        badgeGroup('$t:docs.pages.componentTypes.interactive', [
                          'accordion',
                          'tabs',
                          'tab',
                          'modal',
                          'tooltip',
                          'progress',
                          'rating',
                        ]),
                        badgeGroup('$t:docs.pages.componentTypes.display', [
                          'card',
                          'badge',
                          'separator',
                          'banner',
                          'hero',
                          'marquee',
                          'avatar',
                          'hr',
                        ]),

                        // Interactions
                        {
                          type: 'h3',
                          content: '$t:docs.pages.interactions.title',
                          props: {
                            className: 'text-xl font-semibold mb-3 mt-8 text-sovereignty-light',
                          },
                        },
                        {
                          type: 'paragraph',
                          content: '$t:docs.pages.interactions.description',
                          props: {
                            className: 'text-sm text-sovereignty-gray-400 mb-4',
                          },
                        },
                      ],
                    },

                    // ══ 7. Authentication ═════════════════════════════════
                    {
                      type: 'div',
                      props: { id: 'auth' },
                      children: [
                        {
                          type: 'h2',
                          content: '$t:docs.auth.title',
                          props: {
                            className: 'text-2xl sm:text-3xl font-bold mb-2 text-sovereignty-light',
                          },
                        },
                        {
                          type: 'paragraph',
                          content: '$t:docs.auth.description',
                          props: { className: 'text-sovereignty-gray-400 mb-6' },
                        },
                        {
                          type: 'grid',
                          props: {
                            className: 'grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6',
                          },
                          children: [
                            {
                              $ref: 'docs-info-card',
                              vars: {
                                title: '$t:docs.auth.strategies.title',
                                description: '$t:docs.auth.strategies.description',
                              },
                            },
                            {
                              $ref: 'docs-info-card',
                              vars: {
                                title: '$t:docs.auth.roles.title',
                                description: '$t:docs.auth.roles.description',
                              },
                            },
                            {
                              $ref: 'docs-info-card',
                              vars: {
                                title: '$t:docs.auth.twoFactor.title',
                                description: '$t:docs.auth.twoFactor.description',
                              },
                            },
                            {
                              $ref: 'docs-info-card',
                              vars: {
                                title: '$t:docs.auth.emails.title',
                                description: '$t:docs.auth.emails.description',
                              },
                            },
                          ],
                        },
                        {
                          $ref: 'docs-code-block',
                          vars: {
                            code: 'auth:\n  strategies:\n    - type: email-password\n    - type: magic-link\n    - type: oauth\n      provider: google\n  defaultRole: member\n  roles:\n    - name: editor\n      description: Can edit content\n  twoFactor: true\n  emails:\n    verification:\n      subject: "Verify your email, $name"\n      body: "Click here to verify: $url"',
                          },
                        },
                      ],
                    },

                    // ══ 8. Languages ══════════════════════════════════════
                    {
                      type: 'div',
                      props: { id: 'languages' },
                      children: [
                        {
                          type: 'h2',
                          content: '$t:docs.languages.title',
                          props: {
                            className: 'text-2xl sm:text-3xl font-bold mb-2 text-sovereignty-light',
                          },
                        },
                        {
                          type: 'paragraph',
                          content: '$t:docs.languages.description',
                          props: { className: 'text-sovereignty-gray-400 mb-6' },
                        },
                        {
                          $ref: 'docs-code-block',
                          vars: {
                            code: 'languages:\n  default: en\n  supported:\n    - code: en\n      locale: en-US\n      label: English\n      direction: ltr\n    - code: fr\n      locale: fr-FR\n      label: "Fran\u00E7ais"\n      direction: ltr\n  translations:\n    en:\n      hero.title: "Welcome"\n      hero.description: "Build faster"\n    fr:\n      hero.title: "Bienvenue"\n      hero.description: "Construisez plus vite"',
                          },
                        },
                        {
                          type: 'div',
                          props: {
                            className:
                              'bg-sovereignty-gray-900 border border-sovereignty-accent/30 p-4 rounded-lg mt-4',
                          },
                          children: [
                            {
                              type: 'h4',
                              content: '$t:docs.languages.syntax.title',
                              props: {
                                className: 'text-sm font-semibold text-sovereignty-accent mb-2',
                              },
                            },
                            {
                              type: 'paragraph',
                              content: '$t:docs.languages.syntax.description',
                              props: {
                                className: 'text-sm text-sovereignty-gray-300',
                              },
                            },
                          ],
                        },
                      ],
                    },

                    // ══ 9. Analytics ══════════════════════════════════════
                    {
                      type: 'div',
                      props: { id: 'analytics' },
                      children: [
                        {
                          type: 'h2',
                          content: '$t:docs.analytics.title',
                          props: {
                            className: 'text-2xl sm:text-3xl font-bold mb-2 text-sovereignty-light',
                          },
                        },
                        {
                          type: 'paragraph',
                          content: '$t:docs.analytics.description',
                          props: { className: 'text-sovereignty-gray-400 mb-6' },
                        },
                        {
                          $ref: 'docs-code-block',
                          vars: {
                            code: '# Simple: enable with defaults\nanalytics: true\n\n# Advanced: configure options\nanalytics:\n  retentionDays: 90\n  respectDoNotTrack: true\n  excludePaths:\n    - /admin\n    - /api\n  sessionTimeout: 30',
                          },
                        },
                        {
                          type: 'paragraph',
                          content: '$t:docs.analytics.details',
                          props: {
                            className: 'text-sm text-sovereignty-gray-400 mt-4',
                          },
                        },
                      ],
                    },

                    // ══ 10. Resources ═════════════════════════════════════
                    {
                      type: 'div',
                      props: { id: 'resources' },
                      children: [
                        {
                          type: 'h2',
                          content: '$t:docs.resources.title',
                          props: {
                            className: 'text-2xl sm:text-3xl font-bold mb-2 text-sovereignty-light',
                          },
                        },
                        {
                          type: 'paragraph',
                          content: '$t:docs.resources.description',
                          props: { className: 'text-sovereignty-gray-400 mb-8' },
                        },
                        {
                          type: 'grid',
                          props: {
                            className: 'grid grid-cols-1 sm:grid-cols-2 gap-4',
                          },
                          children: [
                            {
                              $ref: 'docs-resource-link',
                              vars: {
                                label: '$t:docs.resources.llmQuick.label',
                                href: '/llms.txt',
                                description: '$t:docs.resources.llmQuick.description',
                              },
                            },
                            {
                              $ref: 'docs-resource-link',
                              vars: {
                                label: '$t:docs.resources.llmFull.label',
                                href: '/llms-full.txt',
                                description: '$t:docs.resources.llmFull.description',
                              },
                            },
                            {
                              $ref: 'docs-resource-link',
                              vars: {
                                label: '$t:docs.resources.jsonSchema.label',
                                href: '/schemas/0.0.1/app.schema.json',
                                description: '$t:docs.resources.jsonSchema.description',
                              },
                            },
                            {
                              $ref: 'docs-resource-link',
                              vars: {
                                label: '$t:docs.resources.github.label',
                                href: 'https://github.com/sovrium/sovrium',
                                description: '$t:docs.resources.github.description',
                              },
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },

    // ─── Footer ─────────────────────────────────────────────────────────────
    footerI18n,
  ],
}
