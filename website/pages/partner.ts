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
import type { Page } from '@/index'

// ─── Static data for marquee logos (duplicated for infinite scroll effect) ─────

const allClientLogos: ReadonlyArray<{ readonly name: string; readonly src: string }> = [
  { name: 'ESCP Business School', src: '/logos/escp.png' },
  { name: 'La Table de Cana', src: '/logos/tablecana.png' },
  { name: 'TH1', src: '/logos/th1.png' },
  { name: 'Agora Store', src: '/logos/agorastore.png' },
  { name: 'Capital PV', src: '/logos/capitalpv.svg' },
  { name: 'Le Beau Sourire', src: '/logos/lebeausourire.png' },
  { name: 'EDL Energies de Loire', src: '/logos/edl.png' },
]

const marqueeLogos = [...allClientLogos, ...allClientLogos].map((logo) => ({
  $ref: 'marquee-logo-item' as const,
  vars: { src: logo.src, name: logo.name },
}))

// ─── Page ───────────────────────────────────────────────────────────────────────

export const partner: Page = {
  name: 'partner',
  path: '/partner',
  meta: {
    title: '$t:partner.meta.title',
    description: '$t:partner.meta.description',
    keywords:
      'sovrium partner, consulting, implementation, internal tools, process optimization, digital transformation',
    author: 'ESSENTIAL SERVICES',
    canonical: 'https://sovrium.com/partner',
    favicons,
    openGraph: {
      title: '$t:partner.meta.og.title',
      description: '$t:partner.meta.og.description',
      type: 'website',
      url: 'https://sovrium.com/partner',
      image: 'https://sovrium.com/logos/sovrium-horizontal-dark.svg',
      siteName: 'Sovrium',
    },
    twitter: {
      card: 'summary_large_image',
      title: '$t:partner.meta.twitter.title',
      description: '$t:partner.meta.twitter.description',
      image: 'https://sovrium.com/logos/sovrium-horizontal-dark.svg',
    },
  },
  scripts: {
    inlineScripts: [langSwitchScript, mobileMenuScript, searchScript],
  },
  sections: [
    // Navigation Bar
    createNavbar('partner'),

    // Search Modal
    createSearchModal(),

    // ─── Section 1: Hero ────────────────────────────────────────────────────
    {
      type: 'section',
      props: {
        className:
          'py-24 md:py-32 flex items-center justify-center bg-gradient-to-b from-sovereignty-dark to-sovereignty-darker text-sovereignty-light',
      },
      children: [
        {
          type: 'container',
          props: { className: 'max-w-6xl mx-auto px-4 sm:px-6 md:px-8 text-center' },
          children: [
            {
              type: 'h1',
              content: '$t:partner.hero.title',
              props: {
                className:
                  'text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight bg-gradient-to-r from-sovereignty-accent to-sovereignty-teal bg-clip-text text-transparent overflow-visible',
              },
            },
            {
              type: 'paragraph',
              content: '$t:partner.hero.subtitle',
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
                  content: '$t:partner.hero.cta.primary',
                  props: {
                    href: '#waitlist',
                    className:
                      'inline-block bg-sovereignty-accent hover:bg-sovereignty-accent-hover text-white px-6 sm:px-8 py-3 sm:py-4 rounded-lg font-semibold transition-all duration-200 transform hover:-translate-y-1 text-center',
                  },
                },
                {
                  type: 'link',
                  content: '$t:partner.hero.cta.secondary',
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
              content: '$t:partner.trust.title',
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
              content: '$t:partner.stats.title',
              props: {
                className: 'text-2xl sm:text-3xl font-bold text-center mb-12 md:mb-16',
              },
            },
            {
              type: 'grid',
              props: { className: 'grid grid-cols-1 md:grid-cols-3 gap-8' },
              children: [
                { $ref: 'stat-card', vars: { key: 'clients' } },
                { $ref: 'stat-card', vars: { key: 'tools' } },
                { $ref: 'stat-card', vars: { key: 'hours' } },
              ],
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
              content: '$t:partner.process.title',
              props: {
                className: 'text-2xl sm:text-3xl font-bold text-center mb-6',
              },
            },
            {
              type: 'paragraph',
              content: '$t:partner.process.subtitle',
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
                { $ref: 'process-step', vars: { num: 1 } },
                { $ref: 'process-step', vars: { num: 2 } },
                { $ref: 'process-step', vars: { num: 3 } },
                { $ref: 'process-step', vars: { num: 4 } },
                { $ref: 'process-step', vars: { num: 5 } },
              ],
            },
          ],
        },
      ],
    },

    // ─── Section 5: Our Methodology (5 principles) ──────────────────────────
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
              content: '$t:partner.methodology.title',
              props: {
                className: 'text-2xl sm:text-3xl font-bold text-center mb-6',
              },
            },
            {
              type: 'paragraph',
              content: '$t:partner.methodology.subtitle',
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
                { $ref: 'methodology-card', vars: { num: 1 } },
                { $ref: 'methodology-card', vars: { num: 2 } },
                { $ref: 'methodology-card', vars: { num: 3 } },
                { $ref: 'methodology-card', vars: { num: 4 } },
                { $ref: 'methodology-card', vars: { num: 5 } },
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
              content: '$t:partner.testimonials.title',
              props: {
                className: 'text-2xl sm:text-3xl font-bold text-center mb-12 md:mb-16',
              },
            },
            {
              type: 'grid',
              props: { className: 'grid grid-cols-1 md:grid-cols-2 gap-8' },
              children: [
                { $ref: 'testimonial-card', vars: { index: 1 } },
                { $ref: 'testimonial-card', vars: { index: 2 } },
                { $ref: 'testimonial-card', vars: { index: 3 } },
                { $ref: 'testimonial-card', vars: { index: 4 } },
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
                  content: '$t:partner.waitlist.title',
                  props: {
                    className: 'text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4',
                  },
                },
                {
                  type: 'paragraph',
                  content: '$t:partner.waitlist.description',
                  props: {
                    className: 'text-lg text-white/90 max-w-2xl mx-auto mb-8',
                  },
                },
                {
                  type: 'link',
                  content: '$t:partner.waitlist.cta',
                  props: {
                    href: '$t:partner.waitlist.email.href',
                    className:
                      'inline-block bg-white text-sovereignty-accent px-8 py-3 rounded-lg font-semibold hover:bg-sovereignty-gray-100 transition-all duration-200 transform hover:-translate-y-1',
                  },
                },
                {
                  type: 'paragraph',
                  content: '$t:partner.waitlist.email.label',
                  props: {
                    className: 'text-white/70 text-sm mt-4',
                  },
                },
                {
                  type: 'link',
                  content: '$t:partner.waitlist.email',
                  props: {
                    href: '$t:partner.waitlist.email.href',
                    className: 'text-white font-medium hover:underline',
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

    { component: 'sovrium-badge' },
  ],
}
