/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { favicons } from './favicons'
import { footerI18n } from './footer'
import { navbar } from './navbar'
import type { Page } from '@/index'

// --- Helpers ----------------------------------------------------------------

const valueCard = (key: string) => ({
  type: 'card' as const,
  props: {
    className:
      'bg-sovereignty-gray-900 border border-sovereignty-gray-800 p-8 rounded-lg hover:border-sovereignty-accent transition-colors',
  },
  children: [
    {
      type: 'div' as const,
      props: { className: 'text-3xl mb-4' },
      content: `$t:company.values.${key}.icon`,
    },
    {
      type: 'h3' as const,
      content: `$t:company.values.${key}.title`,
      props: { className: 'text-xl font-semibold mb-3 text-sovereignty-light' },
    },
    {
      type: 'paragraph' as const,
      content: `$t:company.values.${key}.description`,
      props: { className: 'text-sovereignty-gray-400 leading-relaxed' },
    },
  ],
})

const principleItem = (key: string) => ({
  type: 'div' as const,
  props: {
    className:
      'bg-sovereignty-gray-900 border border-sovereignty-gray-800 p-6 rounded-lg hover:border-sovereignty-teal transition-colors',
  },
  children: [
    {
      type: 'h4' as const,
      content: `$t:company.principles.${key}.title`,
      props: { className: 'text-lg font-semibold mb-2 text-sovereignty-light' },
    },
    {
      type: 'paragraph' as const,
      content: `$t:company.principles.${key}.description`,
      props: { className: 'text-sm text-sovereignty-gray-400 leading-relaxed' },
    },
  ],
})

// --- Page -------------------------------------------------------------------

export const company: Page = {
  name: 'company',
  path: '/company',
  meta: {
    title: '$t:company.meta.title',
    description: '$t:company.meta.description',
    keywords:
      'sovrium, company, vision, team, ESSENTIAL SERVICES, digital sovereignty, open source',
    author: 'ESSENTIAL SERVICES',
    canonical: 'https://sovrium.com/company',
    favicons,
    openGraph: {
      title: '$t:company.meta.og.title',
      description: '$t:company.meta.og.description',
      type: 'website',
      url: 'https://sovrium.com/company',
      image: 'https://sovrium.com/og-image.png',
      siteName: 'Sovrium',
    },
    twitter: {
      card: 'summary_large_image',
      title: '$t:company.meta.twitter.title',
      description: '$t:company.meta.twitter.description',
      image: 'https://sovrium.com/twitter-card.png',
    },
  },
  sections: [
    // Navigation Bar
    navbar,

    // --- Section 1: Hero ---------------------------------------------------
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
              type: 'paragraph',
              content: '$t:company.hero.eyebrow',
              props: {
                className:
                  'text-sm uppercase tracking-widest text-sovereignty-accent font-medium mb-6',
              },
            },
            {
              type: 'h1',
              content: '$t:company.hero.title',
              props: {
                className:
                  'text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight bg-gradient-to-r from-sovereignty-accent to-sovereignty-teal bg-clip-text text-transparent overflow-visible',
              },
            },
            {
              type: 'paragraph',
              content: '$t:company.hero.subtitle',
              props: {
                className:
                  'text-base sm:text-lg md:text-xl text-sovereignty-gray-400 max-w-3xl mx-auto mb-8',
              },
            },
            {
              type: 'paragraph',
              content: '$t:company.hero.tagline',
              props: {
                className:
                  'text-lg sm:text-xl md:text-2xl font-semibold text-sovereignty-light italic',
              },
            },
          ],
        },
      ],
    },

    // --- Section 2: Mission ------------------------------------------------
    {
      type: 'section',
      props: {
        className: 'py-16 md:py-24 bg-sovereignty-darker text-sovereignty-light',
        id: 'mission',
      },
      children: [
        {
          type: 'container',
          props: { className: 'max-w-6xl mx-auto px-4 sm:px-6 md:px-8' },
          children: [
            {
              type: 'h2',
              content: '$t:company.mission.title',
              props: {
                className: 'text-3xl sm:text-4xl md:text-5xl font-bold text-center mb-8',
              },
            },
            {
              type: 'paragraph',
              content: '$t:company.mission.description',
              props: {
                className:
                  'text-base sm:text-lg md:text-xl text-sovereignty-gray-300 text-center max-w-3xl mx-auto mb-12 leading-relaxed',
              },
            },
            {
              type: 'div',
              props: {
                className:
                  'bg-sovereignty-gray-900 border border-sovereignty-gray-800 p-8 sm:p-10 rounded-lg max-w-3xl mx-auto',
              },
              children: [
                {
                  type: 'paragraph',
                  content: '$t:company.mission.statement',
                  props: {
                    className:
                      'text-lg sm:text-xl text-sovereignty-light leading-relaxed text-center italic',
                  },
                },
              ],
            },
          ],
        },
      ],
    },

    // --- Section 3: The Problem We Solve -----------------------------------
    {
      type: 'section',
      props: {
        className: 'py-16 md:py-24 bg-sovereignty-dark text-sovereignty-light',
        id: 'problem',
      },
      children: [
        {
          type: 'container',
          props: { className: 'max-w-6xl mx-auto px-4 sm:px-6 md:px-8' },
          children: [
            {
              type: 'h2',
              content: '$t:company.problem.title',
              props: {
                className: 'text-3xl sm:text-4xl md:text-5xl font-bold text-center mb-6',
              },
            },
            {
              type: 'paragraph',
              content: '$t:company.problem.subtitle',
              props: {
                className:
                  'text-base sm:text-lg md:text-xl text-sovereignty-gray-400 text-center max-w-3xl mx-auto mb-12',
              },
            },
            {
              type: 'grid',
              props: { className: 'grid grid-cols-1 md:grid-cols-2 gap-6' },
              children: [
                {
                  type: 'div' as const,
                  props: {
                    className:
                      'bg-sovereignty-gray-900 border border-sovereignty-gray-800 p-6 rounded-lg',
                  },
                  children: [
                    {
                      type: 'h4' as const,
                      content: '$t:company.problem.cost1.title',
                      props: {
                        className: 'text-lg font-semibold mb-2 text-sovereignty-light',
                      },
                    },
                    {
                      type: 'paragraph' as const,
                      content: '$t:company.problem.cost1.description',
                      props: { className: 'text-sm text-sovereignty-gray-400' },
                    },
                  ],
                },
                {
                  type: 'div' as const,
                  props: {
                    className:
                      'bg-sovereignty-gray-900 border border-sovereignty-gray-800 p-6 rounded-lg',
                  },
                  children: [
                    {
                      type: 'h4' as const,
                      content: '$t:company.problem.cost2.title',
                      props: {
                        className: 'text-lg font-semibold mb-2 text-sovereignty-light',
                      },
                    },
                    {
                      type: 'paragraph' as const,
                      content: '$t:company.problem.cost2.description',
                      props: { className: 'text-sm text-sovereignty-gray-400' },
                    },
                  ],
                },
                {
                  type: 'div' as const,
                  props: {
                    className:
                      'bg-sovereignty-gray-900 border border-sovereignty-gray-800 p-6 rounded-lg',
                  },
                  children: [
                    {
                      type: 'h4' as const,
                      content: '$t:company.problem.cost3.title',
                      props: {
                        className: 'text-lg font-semibold mb-2 text-sovereignty-light',
                      },
                    },
                    {
                      type: 'paragraph' as const,
                      content: '$t:company.problem.cost3.description',
                      props: { className: 'text-sm text-sovereignty-gray-400' },
                    },
                  ],
                },
                {
                  type: 'div' as const,
                  props: {
                    className:
                      'bg-sovereignty-gray-900 border border-sovereignty-gray-800 p-6 rounded-lg',
                  },
                  children: [
                    {
                      type: 'h4' as const,
                      content: '$t:company.problem.cost4.title',
                      props: {
                        className: 'text-lg font-semibold mb-2 text-sovereignty-light',
                      },
                    },
                    {
                      type: 'paragraph' as const,
                      content: '$t:company.problem.cost4.description',
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

    // --- Section 4: Our Values ---------------------------------------------
    {
      type: 'section',
      props: {
        className: 'py-16 md:py-24 bg-sovereignty-darker text-sovereignty-light',
        id: 'values',
      },
      children: [
        {
          type: 'container',
          props: { className: 'max-w-6xl mx-auto px-4 sm:px-6 md:px-8' },
          children: [
            {
              type: 'h2',
              content: '$t:company.values.title',
              props: {
                className: 'text-3xl sm:text-4xl md:text-5xl font-bold text-center mb-6',
              },
            },
            {
              type: 'paragraph',
              content: '$t:company.values.subtitle',
              props: {
                className:
                  'text-base sm:text-lg md:text-xl text-sovereignty-gray-400 text-center max-w-3xl mx-auto mb-12 md:mb-16',
              },
            },
            {
              type: 'grid',
              props: { className: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' },
              children: [
                valueCard('sovereignty'),
                valueCard('transparency'),
                valueCard('openSource'),
                valueCard('simplicity'),
                valueCard('ownership'),
                valueCard('longTerm'),
              ],
            },
          ],
        },
      ],
    },

    // --- Section 5: Core Principles ----------------------------------------
    {
      type: 'section',
      props: {
        className: 'py-16 md:py-24 bg-sovereignty-dark text-sovereignty-light',
        id: 'principles',
      },
      children: [
        {
          type: 'container',
          props: { className: 'max-w-6xl mx-auto px-4 sm:px-6 md:px-8' },
          children: [
            {
              type: 'h2',
              content: '$t:company.principles.title',
              props: {
                className: 'text-3xl sm:text-4xl md:text-5xl font-bold text-center mb-6',
              },
            },
            {
              type: 'paragraph',
              content: '$t:company.principles.subtitle',
              props: {
                className:
                  'text-base sm:text-lg md:text-xl text-sovereignty-gray-400 text-center max-w-3xl mx-auto mb-12 md:mb-16',
              },
            },
            {
              type: 'grid',
              props: { className: 'grid grid-cols-1 md:grid-cols-2 gap-6' },
              children: [
                principleItem('configOverCode'),
                principleItem('minimalDeps'),
                principleItem('businessFocus'),
                principleItem('configReuse'),
              ],
            },
          ],
        },
      ],
    },

    // --- Section 6: Team ---------------------------------------------------
    {
      type: 'section',
      props: {
        className: 'py-16 md:py-24 bg-sovereignty-darker text-sovereignty-light',
        id: 'team',
      },
      children: [
        {
          type: 'container',
          props: { className: 'max-w-6xl mx-auto px-4 sm:px-6 md:px-8' },
          children: [
            {
              type: 'h2',
              content: '$t:company.team.title',
              props: {
                className: 'text-3xl sm:text-4xl md:text-5xl font-bold text-center mb-6',
              },
            },
            {
              type: 'paragraph',
              content: '$t:company.team.subtitle',
              props: {
                className:
                  'text-base sm:text-lg md:text-xl text-sovereignty-gray-400 text-center max-w-3xl mx-auto mb-12 md:mb-16',
              },
            },
            {
              type: 'div',
              props: { className: 'flex justify-center' },
              children: [
                {
                  type: 'card',
                  props: {
                    className:
                      'bg-sovereignty-gray-900 border border-sovereignty-gray-800 p-8 sm:p-10 rounded-lg max-w-md w-full text-center hover:border-sovereignty-accent transition-colors',
                  },
                  children: [
                    // Founder photo
                    {
                      type: 'img',
                      props: {
                        src: '/thomas-jeanneau.jpg',
                        alt: 'Thomas Jeanneau',
                        className:
                          'w-24 h-24 rounded-full object-cover mx-auto mb-6 border-2 border-sovereignty-accent',
                      },
                    },
                    {
                      type: 'h3',
                      content: '$t:company.team.founder.name',
                      props: {
                        className: 'text-2xl font-bold text-sovereignty-light mb-1',
                      },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:company.team.founder.role',
                      props: {
                        className: 'text-sovereignty-accent font-medium mb-4',
                      },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:company.team.founder.bio',
                      props: {
                        className: 'text-sovereignty-gray-400 leading-relaxed mb-6',
                      },
                    },
                    {
                      type: 'flex',
                      props: { className: 'justify-center gap-4' },
                      children: [
                        {
                          type: 'link',
                          content: 'GitHub',
                          props: {
                            href: 'https://github.com/music-mash',
                            className:
                              'text-sovereignty-gray-400 hover:text-sovereignty-accent transition-colors text-sm',
                            target: '_blank',
                            rel: 'noopener noreferrer',
                          },
                        },
                        {
                          type: 'link',
                          content: 'LinkedIn',
                          props: {
                            href: 'https://www.linkedin.com/in/music-mash/',
                            className:
                              'text-sovereignty-gray-400 hover:text-sovereignty-accent transition-colors text-sm',
                            target: '_blank',
                            rel: 'noopener noreferrer',
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

    // --- Section 7: Open Source CTA ----------------------------------------
    {
      type: 'section',
      props: {
        className: 'py-16 md:py-20 bg-sovereignty-dark text-sovereignty-light',
        id: 'open-source',
      },
      children: [
        {
          type: 'container',
          props: { className: 'max-w-4xl mx-auto px-4 sm:px-6 md:px-8' },
          children: [
            {
              type: 'card',
              props: {
                className:
                  'bg-gradient-to-r from-sovereignty-accent to-sovereignty-teal p-8 sm:p-12 rounded-lg text-center',
              },
              children: [
                {
                  type: 'h2',
                  content: '$t:company.cta.title',
                  props: {
                    className: 'text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4',
                  },
                },
                {
                  type: 'paragraph',
                  content: '$t:company.cta.description',
                  props: {
                    className: 'text-lg text-white/90 max-w-2xl mx-auto mb-8',
                  },
                },
                {
                  type: 'flex',
                  props: { className: 'flex-col sm:flex-row justify-center gap-4' },
                  children: [
                    {
                      type: 'link',
                      content: '$t:company.cta.github',
                      props: {
                        href: 'https://github.com/sovrium/sovrium',
                        className:
                          'inline-block bg-white text-sovereignty-accent px-8 py-3 rounded-lg font-semibold hover:bg-sovereignty-gray-100 transition-all transform hover:-translate-y-1 text-center',
                        target: '_blank',
                        rel: 'noopener noreferrer',
                      },
                    },
                    {
                      type: 'link',
                      content: '$t:company.cta.partners',
                      props: {
                        href: '$t:company.cta.partners.href',
                        className:
                          'inline-block border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:text-sovereignty-accent transition-all text-center',
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

    // --- Section 8: Footer -------------------------------------------------
    footerI18n,

    // --- Built with Sovrium Badge (Fixed bottom-right) ---------------------
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
