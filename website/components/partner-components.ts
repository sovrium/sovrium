/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { ComponentTemplate } from '@/index'

// ─── testimonial-card: Partner testimonial with quote, author, role ────────
// Used in partners.ts testimonials section (4 cards)
// vars: { index: 1 | 2 | 3 | 4 }
export const testimonialCard: ComponentTemplate = {
  name: 'testimonial-card',
  type: 'card',
  props: {
    className:
      'bg-sovereignty-gray-900 border border-sovereignty-gray-800 p-8 rounded-lg hover:border-sovereignty-accent transition-colors duration-300',
  },
  children: [
    {
      type: 'div',
      props: { className: 'text-sovereignty-accent text-4xl mb-4' },
      content: '\u201C',
    },
    {
      type: 'paragraph',
      content: '$t:partners.testimonials.$index.quote',
      props: { className: 'text-sovereignty-gray-300 italic mb-6 leading-relaxed' },
    },
    {
      type: 'div',
      props: {
        className: 'border-t border-sovereignty-gray-800 pt-4 flex items-center gap-3',
      },
      children: [
        {
          type: 'div',
          children: [
            {
              type: 'paragraph',
              content: '$t:partners.testimonials.$index.author',
              props: { className: 'font-semibold text-sovereignty-light' },
            },
            {
              type: 'paragraph',
              content: '$t:partners.testimonials.$index.role',
              props: { className: 'text-sm text-sovereignty-gray-400' },
            },
          ],
        },
      ],
    },
  ],
}

// ─── process-step: Numbered process step with title and description ────────
// Used in partners.ts process section (5 steps)
// vars: { num: 1 | 2 | 3 | 4 | 5 }
export const processStep: ComponentTemplate = {
  name: 'process-step',
  type: 'div',
  props: { className: 'text-center' },
  children: [
    {
      type: 'div',
      props: {
        className:
          'bg-sovereignty-accent text-white w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-xl',
      },
      content: '$num',
    },
    {
      type: 'h4',
      content: '$t:partners.process.step$num.title',
      props: { className: 'font-semibold mb-2' },
    },
    {
      type: 'paragraph',
      content: '$t:partners.process.step$num.description',
      props: { className: 'text-sm text-sovereignty-gray-400' },
    },
  ],
}

// ─── methodology-card: Methodology principle with title and description ────
// Used in partners.ts methodology section (10 cards)
// vars: { num: 1..10 }
export const methodologyCard: ComponentTemplate = {
  name: 'methodology-card',
  type: 'card',
  props: {
    className:
      'bg-sovereignty-gray-900 border border-sovereignty-gray-800 p-6 rounded-lg hover:border-sovereignty-accent transition-colors duration-300',
  },
  children: [
    {
      type: 'h4',
      content: '$t:partners.methodology.$num.title',
      props: { className: 'text-lg font-semibold mb-2 text-sovereignty-light' },
    },
    {
      type: 'paragraph',
      content: '$t:partners.methodology.$num.description',
      props: { className: 'text-sm text-sovereignty-gray-400' },
    },
  ],
}

// ─── stat-card: Statistics card with number, title, description ────────────
// Used in partners.ts stats section (3 cards)
// vars: { key: 'clients' | 'tools' | 'hours' }
export const statCard: ComponentTemplate = {
  name: 'stat-card',
  type: 'card',
  props: {
    className:
      'bg-sovereignty-gray-900 border border-sovereignty-gray-800 p-8 rounded-lg text-center hover:border-sovereignty-accent transition-colors duration-300',
  },
  children: [
    {
      type: 'h3',
      content: '$t:partners.stats.$key.stat',
      props: { className: 'text-4xl sm:text-5xl font-bold text-sovereignty-accent mb-2' },
    },
    {
      type: 'h4',
      content: '$t:partners.stats.$key.title',
      props: { className: 'text-xl font-semibold mb-3' },
    },
    {
      type: 'paragraph',
      content: '$t:partners.stats.$key.description',
      props: { className: 'text-sovereignty-gray-400' },
    },
  ],
}

// ─── marquee-logo-item: Client logo for marquee/carousel ──────────────────
// Used in partners.ts trusted-by section (7 logos, duplicated for infinite scroll)
// vars: { src: '/logos/escp.png', name: 'ESCP Business School' }
export const marqueeLogoItem: ComponentTemplate = {
  name: 'marquee-logo-item',
  type: 'div',
  props: {
    className:
      'flex-shrink-0 flex items-center justify-center h-16 w-40 mx-6 opacity-60 hover:opacity-100 transition-all duration-300',
  },
  children: [
    {
      type: 'image',
      props: {
        src: '$src',
        alt: '$name',
        className: 'h-full w-full object-contain brightness-0 invert',
      },
    },
  ],
}
