/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { navbar } from './navbar'
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
    openGraph: {
      title: '$t:home.meta.og.title',
      description: '$t:home.meta.og.description',
      type: 'website',
      url: 'https://sovrium.com',
      image: 'https://sovrium.com/og-image.png',
      siteName: 'Sovrium',
    },
    twitter: {
      card: 'summary_large_image',
      title: '$t:home.meta.twitter.title',
      description: '$t:home.meta.twitter.description',
      image: 'https://sovrium.com/twitter-card.png',
    },
  },
  sections: [
    // Navigation Bar
    navbar,

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
          props: { className: 'max-w-6xl mx-auto px-4 text-center' },
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
              props: { className: 'flex-col sm:flex-row justify-center gap-4' },
              children: [
                {
                  type: 'link',
                  content: '$t:home.hero.cta.primary',
                  props: {
                    href: '#getting-started',
                    className:
                      'inline-block bg-sovereignty-accent hover:bg-sovereignty-accent-hover text-white px-6 sm:px-8 py-3 sm:py-4 rounded-lg font-semibold transition-all transform hover:-translate-y-1 text-center',
                  },
                },
                {
                  type: 'link',
                  content: '$t:home.hero.cta.secondary',
                  props: {
                    href: 'https://github.com/sovrium/sovrium',
                    className:
                      'inline-block border-2 border-sovereignty-accent text-sovereignty-accent px-6 sm:px-8 py-3 sm:py-4 rounded-lg font-semibold hover:bg-sovereignty-accent hover:text-white transition-all text-center',
                  },
                },
              ],
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
          props: { className: 'max-w-6xl mx-auto px-4' },
          children: [
            {
              type: 'h2',
              content: '$t:home.problem.title',
              props: {
                className: 'text-3xl sm:text-4xl md:text-5xl font-bold text-center mb-12 md:mb-16',
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
                      'bg-sovereignty-gray-900 border border-sovereignty-gray-800 p-8 rounded-lg text-center hover:border-sovereignty-accent transition-colors',
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
                      'bg-sovereignty-gray-900 border border-sovereignty-gray-800 p-8 rounded-lg text-center hover:border-sovereignty-accent transition-colors',
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
                      'bg-sovereignty-gray-900 border border-sovereignty-gray-800 p-8 rounded-lg text-center hover:border-sovereignty-accent transition-colors',
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

            // Hidden Costs
            {
              type: 'div',
              props: { className: 'max-w-4xl mx-auto' },
              children: [
                {
                  type: 'h3',
                  content: '$t:home.problem.hidden.title',
                  props: { className: 'text-xl sm:text-2xl font-semibold mb-6 md:mb-8' },
                },
                {
                  type: 'div',
                  props: { className: 'space-y-4' },
                  children: [
                    {
                      type: 'div',
                      props: { className: 'flex items-start' },
                      children: [
                        {
                          type: 'span',
                          content: '\u274C',
                          props: { className: 'mr-3 text-xl' },
                        },
                        {
                          type: 'div',
                          children: [
                            {
                              type: 'span',
                              content: '$t:home.problem.hidden.cost1.title',
                              props: { className: 'font-semibold text-sovereignty-light' },
                            },
                            {
                              type: 'span',
                              content: '$t:home.problem.hidden.cost1.description',
                              props: { className: 'text-sovereignty-gray-400' },
                            },
                          ],
                        },
                      ],
                    },
                    {
                      type: 'div',
                      props: { className: 'flex items-start' },
                      children: [
                        {
                          type: 'span',
                          content: '\u274C',
                          props: { className: 'mr-3 text-xl' },
                        },
                        {
                          type: 'div',
                          children: [
                            {
                              type: 'span',
                              content: '$t:home.problem.hidden.cost2.title',
                              props: { className: 'font-semibold text-sovereignty-light' },
                            },
                            {
                              type: 'span',
                              content: '$t:home.problem.hidden.cost2.description',
                              props: { className: 'text-sovereignty-gray-400' },
                            },
                          ],
                        },
                      ],
                    },
                    {
                      type: 'div',
                      props: { className: 'flex items-start' },
                      children: [
                        {
                          type: 'span',
                          content: '\u274C',
                          props: { className: 'mr-3 text-xl' },
                        },
                        {
                          type: 'div',
                          children: [
                            {
                              type: 'span',
                              content: '$t:home.problem.hidden.cost3.title',
                              props: { className: 'font-semibold text-sovereignty-light' },
                            },
                            {
                              type: 'span',
                              content: '$t:home.problem.hidden.cost3.description',
                              props: { className: 'text-sovereignty-gray-400' },
                            },
                          ],
                        },
                      ],
                    },
                    {
                      type: 'div',
                      props: { className: 'flex items-start' },
                      children: [
                        {
                          type: 'span',
                          content: '\u274C',
                          props: { className: 'mr-3 text-xl' },
                        },
                        {
                          type: 'div',
                          children: [
                            {
                              type: 'span',
                              content: '$t:home.problem.hidden.cost4.title',
                              props: { className: 'font-semibold text-sovereignty-light' },
                            },
                            {
                              type: 'span',
                              content: '$t:home.problem.hidden.cost4.description',
                              props: { className: 'text-sovereignty-gray-400' },
                            },
                          ],
                        },
                      ],
                    },
                    {
                      type: 'div',
                      props: { className: 'flex items-start' },
                      children: [
                        {
                          type: 'span',
                          content: '\u274C',
                          props: { className: 'mr-3 text-xl' },
                        },
                        {
                          type: 'div',
                          children: [
                            {
                              type: 'span',
                              content: '$t:home.problem.hidden.cost5.title',
                              props: { className: 'font-semibold text-sovereignty-light' },
                            },
                            {
                              type: 'span',
                              content: '$t:home.problem.hidden.cost5.description',
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
          props: { className: 'max-w-6xl mx-auto px-4' },
          children: [
            {
              type: 'h2',
              content: '$t:home.solution.title',
              props: {
                className: 'text-3xl sm:text-4xl md:text-5xl font-bold text-center mb-6 md:mb-8',
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

            // Code Example (kept as-is — code is not translatable)
            {
              type: 'card',
              props: {
                className:
                  'bg-sovereignty-darker border border-sovereignty-gray-800 p-4 sm:p-6 md:p-8 rounded-lg mb-12 md:mb-16',
              },
              children: [
                {
                  type: 'pre',
                  props: { className: 'overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0' },
                  children: [
                    {
                      type: 'code',
                      content: `// app.ts \u2014 Type-safe, with IDE completion
import { start } from 'sovrium'

await start({
  name: 'Company CRM',
  tables: [{ name: 'contacts', fields: [
    { name: 'name', type: 'single-line-text' },
    { name: 'email', type: 'email', required: true },
    { name: 'status', type: 'single-select', options: ['Lead', 'Customer'] },
  ]}],
  pages: [{ path: '/', name: 'Dashboard' }],
  auth: { strategies: ['email-password'], admin: { enabled: true } },
})`,
                      props: { className: 'text-sovereignty-light font-mono text-xs sm:text-sm' },
                    },
                  ],
                },
                {
                  type: 'div',
                  props: { className: 'mt-6 pt-6 border-t border-sovereignty-gray-800' },
                  children: [
                    {
                      type: 'paragraph',
                      content: '$t:home.solution.code.alsoWorks',
                      props: { className: 'text-sovereignty-gray-400 mb-2' },
                    },
                    {
                      type: 'pre',
                      children: [
                        {
                          type: 'code',
                          content:
                            'sovrium start app.yaml      # or app.json\nbun run app.ts               # TypeScript with type safety',
                          props: {
                            className: 'text-sovereignty-teal font-mono text-xs sm:text-sm',
                          },
                        },
                      ],
                    },
                  ],
                },
              ],
            },

            // How It Works
            {
              type: 'div',
              props: { className: 'max-w-4xl mx-auto' },
              children: [
                {
                  type: 'h3',
                  content: '$t:home.solution.howItWorks.title',
                  props: {
                    className: 'text-xl sm:text-2xl font-semibold mb-6 md:mb-8 text-center',
                  },
                },
                {
                  type: 'div',
                  props: {
                    className: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-4',
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
                              'bg-sovereignty-accent text-white w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-xl',
                          },
                          content: '1',
                        },
                        {
                          type: 'h4',
                          content: '$t:home.solution.howItWorks.step1.title',
                          props: { className: 'font-semibold mb-2' },
                        },
                        {
                          type: 'paragraph',
                          content: '$t:home.solution.howItWorks.step1.description',
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
                              'bg-sovereignty-accent text-white w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-xl',
                          },
                          content: '2',
                        },
                        {
                          type: 'h4',
                          content: '$t:home.solution.howItWorks.step2.title',
                          props: { className: 'font-semibold mb-2' },
                        },
                        {
                          type: 'paragraph',
                          content: '$t:home.solution.howItWorks.step2.description',
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
                              'bg-sovereignty-accent text-white w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-xl',
                          },
                          content: '3',
                        },
                        {
                          type: 'h4',
                          content: '$t:home.solution.howItWorks.step3.title',
                          props: { className: 'font-semibold mb-2' },
                        },
                        {
                          type: 'paragraph',
                          content: '$t:home.solution.howItWorks.step3.description',
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
                              'bg-sovereignty-accent text-white w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-xl',
                          },
                          content: '4',
                        },
                        {
                          type: 'h4',
                          content: '$t:home.solution.howItWorks.step4.title',
                          props: { className: 'font-semibold mb-2' },
                        },
                        {
                          type: 'paragraph',
                          content: '$t:home.solution.howItWorks.step4.description',
                          props: { className: 'text-sm text-sovereignty-gray-400' },
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

    // Core Principles Section
    {
      type: 'section',
      props: {
        className: 'py-16 md:py-24 bg-sovereignty-darker text-sovereignty-light',
        id: 'principles',
      },
      children: [
        {
          type: 'container',
          props: { className: 'max-w-6xl mx-auto px-4' },
          children: [
            {
              type: 'h2',
              content: '$t:home.principles.title',
              props: {
                className: 'text-3xl sm:text-4xl md:text-5xl font-bold text-center mb-12 md:mb-16',
              },
            },
            {
              type: 'grid',
              props: { className: 'grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8' },
              children: [
                // Digital Sovereignty
                {
                  type: 'card',
                  props: {
                    className:
                      'bg-sovereignty-gray-900 border border-sovereignty-gray-800 p-6 md:p-8 rounded-lg hover:border-sovereignty-accent transition-colors',
                  },
                  children: [
                    {
                      type: 'div',
                      props: { className: 'text-sovereignty-accent text-2xl sm:text-3xl mb-4' },
                      content: '\uD83D\uDEE1\uFE0F',
                    },
                    {
                      type: 'h3',
                      content: '$t:home.principles.sovereignty.title',
                      props: { className: 'text-xl sm:text-2xl font-semibold mb-4' },
                    },
                    {
                      type: 'div',
                      props: { className: 'space-y-2 text-sovereignty-gray-400' },
                      children: [
                        {
                          type: 'paragraph',
                          content: '$t:home.principles.sovereignty.point1',
                        },
                        {
                          type: 'paragraph',
                          content: '$t:home.principles.sovereignty.point2',
                        },
                        {
                          type: 'paragraph',
                          content: '$t:home.principles.sovereignty.point3',
                        },
                        {
                          type: 'paragraph',
                          content: '$t:home.principles.sovereignty.point4',
                        },
                      ],
                    },
                  ],
                },

                // Configuration Over Coding
                {
                  type: 'card',
                  props: {
                    className:
                      'bg-sovereignty-gray-900 border border-sovereignty-gray-800 p-6 md:p-8 rounded-lg hover:border-sovereignty-accent transition-colors',
                  },
                  children: [
                    {
                      type: 'div',
                      props: { className: 'text-sovereignty-accent text-2xl sm:text-3xl mb-4' },
                      content: '\u2699\uFE0F',
                    },
                    {
                      type: 'h3',
                      content: '$t:home.principles.configuration.title',
                      props: { className: 'text-xl sm:text-2xl font-semibold mb-4' },
                    },
                    {
                      type: 'div',
                      props: { className: 'space-y-2 text-sovereignty-gray-400' },
                      children: [
                        {
                          type: 'paragraph',
                          content: '$t:home.principles.configuration.point1',
                        },
                        {
                          type: 'paragraph',
                          content: '$t:home.principles.configuration.point2',
                        },
                        {
                          type: 'paragraph',
                          content: '$t:home.principles.configuration.point3',
                        },
                        {
                          type: 'paragraph',
                          content: '$t:home.principles.configuration.point4',
                        },
                      ],
                    },
                  ],
                },

                // Minimal Dependencies
                {
                  type: 'card',
                  props: {
                    className:
                      'bg-sovereignty-gray-900 border border-sovereignty-gray-800 p-6 md:p-8 rounded-lg hover:border-sovereignty-accent transition-colors',
                  },
                  children: [
                    {
                      type: 'div',
                      props: { className: 'text-sovereignty-accent text-2xl sm:text-3xl mb-4' },
                      content: '\uD83D\uDCE6',
                    },
                    {
                      type: 'h3',
                      content: '$t:home.principles.dependencies.title',
                      props: { className: 'text-xl sm:text-2xl font-semibold mb-4' },
                    },
                    {
                      type: 'div',
                      props: { className: 'space-y-2 text-sovereignty-gray-400' },
                      children: [
                        {
                          type: 'paragraph',
                          content: '$t:home.principles.dependencies.point1',
                        },
                        {
                          type: 'paragraph',
                          content: '$t:home.principles.dependencies.point2',
                        },
                        {
                          type: 'paragraph',
                          content: '$t:home.principles.dependencies.point3',
                        },
                        {
                          type: 'paragraph',
                          content: '$t:home.principles.dependencies.point4',
                        },
                      ],
                    },
                  ],
                },

                // Business Focus
                {
                  type: 'card',
                  props: {
                    className:
                      'bg-sovereignty-gray-900 border border-sovereignty-gray-800 p-6 md:p-8 rounded-lg hover:border-sovereignty-accent transition-colors',
                  },
                  children: [
                    {
                      type: 'div',
                      props: { className: 'text-sovereignty-accent text-2xl sm:text-3xl mb-4' },
                      content: '\uD83C\uDFAF',
                    },
                    {
                      type: 'h3',
                      content: '$t:home.principles.business.title',
                      props: { className: 'text-xl sm:text-2xl font-semibold mb-4' },
                    },
                    {
                      type: 'div',
                      props: { className: 'space-y-2 text-sovereignty-gray-400' },
                      children: [
                        { type: 'paragraph', content: '$t:home.principles.business.point1' },
                        { type: 'paragraph', content: '$t:home.principles.business.point2' },
                        { type: 'paragraph', content: '$t:home.principles.business.point3' },
                        { type: 'paragraph', content: '$t:home.principles.business.point4' },
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

    // Comparison Section
    {
      type: 'section',
      props: {
        className: 'py-16 md:py-24 bg-sovereignty-dark text-sovereignty-light',
        id: 'comparison',
      },
      children: [
        {
          type: 'container',
          props: { className: 'max-w-6xl mx-auto px-4' },
          children: [
            {
              type: 'h2',
              content: '$t:home.comparison.title',
              props: {
                className: 'text-3xl sm:text-4xl md:text-5xl font-bold text-center mb-12 md:mb-16',
              },
            },

            // Key Stat
            {
              type: 'card',
              props: {
                className:
                  'bg-gradient-to-r from-sovereignty-accent to-sovereignty-teal p-6 sm:p-8 rounded-lg text-center mb-12 md:mb-16',
              },
              children: [
                {
                  type: 'h3',
                  content: '$t:home.comparison.stat1',
                  props: { className: 'text-xl sm:text-2xl md:text-3xl font-bold text-white mb-2' },
                },
                {
                  type: 'h3',
                  content: '$t:home.comparison.stat2',
                  props: { className: 'text-xl sm:text-2xl md:text-3xl font-bold text-white' },
                },
              ],
            },

            // Comparison Table vs SaaS
            {
              type: 'div',
              props: { className: 'mb-12' },
              children: [
                {
                  type: 'h3',
                  content: '$t:home.comparison.table.title',
                  props: { className: 'text-xl sm:text-2xl font-semibold mb-6' },
                },
                {
                  type: 'div',
                  props: { className: 'overflow-x-auto -mx-4 sm:mx-0' },
                  children: [
                    {
                      type: 'div',
                      props: {
                        className:
                          'bg-sovereignty-gray-900 border border-sovereignty-gray-800 rounded-lg p-4 sm:p-6 min-w-[600px] sm:min-w-0',
                      },
                      children: [
                        {
                          type: 'grid',
                          props: {
                            className: 'grid grid-cols-3 gap-3 sm:gap-4 text-xs sm:text-sm',
                          },
                          children: [
                            {
                              type: 'div',
                              props: { className: 'font-semibold' },
                              content: '$t:home.comparison.table.header.aspect',
                            },
                            {
                              type: 'div',
                              props: { className: 'font-semibold text-sovereignty-accent' },
                              content: 'Sovrium',
                            },
                            {
                              type: 'div',
                              props: { className: 'font-semibold text-sovereignty-gray-400' },
                              content: 'Airtable/Retool/Notion',
                            },
                            // Data Ownership
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
                              props: { className: 'text-red-400' },
                              content: '$t:home.comparison.table.row1.saas',
                            },
                            // Source Code
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
                            // Monthly Cost
                            {
                              type: 'div',
                              content: '$t:home.comparison.table.row3.aspect',
                            },
                            {
                              type: 'div',
                              props: { className: 'text-green-400' },
                              content: '$t:home.comparison.table.row3.sovrium',
                            },
                            {
                              type: 'div',
                              props: { className: 'text-red-400' },
                              content: '$t:home.comparison.table.row3.saas',
                            },
                            // Vendor Lock-in
                            {
                              type: 'div',
                              content: '$t:home.comparison.table.row4.aspect',
                            },
                            {
                              type: 'div',
                              props: { className: 'text-green-400' },
                              content: '$t:home.comparison.table.row4.sovrium',
                            },
                            {
                              type: 'div',
                              props: { className: 'text-red-400' },
                              content: '$t:home.comparison.table.row4.saas',
                            },
                            // Customization
                            {
                              type: 'div',
                              content: '$t:home.comparison.table.row5.aspect',
                            },
                            {
                              type: 'div',
                              props: { className: 'text-green-400' },
                              content: '$t:home.comparison.table.row5.sovrium',
                            },
                            {
                              type: 'div',
                              props: { className: 'text-yellow-400' },
                              content: '$t:home.comparison.table.row5.saas',
                            },
                            // Version Control
                            {
                              type: 'div',
                              content: '$t:home.comparison.table.row6.aspect',
                            },
                            {
                              type: 'div',
                              props: { className: 'text-green-400' },
                              content: '$t:home.comparison.table.row6.sovrium',
                            },
                            {
                              type: 'div',
                              props: { className: 'text-yellow-400' },
                              content: '$t:home.comparison.table.row6.saas',
                            },
                            // Privacy
                            {
                              type: 'div',
                              content: '$t:home.comparison.table.row7.aspect',
                            },
                            {
                              type: 'div',
                              props: { className: 'text-green-400' },
                              content: '$t:home.comparison.table.row7.sovrium',
                            },
                            {
                              type: 'div',
                              props: { className: 'text-red-400' },
                              content: '$t:home.comparison.table.row7.saas',
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
          props: { className: 'max-w-6xl mx-auto px-4' },
          children: [
            {
              type: 'h2',
              content: '$t:home.useCases.title',
              props: {
                className: 'text-3xl sm:text-4xl md:text-5xl font-bold text-center mb-12 md:mb-16',
              },
            },
            {
              type: 'grid',
              props: { className: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8' },
              children: [
                {
                  type: 'card',
                  props: {
                    className:
                      'bg-sovereignty-gray-900 border border-sovereignty-gray-800 p-6 rounded-lg hover:border-sovereignty-accent transition-colors',
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
                      'bg-sovereignty-gray-900 border border-sovereignty-gray-800 p-6 rounded-lg hover:border-sovereignty-accent transition-colors',
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
                      'bg-sovereignty-gray-900 border border-sovereignty-gray-800 p-6 rounded-lg hover:border-sovereignty-accent transition-colors',
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
                      'bg-sovereignty-gray-900 border border-sovereignty-gray-800 p-6 rounded-lg hover:border-sovereignty-accent transition-colors',
                  },
                  children: [
                    {
                      type: 'h3',
                      content: '$t:home.useCases.api.title',
                      props: { className: 'text-xl font-semibold mb-3' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:home.useCases.api.description',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                  ],
                },
                {
                  type: 'card',
                  props: {
                    className:
                      'bg-sovereignty-gray-900 border border-sovereignty-gray-800 p-6 rounded-lg hover:border-sovereignty-accent transition-colors',
                  },
                  children: [
                    {
                      type: 'h3',
                      content: '$t:home.useCases.static.title',
                      props: { className: 'text-xl font-semibold mb-3' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:home.useCases.static.description',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                  ],
                },
                {
                  type: 'card',
                  props: {
                    className:
                      'bg-sovereignty-gray-900 border border-sovereignty-gray-800 p-6 rounded-lg hover:border-sovereignty-accent transition-colors',
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
          props: { className: 'max-w-6xl mx-auto px-4' },
          children: [
            {
              type: 'h2',
              content: '$t:home.features.title',
              props: {
                className: 'text-3xl sm:text-4xl md:text-5xl font-bold text-center mb-6 md:mb-8',
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
              props: { className: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8' },
              children: [
                // Authentication
                {
                  type: 'card',
                  props: {
                    className:
                      'bg-sovereignty-gray-900 border border-sovereignty-gray-800 p-6 rounded-lg hover:border-sovereignty-accent transition-colors',
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
                        { type: 'paragraph', content: '$t:home.features.auth.point4' },
                        { type: 'paragraph', content: '$t:home.features.auth.point5' },
                        { type: 'paragraph', content: '$t:home.features.auth.point6' },
                      ],
                    },
                  ],
                },

                // Tables & Data
                {
                  type: 'card',
                  props: {
                    className:
                      'bg-sovereignty-gray-900 border border-sovereignty-gray-800 p-6 rounded-lg hover:border-sovereignty-accent transition-colors',
                  },
                  children: [
                    {
                      type: 'h3',
                      content: '$t:home.features.tables.title',
                      props: { className: 'text-xl font-semibold mb-3' },
                    },
                    {
                      type: 'div',
                      props: { className: 'space-y-1 text-sm text-sovereignty-gray-400' },
                      children: [
                        { type: 'paragraph', content: '$t:home.features.tables.point1' },
                        { type: 'paragraph', content: '$t:home.features.tables.point2' },
                        { type: 'paragraph', content: '$t:home.features.tables.point3' },
                        { type: 'paragraph', content: '$t:home.features.tables.point4' },
                        { type: 'paragraph', content: '$t:home.features.tables.point5' },
                        { type: 'paragraph', content: '$t:home.features.tables.point6' },
                      ],
                    },
                  ],
                },

                // Records API
                {
                  type: 'card',
                  props: {
                    className:
                      'bg-sovereignty-gray-900 border border-sovereignty-gray-800 p-6 rounded-lg hover:border-sovereignty-accent transition-colors',
                  },
                  children: [
                    {
                      type: 'h3',
                      content: '$t:home.features.api.title',
                      props: { className: 'text-xl font-semibold mb-3' },
                    },
                    {
                      type: 'div',
                      props: { className: 'space-y-1 text-sm text-sovereignty-gray-400' },
                      children: [
                        { type: 'paragraph', content: '$t:home.features.api.point1' },
                        { type: 'paragraph', content: '$t:home.features.api.point2' },
                        { type: 'paragraph', content: '$t:home.features.api.point3' },
                        { type: 'paragraph', content: '$t:home.features.api.point4' },
                        { type: 'paragraph', content: '$t:home.features.api.point5' },
                        { type: 'paragraph', content: '$t:home.features.api.point6' },
                      ],
                    },
                  ],
                },

                // Pages & UI
                {
                  type: 'card',
                  props: {
                    className:
                      'bg-sovereignty-gray-900 border border-sovereignty-gray-800 p-6 rounded-lg hover:border-sovereignty-accent transition-colors',
                  },
                  children: [
                    {
                      type: 'h3',
                      content: '$t:home.features.pages.title',
                      props: { className: 'text-xl font-semibold mb-3' },
                    },
                    {
                      type: 'div',
                      props: { className: 'space-y-1 text-sm text-sovereignty-gray-400' },
                      children: [
                        { type: 'paragraph', content: '$t:home.features.pages.point1' },
                        { type: 'paragraph', content: '$t:home.features.pages.point2' },
                        { type: 'paragraph', content: '$t:home.features.pages.point3' },
                        { type: 'paragraph', content: '$t:home.features.pages.point4' },
                        { type: 'paragraph', content: '$t:home.features.pages.point5' },
                        { type: 'paragraph', content: '$t:home.features.pages.point6' },
                      ],
                    },
                  ],
                },

                // Theming & i18n
                {
                  type: 'card',
                  props: {
                    className:
                      'bg-sovereignty-gray-900 border border-sovereignty-gray-800 p-6 rounded-lg hover:border-sovereignty-accent transition-colors',
                  },
                  children: [
                    {
                      type: 'h3',
                      content: '$t:home.features.theming.title',
                      props: { className: 'text-xl font-semibold mb-3' },
                    },
                    {
                      type: 'div',
                      props: { className: 'space-y-1 text-sm text-sovereignty-gray-400' },
                      children: [
                        { type: 'paragraph', content: '$t:home.features.theming.point1' },
                        { type: 'paragraph', content: '$t:home.features.theming.point2' },
                        { type: 'paragraph', content: '$t:home.features.theming.point3' },
                        { type: 'paragraph', content: '$t:home.features.theming.point4' },
                        { type: 'paragraph', content: '$t:home.features.theming.point5' },
                        { type: 'paragraph', content: '$t:home.features.theming.point6' },
                      ],
                    },
                  ],
                },

                // Admin & Operations
                {
                  type: 'card',
                  props: {
                    className:
                      'bg-sovereignty-gray-900 border border-sovereignty-gray-800 p-6 rounded-lg hover:border-sovereignty-accent transition-colors',
                  },
                  children: [
                    {
                      type: 'h3',
                      content: '$t:home.features.admin.title',
                      props: { className: 'text-xl font-semibold mb-3' },
                    },
                    {
                      type: 'div',
                      props: { className: 'space-y-1 text-sm text-sovereignty-gray-400' },
                      children: [
                        { type: 'paragraph', content: '$t:home.features.admin.point1' },
                        { type: 'paragraph', content: '$t:home.features.admin.point2' },
                        { type: 'paragraph', content: '$t:home.features.admin.point3' },
                        { type: 'paragraph', content: '$t:home.features.admin.point4' },
                        { type: 'paragraph', content: '$t:home.features.admin.point5' },
                        { type: 'paragraph', content: '$t:home.features.admin.point6' },
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

    // Tech Stack Section
    {
      type: 'section',
      props: {
        className: 'py-16 md:py-24 bg-sovereignty-darker text-sovereignty-light',
        id: 'tech-stack',
      },
      children: [
        {
          type: 'container',
          props: { className: 'max-w-6xl mx-auto px-4' },
          children: [
            {
              type: 'h2',
              content: '$t:home.techStack.title',
              props: {
                className: 'text-3xl sm:text-4xl md:text-5xl font-bold text-center mb-6 md:mb-8',
              },
            },
            {
              type: 'paragraph',
              content: '$t:home.techStack.subtitle',
              props: {
                className:
                  'text-base sm:text-lg md:text-xl text-sovereignty-gray-400 text-center mb-12 md:mb-16',
              },
            },
            {
              type: 'grid',
              props: { className: 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 md:gap-6' },
              children: [
                {
                  type: 'badge',
                  content: 'Bun 1.3+',
                  props: {
                    className:
                      'bg-sovereignty-gray-900 border border-sovereignty-gray-800 text-center p-4 rounded-lg hover:border-sovereignty-accent transition-colors',
                  },
                },
                {
                  type: 'badge',
                  content: 'PostgreSQL',
                  props: {
                    className:
                      'bg-sovereignty-gray-900 border border-sovereignty-gray-800 text-center p-4 rounded-lg hover:border-sovereignty-accent transition-colors',
                  },
                },
                {
                  type: 'badge',
                  content: 'React 19',
                  props: {
                    className:
                      'bg-sovereignty-gray-900 border border-sovereignty-gray-800 text-center p-4 rounded-lg hover:border-sovereignty-accent transition-colors',
                  },
                },
                {
                  type: 'badge',
                  content: 'TypeScript',
                  props: {
                    className:
                      'bg-sovereignty-gray-900 border border-sovereignty-gray-800 text-center p-4 rounded-lg hover:border-sovereignty-accent transition-colors',
                  },
                },
                {
                  type: 'badge',
                  content: 'Effect.ts',
                  props: {
                    className:
                      'bg-sovereignty-gray-900 border border-sovereignty-gray-800 text-center p-4 rounded-lg hover:border-sovereignty-accent transition-colors',
                  },
                },
                {
                  type: 'badge',
                  content: 'Hono',
                  props: {
                    className:
                      'bg-sovereignty-gray-900 border border-sovereignty-gray-800 text-center p-4 rounded-lg hover:border-sovereignty-accent transition-colors',
                  },
                },
                {
                  type: 'badge',
                  content: 'Drizzle ORM',
                  props: {
                    className:
                      'bg-sovereignty-gray-900 border border-sovereignty-gray-800 text-center p-4 rounded-lg hover:border-sovereignty-accent transition-colors',
                  },
                },
                {
                  type: 'badge',
                  content: 'Better Auth',
                  props: {
                    className:
                      'bg-sovereignty-gray-900 border border-sovereignty-gray-800 text-center p-4 rounded-lg hover:border-sovereignty-accent transition-colors',
                  },
                },
                {
                  type: 'badge',
                  content: 'Tailwind CSS',
                  props: {
                    className:
                      'bg-sovereignty-gray-900 border border-sovereignty-gray-800 text-center p-4 rounded-lg hover:border-sovereignty-accent transition-colors',
                  },
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
          props: { className: 'max-w-6xl mx-auto px-4' },
          children: [
            {
              type: 'h2',
              content: '$t:home.gettingStarted.title',
              props: {
                className: 'text-3xl sm:text-4xl md:text-5xl font-bold text-center mb-12 md:mb-16',
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
                      content: 'bun install sovrium',
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
                      content: 'bun sovrium start',
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
                  type: 'link',
                  content: '$t:home.gettingStarted.status.cta',
                  props: {
                    href: 'https://github.com/sovrium/sovrium',
                    className:
                      'inline-block bg-sovereignty-accent hover:bg-sovereignty-accent-hover text-white px-6 py-3 rounded-lg font-semibold transition-all',
                  },
                },
              ],
            },
          ],
        },
      ],
    },

    // Footer CTA Section
    {
      type: 'footer',
      props: {
        className:
          'py-16 bg-sovereignty-darker border-t border-sovereignty-gray-800 text-sovereignty-light',
      },
      children: [
        {
          type: 'container',
          props: { className: 'max-w-6xl mx-auto px-4 text-center' },
          children: [
            {
              type: 'h2',
              content: '$t:home.footer.cta.title',
              props: { className: 'text-2xl sm:text-3xl font-bold mb-6 md:mb-8' },
            },
            {
              type: 'flex',
              props: { className: 'flex-col sm:flex-row justify-center gap-4 mb-12' },
              children: [
                {
                  type: 'link',
                  content: '$t:home.footer.cta.docs',
                  props: {
                    href: 'https://github.com/sovrium/sovrium/blob/main/README.md',
                    className:
                      'inline-block bg-sovereignty-accent hover:bg-sovereignty-accent-hover text-white px-6 py-3 rounded-lg font-semibold transition-all text-center',
                  },
                },
                {
                  type: 'link',
                  content: '$t:home.footer.cta.github',
                  props: {
                    href: 'https://github.com/sovrium/sovrium',
                    className:
                      'inline-block border-2 border-sovereignty-accent text-sovereignty-accent px-6 py-3 rounded-lg font-semibold hover:bg-sovereignty-accent hover:text-white transition-all text-center',
                  },
                },
              ],
            },

            // Footer Links
            {
              type: 'flex',
              props: {
                className:
                  'flex-col sm:flex-row justify-center gap-4 sm:gap-6 md:gap-8 text-sovereignty-gray-400 mb-8 text-center sm:text-left',
              },
              children: [
                {
                  type: 'link',
                  content: '$t:home.footer.privacy',
                  props: {
                    href: '$t:home.footer.privacy.href',
                    className: 'hover:text-sovereignty-accent transition-colors',
                  },
                },
                {
                  type: 'link',
                  content: '$t:home.footer.terms',
                  props: {
                    href: '$t:home.footer.terms.href',
                    className: 'hover:text-sovereignty-accent transition-colors',
                  },
                },
                {
                  type: 'link',
                  content: '$t:home.footer.license',
                  props: {
                    href: 'https://github.com/sovrium/sovrium/blob/main/LICENSE.md',
                    className: 'hover:text-sovereignty-accent transition-colors',
                  },
                },
                {
                  type: 'link',
                  content: '$t:home.footer.trademark',
                  props: {
                    href: 'https://github.com/sovrium/sovrium/blob/main/TRADEMARK.md',
                    className: 'hover:text-sovereignty-accent transition-colors',
                  },
                },
                {
                  type: 'link',
                  content: '$t:home.footer.partners',
                  props: {
                    href: '$t:home.footer.partners.href',
                    className: 'hover:text-sovereignty-accent transition-colors',
                  },
                },
              ],
            },

            {
              type: 'paragraph',
              content: '$t:home.footer.copyright',
              props: { className: 'text-sovereignty-gray-500 text-sm' },
            },
          ],
        },
      ],
    },

    // Built with Sovrium Badge (Fixed bottom-right)
    {
      type: 'div',
      props: {
        className: 'fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 hidden sm:block',
      },
      children: [
        {
          type: 'link',
          props: {
            href: 'https://github.com/sovrium/sovrium',
            className:
              'flex items-center gap-2 bg-sovereignty-gray-900 hover:bg-sovereignty-gray-800 border border-sovereignty-gray-700 hover:border-sovereignty-accent text-sovereignty-gray-400 hover:text-sovereignty-accent px-3 py-2 rounded-lg text-xs font-medium transition-all shadow-lg',
            target: '_blank',
            rel: 'noopener noreferrer',
          },
          children: [
            {
              type: 'span',
              content: '\u26A1',
              props: { className: 'text-sm' },
            },
            {
              type: 'span',
              content: 'Built with Sovrium',
            },
          ],
        },
      ],
    },
  ],
}
