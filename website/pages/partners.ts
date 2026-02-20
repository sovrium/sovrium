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

// ─── Helpers ────────────────────────────────────────────────────────────────────

const testimonialCard = (index: number) => ({
  type: 'card' as const,
  props: {
    className:
      'bg-sovereignty-gray-900 border border-sovereignty-gray-800 p-8 rounded-lg hover:border-sovereignty-accent transition-colors duration-300',
  },
  children: [
    {
      type: 'div' as const,
      props: { className: 'text-sovereignty-accent text-4xl mb-4' },
      content: '\u201C',
    },
    {
      type: 'paragraph' as const,
      content: `$t:partners.testimonials.${index}.quote`,
      props: {
        className: 'text-sovereignty-gray-300 italic mb-6 leading-relaxed',
      },
    },
    {
      type: 'div' as const,
      props: {
        className: 'border-t border-sovereignty-gray-800 pt-4 flex items-center gap-3',
      },
      children: [
        {
          type: 'div' as const,
          children: [
            {
              type: 'paragraph' as const,
              content: `$t:partners.testimonials.${index}.author`,
              props: { className: 'font-semibold text-sovereignty-light' },
            },
            {
              type: 'paragraph' as const,
              content: `$t:partners.testimonials.${index}.role`,
              props: { className: 'text-sm text-sovereignty-gray-400' },
            },
          ],
        },
      ],
    },
  ],
})

const processStep = (num: number) => ({
  type: 'div' as const,
  props: { className: 'text-center' },
  children: [
    {
      type: 'div' as const,
      props: {
        className:
          'bg-sovereignty-accent text-white w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-xl',
      },
      content: `${num}`,
    },
    {
      type: 'h4' as const,
      content: `$t:partners.process.step${num}.title`,
      props: { className: 'font-semibold mb-2' },
    },
    {
      type: 'paragraph' as const,
      content: `$t:partners.process.step${num}.description`,
      props: { className: 'text-sm text-sovereignty-gray-400' },
    },
  ],
})

const methodologyCard = (num: number) => ({
  type: 'card' as const,
  props: {
    className:
      'bg-sovereignty-gray-900 border border-sovereignty-gray-800 p-6 rounded-lg hover:border-sovereignty-accent transition-colors duration-300',
  },
  children: [
    {
      type: 'h4' as const,
      content: `$t:partners.methodology.${num}.title`,
      props: { className: 'text-lg font-semibold mb-2 text-sovereignty-light' },
    },
    {
      type: 'paragraph' as const,
      content: `$t:partners.methodology.${num}.description`,
      props: { className: 'text-sm text-sovereignty-gray-400' },
    },
  ],
})

const statCard = (key: string) => ({
  type: 'card' as const,
  props: {
    className:
      'bg-sovereignty-gray-900 border border-sovereignty-gray-800 p-8 rounded-lg text-center hover:border-sovereignty-accent transition-colors duration-300',
  },
  children: [
    {
      type: 'h3' as const,
      content: `$t:partners.stats.${key}.stat`,
      props: {
        className: 'text-4xl sm:text-5xl font-bold text-sovereignty-accent mb-2',
      },
    },
    {
      type: 'h4' as const,
      content: `$t:partners.stats.${key}.title`,
      props: { className: 'text-xl font-semibold mb-3' },
    },
    {
      type: 'paragraph' as const,
      content: `$t:partners.stats.${key}.description`,
      props: { className: 'text-sovereignty-gray-400' },
    },
  ],
})

const allClientLogos: ReadonlyArray<{ readonly name: string; readonly src: string }> = [
  { name: 'ESCP Business School', src: '/logos/escp.png' },
  { name: 'La Table de Cana', src: '/logos/tablecana.png' },
  { name: 'TH1', src: '/logos/th1.png' },
  { name: 'Agora Store', src: '/logos/agorastore.png' },
  { name: 'Capital PV', src: '/logos/capitalpv.svg' },
  { name: 'Le Beau Sourire', src: '/logos/lebeausourire.png' },
  { name: 'EDL Energies de Loire', src: '/logos/edl.png' },
]

const marqueeLogoItem = (logo: { readonly name: string; readonly src: string }) => ({
  type: 'div' as const,
  props: {
    className:
      'flex-shrink-0 flex items-center justify-center h-16 w-40 mx-6 opacity-60 hover:opacity-100 transition-all duration-300',
  },
  children: [
    {
      type: 'image' as const,
      props: {
        src: logo.src,
        alt: logo.name,
        className: 'h-full w-full object-contain brightness-0 invert',
      },
    },
  ],
})

// Duplicate logos for seamless infinite scroll
const marqueeLogos = [...allClientLogos, ...allClientLogos].map(marqueeLogoItem)

// ─── Page ───────────────────────────────────────────────────────────────────────

export const partners: Page = {
  name: 'partners',
  path: '/partners',
  meta: {
    title: '$t:partners.meta.title',
    description: '$t:partners.meta.description',
    keywords:
      'sovrium partner, consulting, implementation, internal tools, process optimization, digital transformation',
    author: 'ESSENTIAL SERVICES',
    canonical: 'https://sovrium.com/partners',
    favicons,
    openGraph: {
      title: '$t:partners.meta.og.title',
      description: '$t:partners.meta.og.description',
      type: 'website',
      url: 'https://sovrium.com/partners',
      image: 'https://sovrium.com/og-image.png',
      siteName: 'Sovrium',
    },
    twitter: {
      card: 'summary_large_image',
      title: '$t:partners.meta.twitter.title',
      description: '$t:partners.meta.twitter.description',
      image: 'https://sovrium.com/twitter-card.png',
    },
  },
  sections: [
    // Navigation Bar
    navbar,

    // ─── Section 1: Hero ────────────────────────────────────────────────────
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
              content: '$t:partners.hero.title',
              props: {
                className:
                  'text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight bg-gradient-to-r from-sovereignty-accent to-sovereignty-teal bg-clip-text text-transparent overflow-visible',
              },
            },
            {
              type: 'paragraph',
              content: '$t:partners.hero.subtitle',
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
                  content: '$t:partners.hero.cta.primary',
                  props: {
                    href: '#waitlist',
                    className:
                      'inline-block bg-sovereignty-accent hover:bg-sovereignty-accent-hover text-white px-6 sm:px-8 py-3 sm:py-4 rounded-lg font-semibold transition-all duration-200 transform hover:-translate-y-1 text-center',
                  },
                },
                {
                  type: 'link',
                  content: '$t:partners.hero.cta.secondary',
                  props: {
                    href: '#methodology',
                    className:
                      'inline-block border-2 border-sovereignty-accent text-sovereignty-accent px-6 sm:px-8 py-3 sm:py-4 rounded-lg font-semibold hover:bg-sovereignty-accent hover:text-white transition-all duration-200 text-center',
                  },
                },
              ],
            },
          ],
        },
      ],
    },

    // ─── Section 2: Trusted By (Marquee) ──────────────────────────────────
    {
      type: 'section',
      props: {
        className: 'py-16 md:py-24 bg-sovereignty-darker text-sovereignty-light',
        id: 'trust',
      },
      children: [
        {
          type: 'container',
          props: { className: 'max-w-6xl mx-auto px-4 sm:px-6 md:px-8 text-center' },
          children: [
            {
              type: 'paragraph',
              content: '$t:partners.trust.title',
              props: {
                className:
                  'text-sm uppercase tracking-widest text-sovereignty-gray-500 font-medium mb-8',
              },
            },
          ],
        },
        // Marquee container with gradient fade edges and overflow hidden
        {
          type: 'div',
          props: {
            className: 'relative overflow-hidden',
            style:
              'mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent); -webkit-mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);',
          },
          children: [
            {
              type: 'div',
              props: {
                className: 'flex items-center py-4',
                style: 'animation: marqueescroll 35s linear infinite; width: max-content;',
              },
              children: marqueeLogos,
            },
          ],
        },
      ],
    },

    // ─── Section 3: Stats ───────────────────────────────────────────────────
    {
      type: 'section',
      props: {
        className: 'py-16 md:py-24 bg-sovereignty-darker text-sovereignty-light',
        id: 'stats',
      },
      children: [
        {
          type: 'container',
          props: { className: 'max-w-6xl mx-auto px-4 sm:px-6 md:px-8' },
          children: [
            {
              type: 'h2',
              content: '$t:partners.stats.title',
              props: {
                className: 'text-2xl sm:text-3xl font-bold text-center mb-12 md:mb-16',
              },
            },
            {
              type: 'grid',
              props: { className: 'grid grid-cols-1 md:grid-cols-3 gap-8' },
              children: [statCard('clients'), statCard('tools'), statCard('hours')],
            },
          ],
        },
      ],
    },

    // ─── Section 4: Our Process (5 steps) ───────────────────────────────────
    {
      type: 'section',
      props: {
        className: 'py-16 md:py-24 bg-sovereignty-dark text-sovereignty-light',
        id: 'process',
      },
      children: [
        {
          type: 'container',
          props: { className: 'max-w-6xl mx-auto px-4 sm:px-6 md:px-8' },
          children: [
            {
              type: 'h2',
              content: '$t:partners.process.title',
              props: {
                className: 'text-2xl sm:text-3xl font-bold text-center mb-6',
              },
            },
            {
              type: 'paragraph',
              content: '$t:partners.process.subtitle',
              props: {
                className:
                  'text-base sm:text-lg md:text-xl text-sovereignty-gray-400 text-center max-w-3xl mx-auto mb-12 md:mb-16',
              },
            },
            {
              type: 'div',
              props: {
                className: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 md:gap-4',
              },
              children: [
                processStep(1),
                processStep(2),
                processStep(3),
                processStep(4),
                processStep(5),
              ],
            },
          ],
        },
      ],
    },

    // ─── Section 5: Our Methodology (10 principles) ─────────────────────────
    {
      type: 'section',
      props: {
        className: 'py-16 md:py-24 bg-sovereignty-darker text-sovereignty-light',
        id: 'methodology',
      },
      children: [
        {
          type: 'container',
          props: { className: 'max-w-6xl mx-auto px-4 sm:px-6 md:px-8' },
          children: [
            {
              type: 'h2',
              content: '$t:partners.methodology.title',
              props: {
                className: 'text-2xl sm:text-3xl font-bold text-center mb-6',
              },
            },
            {
              type: 'paragraph',
              content: '$t:partners.methodology.subtitle',
              props: {
                className:
                  'text-base sm:text-lg md:text-xl text-sovereignty-gray-400 text-center max-w-3xl mx-auto mb-12 md:mb-16',
              },
            },
            {
              type: 'grid',
              props: {
                className: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6',
              },
              children: [
                methodologyCard(1),
                methodologyCard(2),
                methodologyCard(3),
                methodologyCard(4),
                methodologyCard(5),
                methodologyCard(6),
                methodologyCard(7),
                methodologyCard(8),
                methodologyCard(9),
                methodologyCard(10),
              ],
            },
          ],
        },
      ],
    },

    // ─── Section 6: Testimonials (4 real) ───────────────────────────────────
    {
      type: 'section',
      props: {
        className: 'py-16 md:py-24 bg-sovereignty-dark text-sovereignty-light',
        id: 'testimonials',
      },
      children: [
        {
          type: 'container',
          props: { className: 'max-w-6xl mx-auto px-4 sm:px-6 md:px-8' },
          children: [
            {
              type: 'h2',
              content: '$t:partners.testimonials.title',
              props: {
                className: 'text-2xl sm:text-3xl font-bold text-center mb-12 md:mb-16',
              },
            },
            {
              type: 'grid',
              props: { className: 'grid grid-cols-1 md:grid-cols-2 gap-8' },
              children: [
                testimonialCard(1),
                testimonialCard(2),
                testimonialCard(3),
                testimonialCard(4),
              ],
            },
          ],
        },
      ],
    },

    // ─── Section 7: Waitlist CTA ────────────────────────────────────────────
    {
      type: 'section',
      props: {
        className: 'py-16 md:py-24 bg-sovereignty-darker text-sovereignty-light',
        id: 'waitlist',
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
                  content: '$t:partners.waitlist.title',
                  props: {
                    className: 'text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4',
                  },
                },
                {
                  type: 'paragraph',
                  content: '$t:partners.waitlist.description',
                  props: {
                    className: 'text-lg text-white/90 max-w-2xl mx-auto mb-8',
                  },
                },
                {
                  type: 'link',
                  content: '$t:partners.waitlist.cta',
                  props: {
                    href: 'https://latechforce.notion.site/1609911026ec807e9a17d1610e198511',
                    className:
                      'inline-block bg-white text-sovereignty-accent px-8 py-3 rounded-lg font-semibold hover:bg-sovereignty-gray-100 transition-all duration-200 transform hover:-translate-y-1',
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

    // ─── Section 8: Footer ───────────────────────────────────────────────────
    footerI18n,

    // ─── Built with Sovrium Badge (Fixed bottom-right) ────────────────────────
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
              'flex items-center gap-2 bg-sovereignty-gray-900 hover:bg-sovereignty-gray-800 border border-sovereignty-gray-700 hover:border-sovereignty-accent text-sovereignty-gray-400 hover:text-sovereignty-accent px-3 py-2 rounded-lg text-xs font-medium transition-all duration-300 shadow-lg',
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
