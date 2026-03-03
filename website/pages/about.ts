/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { favicons } from './favicons'
import { footerI18n } from './footer'
import { createNavbar, langSwitchScript, mobileMenuScript } from './navbar'
import type { Page } from '@/index'

export const about: Page = {
  name: 'about',
  path: '/about',
  meta: {
    title: '$t:about.meta.title',
    description: '$t:about.meta.description',
    keywords: 'sovrium, about, vision, team, ESSENTIAL SERVICES, digital sovereignty, open source',
    author: 'ESSENTIAL SERVICES',
    canonical: 'https://sovrium.com/about',
    favicons,
    openGraph: {
      title: '$t:about.meta.og.title',
      description: '$t:about.meta.og.description',
      type: 'website',
      url: 'https://sovrium.com/about',
      image: 'https://sovrium.com/logos/sovrium-horizontal-dark.svg',
      siteName: 'Sovrium',
    },
    twitter: {
      card: 'summary_large_image',
      title: '$t:about.meta.twitter.title',
      description: '$t:about.meta.twitter.description',
      image: 'https://sovrium.com/logos/sovrium-horizontal-dark.svg',
    },
    schema: {
      organization: {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'ESSENTIAL SERVICES',
        legalName: 'ESSENTIAL SERVICES',
        url: 'https://sovrium.com',
        logo: 'https://sovrium.com/logos/sovrium-horizontal-dark.svg',
        description:
          'ESSENTIAL SERVICES builds Sovrium, an open-source configuration-driven application platform for digital sovereignty.',
        founder: {
          '@type': 'Person',
          name: 'Thomas Jeanneau',
          jobTitle: 'Founder & CEO',
          url: 'https://www.linkedin.com/in/thomasjeanneauentrepreneur/',
        },
        foundingDate: '2025',
        sameAs: ['https://github.com/sovrium/sovrium', 'https://www.linkedin.com/company/sovrium/'],
      },
    },
  },
  scripts: {
    inlineScripts: [langSwitchScript, mobileMenuScript],
  },
  sections: [
    // Navigation Bar
    createNavbar('about'),

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
              content: '$t:about.hero.eyebrow',
              props: {
                className:
                  'text-sm uppercase tracking-widest text-sovereignty-accent font-medium mb-6',
              },
            },
            {
              type: 'h1',
              content: '$t:about.hero.title',
              props: {
                className:
                  'text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight bg-gradient-to-r from-sovereignty-accent to-sovereignty-teal bg-clip-text text-transparent overflow-visible',
              },
            },
            {
              type: 'paragraph',
              content: '$t:about.hero.subtitle',
              props: {
                className:
                  'text-base sm:text-lg md:text-xl text-sovereignty-gray-400 max-w-3xl mx-auto mb-8',
              },
            },
            {
              type: 'paragraph',
              content: '$t:about.hero.tagline',
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
              content: '$t:about.mission.title',
              props: {
                className: 'text-2xl sm:text-3xl font-bold text-center mb-8',
              },
            },
            {
              type: 'paragraph',
              content: '$t:about.mission.description',
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
                  content: '$t:about.mission.statement',
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

    // --- Section 3: Our Values ---------------------------------------------
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
              content: '$t:about.values.title',
              props: {
                className: 'text-2xl sm:text-3xl font-bold text-center mb-6',
              },
            },
            {
              type: 'paragraph',
              content: '$t:about.values.subtitle',
              props: {
                className:
                  'text-base sm:text-lg md:text-xl text-sovereignty-gray-400 text-center max-w-3xl mx-auto mb-12 md:mb-16',
              },
            },
            {
              type: 'grid',
              props: { className: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' },
              children: [
                { $ref: 'value-card', vars: { key: 'sovereignty' } },
                { $ref: 'value-card', vars: { key: 'transparency' } },
                { $ref: 'value-card', vars: { key: 'openSource' } },
                { $ref: 'value-card', vars: { key: 'simplicity' } },
                { $ref: 'value-card', vars: { key: 'ownership' } },
                { $ref: 'value-card', vars: { key: 'longTerm' } },
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
              content: '$t:about.principles.title',
              props: {
                className: 'text-2xl sm:text-3xl font-bold text-center mb-6',
              },
            },
            {
              type: 'paragraph',
              content: '$t:about.principles.subtitle',
              props: {
                className:
                  'text-base sm:text-lg md:text-xl text-sovereignty-gray-400 text-center max-w-3xl mx-auto mb-12 md:mb-16',
              },
            },
            {
              type: 'grid',
              props: { className: 'grid grid-cols-1 md:grid-cols-2 gap-6' },
              children: [
                { $ref: 'principle-item', vars: { key: 'configOverCode' } },
                { $ref: 'principle-item', vars: { key: 'minimalDeps' } },
                { $ref: 'principle-item', vars: { key: 'businessFocus' } },
                { $ref: 'principle-item', vars: { key: 'configReuse' } },
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
              content: '$t:about.team.title',
              props: {
                className: 'text-2xl sm:text-3xl font-bold text-center mb-6',
              },
            },
            {
              type: 'paragraph',
              content: '$t:about.team.subtitle',
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
                      'bg-sovereignty-gray-900 border border-sovereignty-gray-800 p-8 sm:p-10 rounded-lg max-w-md w-full text-center hover:border-sovereignty-accent transition-colors duration-300',
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
                      content: '$t:about.team.founder.name',
                      props: {
                        className: 'text-2xl font-bold text-sovereignty-light mb-1',
                      },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:about.team.founder.role',
                      props: {
                        className: 'text-sovereignty-accent font-medium mb-4',
                      },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:about.team.founder.bio',
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
                            href: 'https://github.com/thomas-jeanneau',
                            className:
                              'text-sovereignty-gray-400 hover:text-sovereignty-accent transition-colors duration-150 text-sm',
                            target: '_blank',
                            rel: 'noopener noreferrer',
                          },
                        },
                        {
                          type: 'link',
                          content: 'LinkedIn',
                          props: {
                            href: 'https://www.linkedin.com/in/thomasjeanneauentrepreneur/',
                            className:
                              'text-sovereignty-gray-400 hover:text-sovereignty-accent transition-colors duration-150 text-sm',
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
        className: 'py-16 md:py-24 bg-sovereignty-dark text-sovereignty-light',
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
                  content: '$t:about.cta.title',
                  props: {
                    className: 'text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4',
                  },
                },
                {
                  type: 'paragraph',
                  content: '$t:about.cta.description',
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
                      content: '$t:about.cta.github',
                      props: {
                        href: 'https://github.com/sovrium/sovrium',
                        className:
                          'inline-block bg-white text-sovereignty-accent px-8 py-3 rounded-lg font-semibold hover:bg-sovereignty-gray-100 transition-all duration-200 transform hover:-translate-y-1 text-center',
                        target: '_blank',
                        rel: 'noopener noreferrer',
                      },
                    },
                    {
                      type: 'link',
                      content: '$t:about.cta.partner',
                      props: {
                        href: '$t:about.cta.partner.href',
                        className:
                          'inline-block border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:text-sovereignty-accent transition-all duration-200 text-center',
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

    { component: 'sovrium-badge' },
  ],
}
