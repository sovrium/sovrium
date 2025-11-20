/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Page } from '@/index'

export const home: Page = {
  name: 'home',
  path: '/',
  meta: {
    title: 'Sovrium - Own Your Data, Own Your Tools, Own Your Future',
    description:
      'Self-hosted platform for building business applications. Configuration-driven development with complete data sovereignty.',
    keywords:
      'digital sovereignty, self-hosted platform, no-code alternative, configuration-driven, airtable alternative, retool alternative, SaaS replacement',
    author: 'ESSENTIAL SERVICES',
    canonical: 'https://sovrium.com',
    openGraph: {
      title: 'Sovrium - Digital Sovereignty Platform',
      description:
        'Self-hosted platform for business applications without vendor lock-in. Configuration-driven development.',
      type: 'website',
      url: 'https://sovrium.com',
      image: 'https://sovrium.com/og-image.png',
      siteName: 'Sovrium',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Sovrium - Own Your Digital Infrastructure',
      description: 'Build business applications through JSON configuration. No vendor lock-in.',
      image: 'https://sovrium.com/twitter-card.png',
    },
  },
  sections: [
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
              content: 'Sovrium™',
              props: {
                className:
                  'text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-6 bg-gradient-to-r from-sovereignty-accent to-sovereignty-teal bg-clip-text text-transparent',
              },
            },
            {
              type: 'h2',
              content: 'Own your data. Own your tools. Own your future.',
              props: {
                className:
                  'text-xl sm:text-2xl md:text-3xl font-semibold text-sovereignty-teal mb-8',
              },
            },
            {
              type: 'paragraph',
              content:
                'Break free from SaaS dependency with a self-hosted, configuration-driven platform that puts you back in control.',
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
                  content: 'Get Started',
                  props: {
                    href: '#getting-started',
                    className:
                      'inline-block bg-sovereignty-accent hover:bg-sovereignty-accent-hover text-white px-6 sm:px-8 py-3 sm:py-4 rounded-lg font-semibold transition-all transform hover:-translate-y-1 text-center',
                  },
                },
                {
                  type: 'link',
                  content: 'View on GitHub',
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
              content: 'The SaaS Dependency Crisis',
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
                      content: '20+',
                      props: {
                        className: 'text-4xl sm:text-5xl font-bold text-sovereignty-accent mb-2',
                      },
                    },
                    {
                      type: 'paragraph',
                      content: 'SaaS subscriptions per company',
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
                      content: '$10,000+',
                      props: {
                        className: 'text-4xl sm:text-5xl font-bold text-sovereignty-accent mb-2',
                      },
                    },
                    {
                      type: 'paragraph',
                      content: 'Monthly fees for mid-sized teams',
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
                      content: '100%',
                      props: {
                        className: 'text-4xl sm:text-5xl font-bold text-sovereignty-accent mb-2',
                      },
                    },
                    {
                      type: 'paragraph',
                      content: 'Vendor lock-in with no-code tools',
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
                  content: 'The Hidden Costs',
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
                          content: '❌',
                          props: { className: 'mr-3 text-xl' },
                        },
                        {
                          type: 'div',
                          children: [
                            {
                              type: 'span',
                              content: 'Loss of Sovereignty: ',
                              props: { className: 'font-semibold text-sovereignty-light' },
                            },
                            {
                              type: 'span',
                              content: "Your business logic lives on someone else's platform",
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
                          content: '❌',
                          props: { className: 'mr-3 text-xl' },
                        },
                        {
                          type: 'div',
                          children: [
                            {
                              type: 'span',
                              content: 'Compounding Expenses: ',
                              props: { className: 'font-semibold text-sovereignty-light' },
                            },
                            {
                              type: 'span',
                              content: 'Per-user pricing scales exponentially with growth',
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
                          content: '❌',
                          props: { className: 'mr-3 text-xl' },
                        },
                        {
                          type: 'div',
                          children: [
                            {
                              type: 'span',
                              content: 'Feature Dependency: ',
                              props: { className: 'font-semibold text-sovereignty-light' },
                            },
                            {
                              type: 'span',
                              content: "Can't build what you need—only what vendors provide",
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
                          content: '❌',
                          props: { className: 'mr-3 text-xl' },
                        },
                        {
                          type: 'div',
                          children: [
                            {
                              type: 'span',
                              content: 'Engineering Distraction: ',
                              props: { className: 'font-semibold text-sovereignty-light' },
                            },
                            {
                              type: 'span',
                              content: 'Teams waste time integrating incompatible tools',
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
                          content: '❌',
                          props: { className: 'mr-3 text-xl' },
                        },
                        {
                          type: 'div',
                          children: [
                            {
                              type: 'span',
                              content: 'Strategic Risk: ',
                              props: { className: 'font-semibold text-sovereignty-light' },
                            },
                            {
                              type: 'span',
                              content: 'Business continuity depends on external companies',
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
              content: 'The Solution: Sovrium',
              props: {
                className: 'text-3xl sm:text-4xl md:text-5xl font-bold text-center mb-6 md:mb-8',
              },
            },
            {
              type: 'paragraph',
              content:
                'A self-hosted, configuration-driven platform that interprets JSON to build full-featured web applications—without code generation, without vendor lock-in, without loss of control.',
              props: {
                className:
                  'text-base sm:text-lg md:text-xl text-sovereignty-gray-400 text-center max-w-4xl mx-auto mb-12 md:mb-16',
              },
            },

            // Code Example
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
                      content: `{
  "name": "Company CRM",
  "tables": [ /* your data structures */ ],
  "pages": [ /* your web interfaces */ ],
  "automations": [ /* your workflows */ ],
  "connections": [ /* your integrations */ ]
}`,
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
                      content: 'One command to run:',
                      props: { className: 'text-sovereignty-gray-400 mb-2' },
                    },
                    {
                      type: 'pre',
                      children: [
                        {
                          type: 'code',
                          content: 'bun run sovrium start config.json',
                          props: { className: 'text-sovereignty-teal font-mono' },
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
                  content: 'How It Works',
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
                          content: 'You write',
                          props: { className: 'font-semibold mb-2' },
                        },
                        {
                          type: 'paragraph',
                          content: 'JSON configuration describing your business needs',
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
                          content: 'Sovrium interprets',
                          props: { className: 'font-semibold mb-2' },
                        },
                        {
                          type: 'paragraph',
                          content: 'Configuration at runtime (no code generation)',
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
                          content: 'You own',
                          props: { className: 'font-semibold mb-2' },
                        },
                        {
                          type: 'paragraph',
                          content: 'Full application running on your servers',
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
                          content: 'You control',
                          props: { className: 'font-semibold mb-2' },
                        },
                        {
                          type: 'paragraph',
                          content: 'Data, features, deployment, everything',
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
              content: 'Core Principles',
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
                      content: '🛡️',
                    },
                    {
                      type: 'h3',
                      content: 'Digital Sovereignty',
                      props: { className: 'text-xl sm:text-2xl font-semibold mb-4' },
                    },
                    {
                      type: 'div',
                      props: { className: 'space-y-2 text-sovereignty-gray-400' },
                      children: [
                        { type: 'paragraph', content: '✓ Your data on your infrastructure' },
                        { type: 'paragraph', content: '✓ Your features, your business needs' },
                        { type: 'paragraph', content: '✓ Your control over deployment & security' },
                        { type: 'paragraph', content: '✓ Your independence from vendor decisions' },
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
                      content: '⚙️',
                    },
                    {
                      type: 'h3',
                      content: 'Configuration Over Coding',
                      props: { className: 'text-xl sm:text-2xl font-semibold mb-4' },
                    },
                    {
                      type: 'div',
                      props: { className: 'space-y-2 text-sovereignty-gray-400' },
                      children: [
                        {
                          type: 'paragraph',
                          content: '✓ JSON/TypeScript instead of drag-and-drop',
                        },
                        {
                          type: 'paragraph',
                          content: '✓ Version control (Git) for all configuration',
                        },
                        {
                          type: 'paragraph',
                          content: '✓ Type safety with compile-time validation',
                        },
                        {
                          type: 'paragraph',
                          content: '✓ Reusable templates as organizational knowledge',
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
                      content: '📦',
                    },
                    {
                      type: 'h3',
                      content: 'Minimal Dependencies',
                      props: { className: 'text-xl sm:text-2xl font-semibold mb-4' },
                    },
                    {
                      type: 'div',
                      props: { className: 'space-y-2 text-sovereignty-gray-400' },
                      children: [
                        {
                          type: 'paragraph',
                          content: '✓ Depend only on commodity compute & storage',
                        },
                        { type: 'paragraph', content: '✓ No proprietary SaaS platforms' },
                        {
                          type: 'paragraph',
                          content: '✓ Source-available for auditing & extending',
                        },
                        { type: 'paragraph', content: '✓ Self-hosted, no external service calls' },
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
                      content: '🎯',
                    },
                    {
                      type: 'h3',
                      content: 'Business Focus',
                      props: { className: 'text-xl sm:text-2xl font-semibold mb-4' },
                    },
                    {
                      type: 'div',
                      props: { className: 'space-y-2 text-sovereignty-gray-400' },
                      children: [
                        { type: 'paragraph', content: '✓ No DevOps overhead (included)' },
                        { type: 'paragraph', content: '✓ No integration hell (one platform)' },
                        { type: 'paragraph', content: '✓ No vendor research needed' },
                        { type: 'paragraph', content: '✓ Instant iteration (config → refresh)' },
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
              content: 'The Sovrium Advantage',
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
                  content: '80% faster than custom development',
                  props: { className: 'text-xl sm:text-2xl md:text-3xl font-bold text-white mb-2' },
                },
                {
                  type: 'h3',
                  content: '100% more control than SaaS',
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
                  content: 'vs. Traditional No-Code SaaS',
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
                              content: 'Aspect',
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
                              content: 'Data Ownership',
                            },
                            {
                              type: 'div',
                              props: { className: 'text-green-400' },
                              content: '✅ Your servers',
                            },
                            {
                              type: 'div',
                              props: { className: 'text-red-400' },
                              content: '❌ Vendor cloud',
                            },
                            // Source Code
                            {
                              type: 'div',
                              content: 'Source Code',
                            },
                            {
                              type: 'div',
                              props: { className: 'text-green-400' },
                              content: '✅ Available (fair-code)',
                            },
                            {
                              type: 'div',
                              props: { className: 'text-red-400' },
                              content: '❌ Proprietary',
                            },
                            // Monthly Cost
                            {
                              type: 'div',
                              content: 'Monthly Cost',
                            },
                            {
                              type: 'div',
                              props: { className: 'text-green-400' },
                              content: '$0 (infra only)',
                            },
                            {
                              type: 'div',
                              props: { className: 'text-red-400' },
                              content: '$20-50/user/month',
                            },
                            // Vendor Lock-in
                            {
                              type: 'div',
                              content: 'Vendor Lock-in',
                            },
                            {
                              type: 'div',
                              props: { className: 'text-green-400' },
                              content: '✅ None',
                            },
                            {
                              type: 'div',
                              props: { className: 'text-red-400' },
                              content: '❌ Complete',
                            },
                            // Customization
                            {
                              type: 'div',
                              content: 'Customization',
                            },
                            {
                              type: 'div',
                              props: { className: 'text-green-400' },
                              content: '✅ Unlimited',
                            },
                            {
                              type: 'div',
                              props: { className: 'text-yellow-400' },
                              content: '⚠️ Limited',
                            },
                            // Version Control
                            {
                              type: 'div',
                              content: 'Version Control',
                            },
                            {
                              type: 'div',
                              props: { className: 'text-green-400' },
                              content: '✅ Git-native',
                            },
                            {
                              type: 'div',
                              props: { className: 'text-yellow-400' },
                              content: '⚠️ Limited',
                            },
                            // Privacy
                            {
                              type: 'div',
                              content: 'Privacy',
                            },
                            {
                              type: 'div',
                              props: { className: 'text-green-400' },
                              content: '✅ 100% your control',
                            },
                            {
                              type: 'div',
                              props: { className: 'text-red-400' },
                              content: '❌ Third-party servers',
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
              content: 'Built For',
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
                      content: '📊 Internal Tools',
                      props: { className: 'text-xl font-semibold mb-3' },
                    },
                    {
                      type: 'paragraph',
                      content:
                        'Admin dashboards, employee portals, data management systems—build exactly what your team needs without per-user SaaS fees.',
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
                      content: '👥 Customer Portals',
                      props: { className: 'text-xl font-semibold mb-3' },
                    },
                    {
                      type: 'paragraph',
                      content:
                        'Self-service interfaces, account management, support systems—give customers control while keeping data on your servers.',
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
                      content: '🏢 Business Applications',
                      props: { className: 'text-xl font-semibold mb-3' },
                    },
                    {
                      type: 'paragraph',
                      content:
                        'CRM, inventory management, project tracking—configure complex workflows without vendor limitations.',
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
                      content: '🔌 API Platforms',
                      props: { className: 'text-xl font-semibold mb-3' },
                    },
                    {
                      type: 'paragraph',
                      content:
                        'REST endpoints, webhooks, third-party integrations—expose your data securely on your terms.',
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
                      content: '🌐 Static Websites',
                      props: { className: 'text-xl font-semibold mb-3' },
                    },
                    {
                      type: 'paragraph',
                      content:
                        'Marketing sites, landing pages, documentation—generate static assets from JSON configuration.',
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
                      content: '🚀 MVP Development',
                      props: { className: 'text-xl font-semibold mb-3' },
                    },
                    {
                      type: 'paragraph',
                      content:
                        'Rapid prototyping, startup MVPs, proof of concepts—launch faster without technical debt.',
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

    // Tech Stack Section
    {
      type: 'section',
      props: {
        className: 'py-16 md:py-24 bg-sovereignty-dark text-sovereignty-light',
        id: 'tech-stack',
      },
      children: [
        {
          type: 'container',
          props: { className: 'max-w-6xl mx-auto px-4' },
          children: [
            {
              type: 'h2',
              content: 'Technical Architecture',
              props: {
                className: 'text-3xl sm:text-4xl md:text-5xl font-bold text-center mb-6 md:mb-8',
              },
            },
            {
              type: 'paragraph',
              content: 'Built on modern, proven technologies',
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
              content: 'Get Started',
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
                      content: 'Install',
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
                      content: 'Configure',
                      props: { className: 'text-xl font-semibold mb-2' },
                    },
                    {
                      type: 'paragraph',
                      content: 'Create config.json with tables, pages, workflows',
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
                      content: 'Run',
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
                      content: 'Deploy',
                      props: { className: 'text-xl font-semibold mb-2' },
                    },
                    {
                      type: 'paragraph',
                      content: 'Host on AWS, Vercel, Docker, or bare metal',
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
                  content: '🚧 Phase 0 - Foundation',
                  props: { className: 'text-xl sm:text-2xl font-semibold mb-4' },
                },
                {
                  type: 'paragraph',
                  content:
                    'Currently in early development. Static website generation available now. Core features coming in 2025-2026.',
                  props: { className: 'text-sovereignty-gray-400 mb-6' },
                },
                {
                  type: 'link',
                  content: '⭐ Star on GitHub to Follow Progress',
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
              content: 'Ready to break free from SaaS dependency?',
              props: { className: 'text-2xl sm:text-3xl font-bold mb-6 md:mb-8' },
            },
            {
              type: 'flex',
              props: { className: 'flex-col sm:flex-row justify-center gap-4 mb-12' },
              children: [
                {
                  type: 'link',
                  content: 'View Documentation',
                  props: {
                    href: 'https://github.com/sovrium/sovrium/blob/main/README.md',
                    className:
                      'inline-block bg-sovereignty-accent hover:bg-sovereignty-accent-hover text-white px-6 py-3 rounded-lg font-semibold transition-all text-center',
                  },
                },
                {
                  type: 'link',
                  content: 'GitHub Repository',
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
                  content: 'Privacy Policy',
                  props: {
                    href: '/privacy-policy',
                    className: 'hover:text-sovereignty-accent transition-colors',
                  },
                },
                {
                  type: 'link',
                  content: 'Terms of Service',
                  props: {
                    href: '/terms-of-service',
                    className: 'hover:text-sovereignty-accent transition-colors',
                  },
                },
                {
                  type: 'link',
                  content: 'License',
                  props: {
                    href: 'https://github.com/sovrium/sovrium/blob/main/LICENSE.md',
                    className: 'hover:text-sovereignty-accent transition-colors',
                  },
                },
                {
                  type: 'link',
                  content: 'Trademark',
                  props: {
                    href: 'https://github.com/sovrium/sovrium/blob/main/TRADEMARK.md',
                    className: 'hover:text-sovereignty-accent transition-colors',
                  },
                },
              ],
            },

            {
              type: 'paragraph',
              content:
                '© 2025 ESSENTIAL SERVICES. Sovrium™ is a trademark of ESSENTIAL SERVICES.',
              props: { className: 'text-sovereignty-gray-500 text-sm' },
            },
          ],
        },
      ],
    },
  ],
}
