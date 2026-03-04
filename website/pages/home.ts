/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { favicons } from './favicons'
import { footerI18n } from './footer'
import {
  createNavbar,
  createSearchModal,
  langSwitchScript,
  mobileMenuScript,
  searchScript,
} from './navbar'
import { shikiHighlightScript, shikiCustomStyles } from './shiki'
import type { Page } from '@/index'

export const home: Page = {
  name: 'home',
  path: '/',
  meta: {
    title: '$t:home.meta.title',
    description: '$t:home.meta.description',
    keywords:
      'digital sovereignty, self-hosted platform, no-code alternative, configuration-driven, airtable alternative, retool alternative, SaaS replacement',
    author: 'ESSENTIAL SERVICES',
    canonical: 'https://sovrium.com',
    favicons,
    openGraph: {
      title: '$t:home.meta.og.title',
      description: '$t:home.meta.og.description',
      type: 'website',
      url: 'https://sovrium.com',
      image: 'https://sovrium.com/logos/sovrium-horizontal-dark.svg',
      siteName: 'Sovrium',
    },
    twitter: {
      card: 'summary_large_image',
      title: '$t:home.meta.twitter.title',
      description: '$t:home.meta.twitter.description',
      image: 'https://sovrium.com/logos/sovrium-horizontal-dark.svg',
    },
    schema: {
      organization: {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'Sovrium',
        url: 'https://sovrium.com',
        logo: 'https://sovrium.com/logos/sovrium-horizontal-dark.svg',
        sameAs: ['https://github.com/sovrium/sovrium', 'https://www.linkedin.com/company/sovrium/'],
      },
      webSite: {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'Sovrium',
        url: 'https://sovrium.com',
        potentialAction: {
          '@type': 'SearchAction',
          target: 'https://sovrium.com/?q={search_term_string}',
          'query-input': 'required name=search_term_string',
        },
      },
      softwareApplication: {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'Sovrium',
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Linux, macOS, Windows',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
        },
        description:
          'Source-available, configuration-driven application platform. Build complete business apps with a single config file.',
      },
    },
    customElements: shikiCustomStyles,
  },
  scripts: {
    inlineScripts: [langSwitchScript, mobileMenuScript, searchScript, shikiHighlightScript],
  },
  sections: [
    // Navigation Bar
    createNavbar(),

    // Search Modal
    createSearchModal(),

    // Hero Section
    {
      type: 'section',
      props: {
        className:
          'min-h-screen flex items-center justify-center bg-gradient-to-b from-sovereignty-dark to-sovereignty-darker text-sovereignty-light',
      },
      children: [
        {
          type: 'container',
          props: { className: 'max-w-6xl mx-auto px-4 sm:px-6 md:px-8 text-center' },
          children: [
            {
              type: 'h1',
              content: '$t:home.hero.title',
              props: {
                className:
                  'text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight bg-gradient-to-r from-sovereignty-accent to-sovereignty-teal bg-clip-text text-transparent overflow-visible',
              },
            },
            {
              type: 'h2',
              content: '$t:home.hero.subtitle',
              props: {
                className:
                  'text-xl sm:text-2xl md:text-3xl font-semibold text-sovereignty-teal mb-8',
              },
            },
            {
              type: 'paragraph',
              content: '$t:home.hero.description',
              props: {
                className:
                  'text-base sm:text-lg md:text-xl text-sovereignty-gray-400 max-w-3xl mx-auto mb-12',
              },
            },
            {
              type: 'flex',
              props: { className: 'flex-col sm:flex-row justify-center gap-4 mb-8' },
              children: [
                {
                  type: 'link',
                  content: '$t:home.hero.cta.primary',
                  props: {
                    href: '#getting-started',
                    className:
                      'inline-block bg-sovereignty-accent hover:bg-sovereignty-accent-hover text-white px-6 sm:px-8 py-3 sm:py-4 rounded-lg font-semibold transition-all duration-200 transform hover:-translate-y-1 text-center',
                  },
                },
                {
                  type: 'link',
                  content: '$t:home.hero.cta.secondary',
                  props: {
                    href: 'https://github.com/sovrium/sovrium',
                    className:
                      'inline-block border-2 border-sovereignty-accent text-sovereignty-accent px-6 sm:px-8 py-3 sm:py-4 rounded-lg font-semibold hover:bg-sovereignty-accent hover:text-white transition-all duration-200 text-center',
                  },
                },
              ],
            },
            {
              type: 'paragraph',
              content: '$t:home.hero.trust',
              props: {
                className: 'text-sm text-sovereignty-gray-400 tracking-wide',
              },
            },
          ],
        },
      ],
    },

    // Problem Statement Section
    {
      type: 'section',
      props: {
        className: 'py-16 md:py-24 bg-sovereignty-darker text-sovereignty-light',
        id: 'problem',
      },
      children: [
        {
          type: 'container',
          props: { className: 'max-w-6xl mx-auto px-4 sm:px-6 md:px-8' },
          children: [
            {
              type: 'h2',
              content: '$t:home.problem.title',
              props: {
                className: 'text-2xl sm:text-3xl font-bold text-center mb-12 md:mb-16',
              },
            },

            // Statistics Grid
            {
              type: 'grid',
              props: { className: 'grid grid-cols-1 md:grid-cols-3 gap-8 mb-16' },
              children: [
                {
                  type: 'card',
                  props: {
                    className:
                      'bg-sovereignty-gray-900 border border-sovereignty-gray-800 p-8 rounded-lg text-center hover:border-sovereignty-accent transition-colors duration-300',
                  },
                  children: [
                    {
                      type: 'h3',
                      content: '$t:home.problem.stat1.value',
                      props: {
                        className: 'text-4xl sm:text-5xl font-bold text-sovereignty-accent mb-2',
                      },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:home.problem.stat1.label',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                  ],
                },
                {
                  type: 'card',
                  props: {
                    className:
                      'bg-sovereignty-gray-900 border border-sovereignty-gray-800 p-8 rounded-lg text-center hover:border-sovereignty-accent transition-colors duration-300',
                  },
                  children: [
                    {
                      type: 'h3',
                      content: '$t:home.problem.stat2.value',
                      props: {
                        className: 'text-4xl sm:text-5xl font-bold text-sovereignty-accent mb-2',
                      },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:home.problem.stat2.label',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                  ],
                },
                {
                  type: 'card',
                  props: {
                    className:
                      'bg-sovereignty-gray-900 border border-sovereignty-gray-800 p-8 rounded-lg text-center hover:border-sovereignty-accent transition-colors duration-300',
                  },
                  children: [
                    {
                      type: 'h3',
                      content: '$t:home.problem.stat3.value',
                      props: {
                        className: 'text-4xl sm:text-5xl font-bold text-sovereignty-accent mb-2',
                      },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:home.problem.stat3.label',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                  ],
                },
              ],
            },

            // Micro-comparison: Sovrium vs SaaS (3 high-impact rows)
            {
              type: 'div',
              props: { className: 'max-w-2xl mx-auto mt-12 md:mt-16' },
              children: [
                {
                  type: 'div',
                  props: {
                    className:
                      'bg-sovereignty-gray-900 border border-sovereignty-gray-800 rounded-lg p-4 sm:p-6',
                  },
                  children: [
                    {
                      type: 'grid',
                      props: {
                        className: 'grid grid-cols-3 gap-3 sm:gap-4 text-xs sm:text-sm',
                      },
                      children: [
                        // Header row
                        {
                          type: 'div',
                          props: { className: 'font-semibold' },
                        },
                        {
                          type: 'div',
                          props: { className: 'font-semibold text-sovereignty-accent' },
                          content: 'Sovrium',
                        },
                        {
                          type: 'div',
                          props: { className: 'font-semibold text-sovereignty-gray-400' },
                          content: '$t:home.comparison.table.header.saas',
                        },
                        // Version Control
                        {
                          type: 'div',
                          content: '$t:home.comparison.table.row1.aspect',
                        },
                        {
                          type: 'div',
                          props: { className: 'text-green-400' },
                          content: '$t:home.comparison.table.row1.sovrium',
                        },
                        {
                          type: 'div',
                          props: { className: 'text-yellow-400' },
                          content: '$t:home.comparison.table.row1.saas',
                        },
                        // Monthly Cost
                        {
                          type: 'div',
                          content: '$t:home.comparison.table.row2.aspect',
                        },
                        {
                          type: 'div',
                          props: { className: 'text-green-400' },
                          content: '$t:home.comparison.table.row2.sovrium',
                        },
                        {
                          type: 'div',
                          props: { className: 'text-red-400' },
                          content: '$t:home.comparison.table.row2.saas',
                        },
                        // Managed Hosting (honest concession)
                        {
                          type: 'div',
                          content: '$t:home.comparison.table.row3.aspect',
                        },
                        {
                          type: 'div',
                          props: { className: 'text-yellow-400' },
                          content: '$t:home.comparison.table.row3.sovrium',
                        },
                        {
                          type: 'div',
                          props: { className: 'text-green-400' },
                          content: '$t:home.comparison.table.row3.saas',
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

    // Solution Overview Section
    {
      type: 'section',
      props: {
        className: 'py-16 md:py-24 bg-sovereignty-dark text-sovereignty-light',
        id: 'solution',
      },
      children: [
        {
          type: 'container',
          props: { className: 'max-w-6xl mx-auto px-4 sm:px-6 md:px-8' },
          children: [
            {
              type: 'h2',
              content: '$t:home.solution.title',
              props: {
                className: 'text-2xl sm:text-3xl font-bold text-center mb-6',
              },
            },
            {
              type: 'paragraph',
              content: '$t:home.solution.description',
              props: {
                className:
                  'text-base sm:text-lg md:text-xl text-sovereignty-gray-400 text-center max-w-4xl mx-auto mb-12 md:mb-16',
              },
            },

            // Code Example — YAML config (compact, scannable)
            {
              $ref: 'docs-code-block',
              vars: {
                lang: 'yaml',
                langIcon: 'file-text',
                langLabel: 'YAML',
                code: [
                  '# app.yaml — database, auth, pages, theme in one file',
                  '',
                  'name: company-crm',
                  'version: 1.0.0',
                  '',
                  'tables:',
                  '  - name: contacts',
                  '    fields:',
                  '      - name: full-name',
                  '        type: single-line-text',
                  '        required: true',
                  '      - name: email',
                  '        type: email',
                  '        required: true',
                  '      - name: company',
                  '        type: single-line-text',
                  '      - name: stage',
                  '        type: single-select',
                  "        options: ['Lead', 'Qualified', 'Customer']",
                  '      - name: deal-value',
                  '        type: currency',
                  '        currencyCode: USD',
                  '      - name: notes',
                  '        type: long-text',
                  '      - name: owner',
                  '        type: user',
                  '',
                  'auth:',
                  '  strategies:',
                  '    - type: emailAndPassword',
                  '',
                  'theme:',
                  '  colors:',
                  '    primary: "#3b82f6"',
                  '',
                  'pages:',
                  '  - name: home',
                  '    path: /',
                  '    meta: { title: Company CRM }',
                  '    sections:',
                  '      - type: heading',
                  '        content: Welcome to your CRM',
                ].join('\n'),
              },
            },

            // "Also works with" TypeScript
            {
              type: 'paragraph',
              content: '$t:home.solution.code.alsoWorks',
              props: { className: 'text-sovereignty-gray-400 mb-2' },
            },
            {
              $ref: 'docs-code-block',
              vars: {
                lang: 'bash',
                langIcon: 'terminal',
                langLabel: 'Terminal',
                code: [
                  '# Start from any config format',
                  'sovrium start app.yaml            # YAML (recommended)',
                  'sovrium start app.json            # JSON',
                  'bun run app.ts                    # TypeScript with full type safety',
                ].join('\n'),
              },
            },
          ],
        },
      ],
    },

    // Use Cases Section
    {
      type: 'section',
      props: {
        className: 'py-16 md:py-24 bg-sovereignty-darker text-sovereignty-light',
        id: 'use-cases',
      },
      children: [
        {
          type: 'container',
          props: { className: 'max-w-6xl mx-auto px-4 sm:px-6 md:px-8' },
          children: [
            {
              type: 'h2',
              content: '$t:home.useCases.title',
              props: {
                className: 'text-2xl sm:text-3xl font-bold text-center mb-12 md:mb-16',
              },
            },
            {
              type: 'grid',
              props: { className: 'grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8' },
              children: [
                {
                  type: 'card',
                  props: {
                    className:
                      'bg-sovereignty-gray-900 border border-sovereignty-gray-800 p-6 rounded-lg hover:border-sovereignty-accent transition-colors duration-300',
                  },
                  children: [
                    {
                      type: 'h3',
                      content: '$t:home.useCases.internal.title',
                      props: { className: 'text-xl font-semibold mb-3' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:home.useCases.internal.description',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                  ],
                },
                {
                  type: 'card',
                  props: {
                    className:
                      'bg-sovereignty-gray-900 border border-sovereignty-gray-800 p-6 rounded-lg hover:border-sovereignty-accent transition-colors duration-300',
                  },
                  children: [
                    {
                      type: 'h3',
                      content: '$t:home.useCases.portals.title',
                      props: { className: 'text-xl font-semibold mb-3' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:home.useCases.portals.description',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                  ],
                },
                {
                  type: 'card',
                  props: {
                    className:
                      'bg-sovereignty-gray-900 border border-sovereignty-gray-800 p-6 rounded-lg hover:border-sovereignty-accent transition-colors duration-300',
                  },
                  children: [
                    {
                      type: 'h3',
                      content: '$t:home.useCases.business.title',
                      props: { className: 'text-xl font-semibold mb-3' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:home.useCases.business.description',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                  ],
                },
                {
                  type: 'card',
                  props: {
                    className:
                      'bg-sovereignty-gray-900 border border-sovereignty-gray-800 p-6 rounded-lg hover:border-sovereignty-accent transition-colors duration-300',
                  },
                  children: [
                    {
                      type: 'h3',
                      content: '$t:home.useCases.mvp.title',
                      props: { className: 'text-xl font-semibold mb-3' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:home.useCases.mvp.description',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },

    // Platform Features Section
    {
      type: 'section',
      props: {
        className: 'py-16 md:py-24 bg-sovereignty-dark text-sovereignty-light',
        id: 'features',
      },
      children: [
        {
          type: 'container',
          props: { className: 'max-w-6xl mx-auto px-4 sm:px-6 md:px-8' },
          children: [
            {
              type: 'h2',
              content: '$t:home.features.title',
              props: {
                className: 'text-2xl sm:text-3xl font-bold text-center mb-6',
              },
            },
            {
              type: 'paragraph',
              content: '$t:home.features.subtitle',
              props: {
                className:
                  'text-base sm:text-lg md:text-xl text-sovereignty-gray-400 text-center mb-12 md:mb-16',
              },
            },

            // Feature Categories Grid
            {
              type: 'grid',
              props: {
                className: 'grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8',
              },
              children: [
                // Full-Stack Data Layer
                {
                  type: 'card',
                  props: {
                    className:
                      'bg-sovereignty-gray-900 border border-sovereignty-gray-800 p-6 rounded-lg hover:border-sovereignty-accent transition-colors duration-300',
                  },
                  children: [
                    {
                      type: 'h3',
                      content: '$t:home.features.data.title',
                      props: { className: 'text-xl font-semibold mb-3' },
                    },
                    {
                      type: 'div',
                      props: { className: 'space-y-1 text-sm text-sovereignty-gray-400' },
                      children: [
                        { type: 'paragraph', content: '$t:home.features.data.point1' },
                        { type: 'paragraph', content: '$t:home.features.data.point2' },
                        { type: 'paragraph', content: '$t:home.features.data.point3' },
                      ],
                    },
                  ],
                },

                // Auth & Access Control
                {
                  type: 'card',
                  props: {
                    className:
                      'bg-sovereignty-gray-900 border border-sovereignty-gray-800 p-6 rounded-lg hover:border-sovereignty-accent transition-colors duration-300',
                  },
                  children: [
                    {
                      type: 'h3',
                      content: '$t:home.features.auth.title',
                      props: { className: 'text-xl font-semibold mb-3' },
                    },
                    {
                      type: 'div',
                      props: { className: 'space-y-1 text-sm text-sovereignty-gray-400' },
                      children: [
                        { type: 'paragraph', content: '$t:home.features.auth.point1' },
                        { type: 'paragraph', content: '$t:home.features.auth.point2' },
                        { type: 'paragraph', content: '$t:home.features.auth.point3' },
                      ],
                    },
                  ],
                },

                // UI & Theming
                {
                  type: 'card',
                  props: {
                    className:
                      'bg-sovereignty-gray-900 border border-sovereignty-gray-800 p-6 rounded-lg hover:border-sovereignty-accent transition-colors duration-300',
                  },
                  children: [
                    {
                      type: 'h3',
                      content: '$t:home.features.ui.title',
                      props: { className: 'text-xl font-semibold mb-3' },
                    },
                    {
                      type: 'div',
                      props: { className: 'space-y-1 text-sm text-sovereignty-gray-400' },
                      children: [
                        { type: 'paragraph', content: '$t:home.features.ui.point1' },
                        { type: 'paragraph', content: '$t:home.features.ui.point2' },
                        { type: 'paragraph', content: '$t:home.features.ui.point3' },
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

    // Getting Started Section
    {
      type: 'section',
      props: {
        className: 'py-16 md:py-24 bg-sovereignty-darker text-sovereignty-light',
        id: 'getting-started',
      },
      children: [
        {
          type: 'container',
          props: { className: 'max-w-6xl mx-auto px-4 sm:px-6 md:px-8' },
          children: [
            {
              type: 'h2',
              content: '$t:home.gettingStarted.title',
              props: {
                className: 'text-2xl sm:text-3xl font-bold text-center mb-12 md:mb-16',
              },
            },

            // Steps
            {
              type: 'div',
              props: {
                className:
                  'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8 mb-12 md:mb-16',
              },
              children: [
                {
                  type: 'div',
                  props: { className: 'text-center' },
                  children: [
                    {
                      type: 'div',
                      props: {
                        className:
                          'bg-sovereignty-teal text-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-2xl',
                      },
                      content: '1',
                    },
                    {
                      type: 'h3',
                      content: '$t:home.gettingStarted.step1.title',
                      props: { className: 'text-xl font-semibold mb-2' },
                    },
                    {
                      type: 'code',
                      content: 'bun add -g sovrium',
                      props: {
                        className:
                          'bg-sovereignty-gray-900 px-3 py-1 rounded text-sm font-mono text-sovereignty-teal',
                      },
                    },
                  ],
                },
                {
                  type: 'div',
                  props: { className: 'text-center' },
                  children: [
                    {
                      type: 'div',
                      props: {
                        className:
                          'bg-sovereignty-teal text-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-2xl',
                      },
                      content: '2',
                    },
                    {
                      type: 'h3',
                      content: '$t:home.gettingStarted.step2.title',
                      props: { className: 'text-xl font-semibold mb-2' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:home.gettingStarted.step2.description',
                      props: { className: 'text-sm text-sovereignty-gray-400' },
                    },
                  ],
                },
                {
                  type: 'div',
                  props: { className: 'text-center' },
                  children: [
                    {
                      type: 'div',
                      props: {
                        className:
                          'bg-sovereignty-teal text-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-2xl',
                      },
                      content: '3',
                    },
                    {
                      type: 'h3',
                      content: '$t:home.gettingStarted.step3.title',
                      props: { className: 'text-xl font-semibold mb-2' },
                    },
                    {
                      type: 'code',
                      content: 'sovrium start app.yaml',
                      props: {
                        className:
                          'bg-sovereignty-gray-900 px-3 py-1 rounded text-sm font-mono text-sovereignty-teal',
                      },
                    },
                  ],
                },
                {
                  type: 'div',
                  props: { className: 'text-center' },
                  children: [
                    {
                      type: 'div',
                      props: {
                        className:
                          'bg-sovereignty-teal text-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-2xl',
                      },
                      content: '4',
                    },
                    {
                      type: 'h3',
                      content: '$t:home.gettingStarted.step4.title',
                      props: { className: 'text-xl font-semibold mb-2' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:home.gettingStarted.step4.description',
                      props: { className: 'text-sm text-sovereignty-gray-400' },
                    },
                  ],
                },
              ],
            },

            // Tech Line
            {
              type: 'paragraph',
              content: '$t:home.gettingStarted.techLine',
              props: {
                className: 'text-sm text-sovereignty-gray-400 text-center mb-12 md:mb-16',
              },
            },

            // Current Status Card
            {
              type: 'card',
              props: {
                className:
                  'bg-gradient-to-r from-sovereignty-gray-900 to-sovereignty-gray-800 border border-sovereignty-accent p-6 sm:p-8 rounded-lg text-center',
              },
              children: [
                {
                  type: 'h3',
                  content: '$t:home.gettingStarted.status.title',
                  props: { className: 'text-xl sm:text-2xl font-semibold mb-4' },
                },
                {
                  type: 'paragraph',
                  content: '$t:home.gettingStarted.status.description',
                  props: { className: 'text-sovereignty-gray-400 mb-6' },
                },
                {
                  type: 'flex',
                  props: {
                    className: 'flex flex-col sm:flex-row items-center justify-center gap-4',
                  },
                  children: [
                    {
                      type: 'link',
                      content: '$t:home.gettingStarted.status.cta',
                      props: {
                        href: '$t:home.gettingStarted.status.cta.href',
                        className:
                          'inline-block bg-sovereignty-accent hover:bg-sovereignty-accent-hover text-white px-6 py-3 rounded-lg font-semibold transition-all duration-200',
                      },
                    },
                    {
                      type: 'link',
                      content: '$t:home.gettingStarted.status.cta.secondary',
                      props: {
                        href: 'https://github.com/sovrium/sovrium',
                        className:
                          'inline-block border border-sovereignty-gray-700 hover:border-sovereignty-accent text-sovereignty-light px-6 py-3 rounded-lg font-semibold transition-all duration-200',
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

    // Footer
    footerI18n,

    { component: 'sovrium-badge' },
  ],
}
