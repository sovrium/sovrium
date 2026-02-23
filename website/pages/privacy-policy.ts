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

export const privacyPolicy: Page = {
  name: 'privacy-policy',
  path: '/privacy-policy',
  meta: {
    title: '$t:privacy.meta.title',
    description: '$t:privacy.meta.description',
    canonical: 'https://sovrium.com/privacy-policy',
    openGraph: {
      title: '$t:privacy.meta.title',
      description: '$t:privacy.meta.description',
      url: 'https://sovrium.com/privacy-policy',
      image: 'https://sovrium.com/logos/sovrium-horizontal-dark.svg',
      siteName: 'Sovrium',
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title: '$t:privacy.meta.title',
      description: '$t:privacy.meta.description',
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
              content: '$t:privacy.header.title',
              props: { className: 'text-3xl sm:text-4xl md:text-5xl font-bold mb-4' },
            },
            {
              type: 'paragraph',
              content: '$t:privacy.header.lastUpdated',
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
            // Section 1 - Introduction
            {
              type: 'div',
              props: { className: 'mb-8' },
              children: [
                {
                  type: 'h2',
                  content: '$t:privacy.s1.title',
                  props: {
                    className: 'text-xl sm:text-2xl font-semibold mb-4 text-sovereignty-accent',
                  },
                },
                {
                  type: 'paragraph',
                  content: '$t:privacy.s1.p1',
                  props: { className: 'text-sovereignty-light mb-4' },
                },
                {
                  type: 'paragraph',
                  content: '$t:privacy.s1.p2',
                  props: { className: 'text-sovereignty-light' },
                },
              ],
            },

            // Section 2 - Data Collection
            {
              type: 'div',
              props: { className: 'mb-8' },
              children: [
                {
                  type: 'h2',
                  content: '$t:privacy.s2.title',
                  props: {
                    className: 'text-xl sm:text-2xl font-semibold mb-4 text-sovereignty-accent',
                  },
                },

                {
                  type: 'h3',
                  content: '$t:privacy.s2.analytics.title',
                  props: {
                    className: 'text-lg sm:text-xl font-semibold mb-3 text-sovereignty-teal',
                  },
                },
                {
                  type: 'paragraph',
                  content: '$t:privacy.s2.analytics.p1',
                  props: { className: 'text-sovereignty-light mb-3' },
                },
                {
                  type: 'div',
                  props: { className: 'ml-4 sm:ml-6 space-y-2' },
                  children: [
                    {
                      type: 'paragraph',
                      content: '$t:privacy.s2.analytics.item1',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:privacy.s2.analytics.item2',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:privacy.s2.analytics.item3',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:privacy.s2.analytics.item4',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                  ],
                },

                {
                  type: 'h3',
                  content: '$t:privacy.s2.cookies.title',
                  props: {
                    className: 'text-lg sm:text-xl font-semibold mb-3 mt-6 text-sovereignty-teal',
                  },
                },
                {
                  type: 'paragraph',
                  content: '$t:privacy.s2.cookies.p1',
                  props: { className: 'text-sovereignty-light' },
                },

                {
                  type: 'h3',
                  content: '$t:privacy.s2.selfHosted.title',
                  props: {
                    className: 'text-lg sm:text-xl font-semibold mb-3 mt-6 text-sovereignty-teal',
                  },
                },
                {
                  type: 'paragraph',
                  content: '$t:privacy.s2.selfHosted.p1',
                  props: { className: 'text-sovereignty-light mb-3' },
                },
                {
                  type: 'div',
                  props: { className: 'ml-4 sm:ml-6 space-y-2' },
                  children: [
                    {
                      type: 'paragraph',
                      content: '$t:privacy.s2.selfHosted.item1',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:privacy.s2.selfHosted.item2',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:privacy.s2.selfHosted.item3',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:privacy.s2.selfHosted.item4',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                  ],
                },
                {
                  type: 'paragraph',
                  content: '$t:privacy.s2.selfHosted.note',
                  props: { className: 'text-sovereignty-light mt-3 font-semibold' },
                },

                {
                  type: 'h3',
                  content: '$t:privacy.s2.github.title',
                  props: {
                    className: 'text-lg sm:text-xl font-semibold mb-3 mt-6 text-sovereignty-teal',
                  },
                },
                {
                  type: 'paragraph',
                  content: '$t:privacy.s2.github.p1',
                  props: { className: 'text-sovereignty-light' },
                },

                {
                  type: 'h3',
                  content: '$t:privacy.s2.facebook.title',
                  props: {
                    className: 'text-lg sm:text-xl font-semibold mb-3 mt-6 text-sovereignty-teal',
                  },
                },
                {
                  type: 'paragraph',
                  content: '$t:privacy.s2.facebook.p1',
                  props: { className: 'text-sovereignty-light mb-3' },
                },
                {
                  type: 'div',
                  props: { className: 'ml-4 sm:ml-6 space-y-2' },
                  children: [
                    {
                      type: 'paragraph',
                      content: '$t:privacy.s2.facebook.item1',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:privacy.s2.facebook.item2',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:privacy.s2.facebook.item3',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                  ],
                },
                {
                  type: 'paragraph',
                  content: '$t:privacy.s2.facebook.legal',
                  props: { className: 'text-sovereignty-light mt-3 mb-3' },
                },
                {
                  type: 'paragraph',
                  content: '$t:privacy.s2.facebook.purpose',
                  props: { className: 'text-sovereignty-light mb-3' },
                },
                {
                  type: 'paragraph',
                  content: '$t:privacy.s2.facebook.deletion',
                  props: { className: 'text-sovereignty-light' },
                },
              ],
            },

            // Section 3 - Use of Information
            {
              type: 'div',
              props: { className: 'mb-8' },
              children: [
                {
                  type: 'h2',
                  content: '$t:privacy.s3.title',
                  props: {
                    className: 'text-xl sm:text-2xl font-semibold mb-4 text-sovereignty-accent',
                  },
                },
                {
                  type: 'paragraph',
                  content: '$t:privacy.s3.p1',
                  props: { className: 'text-sovereignty-light mb-3' },
                },
                {
                  type: 'div',
                  props: { className: 'ml-4 sm:ml-6 space-y-2' },
                  children: [
                    {
                      type: 'paragraph',
                      content: '$t:privacy.s3.item1',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:privacy.s3.item2',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:privacy.s3.item3',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:privacy.s3.item4',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                  ],
                },

                {
                  type: 'h3',
                  content: '$t:privacy.s3.retention.title',
                  props: {
                    className: 'text-lg sm:text-xl font-semibold mb-3 mt-6 text-sovereignty-teal',
                  },
                },
                {
                  type: 'div',
                  props: { className: 'ml-4 sm:ml-6 space-y-2' },
                  children: [
                    {
                      type: 'paragraph',
                      content: '$t:privacy.s3.retention.item1',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:privacy.s3.retention.item2',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:privacy.s3.retention.item3',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                  ],
                },
              ],
            },

            // Section 4 - Third-Party Services
            {
              type: 'div',
              props: { className: 'mb-8' },
              children: [
                {
                  type: 'h2',
                  content: '$t:privacy.s4.title',
                  props: {
                    className: 'text-xl sm:text-2xl font-semibold mb-4 text-sovereignty-accent',
                  },
                },
                {
                  type: 'paragraph',
                  content: '$t:privacy.s4.p1',
                  props: { className: 'text-sovereignty-light mb-3' },
                },
                {
                  type: 'div',
                  props: { className: 'ml-4 sm:ml-6 space-y-2' },
                  children: [
                    {
                      type: 'paragraph',
                      content: '$t:privacy.s4.item1',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:privacy.s4.item2',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:privacy.s4.item3',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:privacy.s4.item4',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                  ],
                },
                {
                  type: 'paragraph',
                  content: '$t:privacy.s4.note',
                  props: { className: 'text-sovereignty-light mt-3' },
                },

                {
                  type: 'h3',
                  content: '$t:privacy.s4.sharing.title',
                  props: {
                    className: 'text-lg sm:text-xl font-semibold mb-3 mt-6 text-sovereignty-teal',
                  },
                },
                {
                  type: 'paragraph',
                  content: '$t:privacy.s4.sharing.p1',
                  props: { className: 'text-sovereignty-light mb-3' },
                },
                {
                  type: 'div',
                  props: { className: 'ml-4 sm:ml-6 space-y-2' },
                  children: [
                    {
                      type: 'paragraph',
                      content: '$t:privacy.s4.sharing.item1',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:privacy.s4.sharing.item2',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:privacy.s4.sharing.item3',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                  ],
                },
              ],
            },

            // Section 5 - International Data Transfers
            {
              type: 'div',
              props: { className: 'mb-8' },
              children: [
                {
                  type: 'h2',
                  content: '$t:privacy.s5.title',
                  props: {
                    className: 'text-xl sm:text-2xl font-semibold mb-4 text-sovereignty-accent',
                  },
                },
                {
                  type: 'paragraph',
                  content: '$t:privacy.s5.p1',
                  props: { className: 'text-sovereignty-light mb-4' },
                },
                {
                  type: 'paragraph',
                  content: '$t:privacy.s5.p2',
                  props: { className: 'text-sovereignty-light mb-4' },
                },
                {
                  type: 'paragraph',
                  content: '$t:privacy.s5.p3',
                  props: { className: 'text-sovereignty-light' },
                },
              ],
            },

            // Section 6 - Your Rights
            {
              type: 'div',
              props: { className: 'mb-8' },
              children: [
                {
                  type: 'h2',
                  content: '$t:privacy.s6.title',
                  props: {
                    className: 'text-xl sm:text-2xl font-semibold mb-4 text-sovereignty-accent',
                  },
                },
                {
                  type: 'paragraph',
                  content: '$t:privacy.s6.p1',
                  props: { className: 'text-sovereignty-light mb-3' },
                },
                {
                  type: 'div',
                  props: { className: 'ml-4 sm:ml-6 space-y-2' },
                  children: [
                    {
                      type: 'paragraph',
                      content: '$t:privacy.s6.item1',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:privacy.s6.item2',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:privacy.s6.item3',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:privacy.s6.item4',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:privacy.s6.item5',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                  ],
                },
                {
                  type: 'paragraph',
                  content: '$t:privacy.s6.contact',
                  props: { className: 'text-sovereignty-light mt-3' },
                },
              ],
            },

            // Section 7 - Security
            {
              type: 'div',
              props: { className: 'mb-8' },
              children: [
                {
                  type: 'h2',
                  content: '$t:privacy.s7.title',
                  props: {
                    className: 'text-xl sm:text-2xl font-semibold mb-4 text-sovereignty-accent',
                  },
                },
                {
                  type: 'paragraph',
                  content: '$t:privacy.s7.p1',
                  props: { className: 'text-sovereignty-light' },
                },
              ],
            },

            // Section 8 - Children's Privacy
            {
              type: 'div',
              props: { className: 'mb-8' },
              children: [
                {
                  type: 'h2',
                  content: '$t:privacy.s8.title',
                  props: {
                    className: 'text-xl sm:text-2xl font-semibold mb-4 text-sovereignty-accent',
                  },
                },
                {
                  type: 'paragraph',
                  content: '$t:privacy.s8.p1',
                  props: { className: 'text-sovereignty-light' },
                },
              ],
            },

            // Section 9 - Changes to This Policy
            {
              type: 'div',
              props: { className: 'mb-8' },
              children: [
                {
                  type: 'h2',
                  content: '$t:privacy.s9.title',
                  props: {
                    className: 'text-xl sm:text-2xl font-semibold mb-4 text-sovereignty-accent',
                  },
                },
                {
                  type: 'paragraph',
                  content: '$t:privacy.s9.p1',
                  props: { className: 'text-sovereignty-light' },
                },
              ],
            },

            // Section 10 - Contact Information
            {
              type: 'div',
              props: { className: 'mb-8' },
              children: [
                {
                  type: 'h2',
                  content: '$t:privacy.s10.title',
                  props: {
                    className: 'text-xl sm:text-2xl font-semibold mb-4 text-sovereignty-accent',
                  },
                },
                {
                  type: 'paragraph',
                  content: '$t:privacy.s10.intro',
                  props: { className: 'text-sovereignty-light mb-3' },
                },
                {
                  type: 'div',
                  props: { className: 'ml-4 sm:ml-6 space-y-2' },
                  children: [
                    {
                      type: 'paragraph',
                      content: '$t:privacy.s10.item1',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:privacy.s10.item2',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:privacy.s10.item3',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:privacy.s10.item4',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:privacy.s10.item5',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:privacy.s10.item6',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:privacy.s10.item7',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:privacy.s10.item8',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:privacy.s10.item9',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                  ],
                },
              ],
            },

            // Section 11 - Data Protection
            {
              type: 'div',
              props: { className: 'mb-8' },
              children: [
                {
                  type: 'h2',
                  content: '$t:privacy.s11.title',
                  props: {
                    className: 'text-xl sm:text-2xl font-semibold mb-4 text-sovereignty-accent',
                  },
                },
                {
                  type: 'paragraph',
                  content: '$t:privacy.s11.p1',
                  props: { className: 'text-sovereignty-light' },
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
