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

export const dataDeletion: Page = {
  name: 'data-deletion',
  path: '/data-deletion',
  meta: {
    title: '$t:dataDeletion.meta.title',
    description: '$t:dataDeletion.meta.description',
    canonical: 'https://sovrium.com/data-deletion',
    openGraph: {
      title: '$t:dataDeletion.meta.title',
      description: '$t:dataDeletion.meta.description',
      url: 'https://sovrium.com/data-deletion',
      image: 'https://sovrium.com/logos/sovrium-horizontal-dark.svg',
      siteName: 'Sovrium',
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title: '$t:dataDeletion.meta.title',
      description: '$t:dataDeletion.meta.description',
      image: 'https://sovrium.com/logos/sovrium-horizontal-dark.svg',
    },
    favicons,
  },
  scripts: {
    inlineScripts: [langSwitchScript, mobileMenuScript],
  },
  sections: [
    // Navigation Bar
    navbar,

    // Header
    {
      type: 'section',
      props: {
        className:
          'py-16 md:py-24 bg-gradient-to-b from-sovereignty-dark to-sovereignty-darker text-sovereignty-light',
      },
      children: [
        {
          type: 'container',
          props: { className: 'max-w-4xl mx-auto px-4 sm:px-6 md:px-8' },
          children: [
            {
              type: 'h1',
              content: '$t:dataDeletion.header.title',
              props: { className: 'text-3xl sm:text-4xl md:text-5xl font-bold mb-4' },
            },
            {
              type: 'paragraph',
              content: '$t:dataDeletion.header.lastUpdated',
              props: { className: 'text-sovereignty-gray-400' },
            },
          ],
        },
      ],
    },

    // Content
    {
      type: 'section',
      props: {
        className: 'py-16 md:py-24 bg-sovereignty-darker text-sovereignty-light',
      },
      children: [
        {
          type: 'container',
          props: { className: 'max-w-4xl mx-auto px-4 sm:px-6 md:px-8' },
          children: [
            // Introduction
            {
              type: 'div',
              props: { className: 'mb-8' },
              children: [
                {
                  type: 'paragraph',
                  content: '$t:dataDeletion.intro.p1',
                  props: { className: 'text-sovereignty-light' },
                },
              ],
            },

            // Section 1 - Sovrium Software (Self-Hosted)
            {
              type: 'div',
              props: { className: 'mb-8' },
              children: [
                {
                  type: 'h2',
                  content: '$t:dataDeletion.s1.title',
                  props: {
                    className: 'text-xl sm:text-2xl font-semibold mb-4 text-sovereignty-accent',
                  },
                },
                {
                  type: 'paragraph',
                  content: '$t:dataDeletion.s1.p1',
                  props: { className: 'text-sovereignty-light mb-4' },
                },
                {
                  type: 'paragraph',
                  content: '$t:dataDeletion.s1.p2',
                  props: { className: 'text-sovereignty-light mb-3' },
                },
                {
                  type: 'div',
                  props: { className: 'ml-4 sm:ml-6 space-y-2' },
                  children: [
                    {
                      type: 'paragraph',
                      content: '$t:dataDeletion.s1.item1',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:dataDeletion.s1.item2',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:dataDeletion.s1.item3',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                  ],
                },
              ],
            },

            // Section 2 - Facebook Login / Social Authentication
            {
              type: 'div',
              props: { className: 'mb-8' },
              children: [
                {
                  type: 'h2',
                  content: '$t:dataDeletion.s2.title',
                  props: {
                    className: 'text-xl sm:text-2xl font-semibold mb-4 text-sovereignty-accent',
                  },
                },
                {
                  type: 'paragraph',
                  content: '$t:dataDeletion.s2.p1',
                  props: { className: 'text-sovereignty-light mb-4' },
                },
                {
                  type: 'paragraph',
                  content: '$t:dataDeletion.s2.p2',
                  props: { className: 'text-sovereignty-light mb-3' },
                },
                {
                  type: 'div',
                  props: { className: 'ml-4 sm:ml-6 space-y-2 mb-4' },
                  children: [
                    {
                      type: 'paragraph',
                      content: '$t:dataDeletion.s2.item1',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:dataDeletion.s2.item2',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:dataDeletion.s2.item3',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:dataDeletion.s2.item4',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:dataDeletion.s2.item5',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                  ],
                },
                {
                  type: 'paragraph',
                  content: '$t:dataDeletion.s2.p3',
                  props: { className: 'text-sovereignty-light mb-3' },
                },

                {
                  type: 'h3',
                  content: '$t:dataDeletion.s2.step1.title',
                  props: {
                    className: 'text-lg sm:text-xl font-semibold mb-3 text-sovereignty-teal',
                  },
                },
                {
                  type: 'div',
                  props: { className: 'ml-4 sm:ml-6 space-y-2 mb-4' },
                  children: [
                    {
                      type: 'paragraph',
                      content: '$t:dataDeletion.s2.step1.item1',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:dataDeletion.s2.step1.item2',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:dataDeletion.s2.step1.item3',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:dataDeletion.s2.step1.item4',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                  ],
                },

                {
                  type: 'h3',
                  content: '$t:dataDeletion.s2.step2.title',
                  props: {
                    className: 'text-lg sm:text-xl font-semibold mb-3 text-sovereignty-teal',
                  },
                },
                {
                  type: 'div',
                  props: { className: 'ml-4 sm:ml-6 space-y-2 mb-4' },
                  children: [
                    {
                      type: 'paragraph',
                      content: '$t:dataDeletion.s2.step2.item1',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:dataDeletion.s2.step2.item2',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                  ],
                },

                {
                  type: 'h3',
                  content: '$t:dataDeletion.s2.step3.title',
                  props: {
                    className: 'text-lg sm:text-xl font-semibold mb-3 text-sovereignty-teal',
                  },
                },
                {
                  type: 'paragraph',
                  content: '$t:dataDeletion.s2.step3.p1',
                  props: { className: 'text-sovereignty-light' },
                },
              ],
            },

            // Section 3 - sovrium.com Website
            {
              type: 'div',
              props: { className: 'mb-8' },
              children: [
                {
                  type: 'h2',
                  content: '$t:dataDeletion.s3.title',
                  props: {
                    className: 'text-xl sm:text-2xl font-semibold mb-4 text-sovereignty-accent',
                  },
                },
                {
                  type: 'paragraph',
                  content: '$t:dataDeletion.s3.p1',
                  props: { className: 'text-sovereignty-light' },
                },
              ],
            },

            // Section 4 - Data Deletion Confirmation
            {
              type: 'div',
              props: { className: 'mb-8' },
              children: [
                {
                  type: 'h2',
                  content: '$t:dataDeletion.s4.title',
                  props: {
                    className: 'text-xl sm:text-2xl font-semibold mb-4 text-sovereignty-accent',
                  },
                },
                {
                  type: 'paragraph',
                  content: '$t:dataDeletion.s4.p1',
                  props: { className: 'text-sovereignty-light mb-3' },
                },
                {
                  type: 'div',
                  props: { className: 'ml-4 sm:ml-6 space-y-2' },
                  children: [
                    {
                      type: 'paragraph',
                      content: '$t:dataDeletion.s4.item1',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:dataDeletion.s4.item2',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:dataDeletion.s4.item3',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:dataDeletion.s4.item4',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                  ],
                },
              ],
            },

            // Section 5 - Contact
            {
              type: 'div',
              props: { className: 'mb-8' },
              children: [
                {
                  type: 'h2',
                  content: '$t:dataDeletion.s5.title',
                  props: {
                    className: 'text-xl sm:text-2xl font-semibold mb-4 text-sovereignty-accent',
                  },
                },
                {
                  type: 'paragraph',
                  content: '$t:dataDeletion.s5.p1',
                  props: { className: 'text-sovereignty-light mb-3' },
                },
                {
                  type: 'div',
                  props: { className: 'ml-4 sm:ml-6 space-y-2' },
                  children: [
                    {
                      type: 'paragraph',
                      content: '$t:dataDeletion.s5.item1',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:dataDeletion.s5.item2',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:dataDeletion.s5.item3',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:dataDeletion.s5.item4',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:dataDeletion.s5.item5',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:dataDeletion.s5.item6',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:dataDeletion.s5.item7',
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

    // Footer
    footerI18n,
  ],
}
