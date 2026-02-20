/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { favicons } from './favicons'
import { footerI18n } from './footer'
import { langSwitchScript, navbar } from './navbar'
import type { Page } from '@/index'

export const termsOfService: Page = {
  name: 'terms-of-service',
  path: '/terms-of-service',
  meta: {
    title: '$t:terms.meta.title',
    description: '$t:terms.meta.description',
    canonical: 'https://sovrium.com/terms-of-service',
    openGraph: {
      title: '$t:terms.meta.og.title',
      description: '$t:terms.meta.og.description',
      url: 'https://sovrium.com/terms-of-service',
      image: 'https://sovrium.com/logos/sovrium-horizontal-dark.svg',
      siteName: 'Sovrium',
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title: '$t:terms.meta.twitter.title',
      description: '$t:terms.meta.twitter.description',
      image: 'https://sovrium.com/logos/sovrium-horizontal-dark.svg',
    },
    favicons,
  },
  scripts: {
    inlineScripts: [langSwitchScript],
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
              content: '$t:terms.header.title',
              props: { className: 'text-3xl sm:text-4xl md:text-5xl font-bold mb-4' },
            },
            {
              type: 'paragraph',
              content: '$t:terms.header.lastUpdated',
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
            // Section 1 - Agreement
            {
              type: 'div',
              props: { className: 'mb-8' },
              children: [
                {
                  type: 'h2',
                  content: '$t:terms.s1.title',
                  props: {
                    className: 'text-xl sm:text-2xl font-semibold mb-4 text-sovereignty-accent',
                  },
                },
                {
                  type: 'paragraph',
                  content: '$t:terms.s1.p1',
                  props: { className: 'text-sovereignty-light' },
                },
              ],
            },

            // Section 2 - License
            {
              type: 'div',
              props: { className: 'mb-8' },
              children: [
                {
                  type: 'h2',
                  content: '$t:terms.s2.title',
                  props: {
                    className: 'text-xl sm:text-2xl font-semibold mb-4 text-sovereignty-accent',
                  },
                },
                {
                  type: 'paragraph',
                  content: '$t:terms.s2.p1',
                  props: { className: 'text-sovereignty-light mb-4' },
                },

                {
                  type: 'h3',
                  content: '$t:terms.s2.permitted.title',
                  props: {
                    className: 'text-lg sm:text-xl font-semibold mb-3 text-sovereignty-teal',
                  },
                },
                {
                  type: 'paragraph',
                  content: '$t:terms.s2.permitted.intro',
                  props: { className: 'text-sovereignty-light mb-3' },
                },
                {
                  type: 'div',
                  props: { className: 'ml-4 sm:ml-6 space-y-2' },
                  children: [
                    {
                      type: 'paragraph',
                      content: '$t:terms.s2.permitted.item1',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:terms.s2.permitted.item2',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:terms.s2.permitted.item3',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:terms.s2.permitted.item4',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:terms.s2.permitted.item5',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                  ],
                },

                {
                  type: 'h3',
                  content: '$t:terms.s2.prohibited.title',
                  props: {
                    className: 'text-lg sm:text-xl font-semibold mb-3 mt-6 text-sovereignty-teal',
                  },
                },
                {
                  type: 'paragraph',
                  content: '$t:terms.s2.prohibited.intro',
                  props: { className: 'text-sovereignty-light mb-3' },
                },
                {
                  type: 'div',
                  props: { className: 'ml-4 sm:ml-6 space-y-2' },
                  children: [
                    {
                      type: 'paragraph',
                      content: '$t:terms.s2.prohibited.item1',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:terms.s2.prohibited.item2',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:terms.s2.prohibited.item3',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:terms.s2.prohibited.item4',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                  ],
                },

                {
                  type: 'h3',
                  content: '$t:terms.s2.changeDate.title',
                  props: {
                    className: 'text-lg sm:text-xl font-semibold mb-3 mt-6 text-sovereignty-teal',
                  },
                },
                {
                  type: 'paragraph',
                  content: '$t:terms.s2.changeDate.p1',
                  props: { className: 'text-sovereignty-light font-semibold' },
                },

                {
                  type: 'h3',
                  content: '$t:terms.s2.commercial.title',
                  props: {
                    className: 'text-lg sm:text-xl font-semibold mb-3 mt-6 text-sovereignty-teal',
                  },
                },
                {
                  type: 'paragraph',
                  content: '$t:terms.s2.commercial.p1',
                  props: { className: 'text-sovereignty-light' },
                },
              ],
            },

            // Section 3 - Trademark
            {
              type: 'div',
              props: { className: 'mb-8' },
              children: [
                {
                  type: 'h2',
                  content: '$t:terms.s3.title',
                  props: {
                    className: 'text-xl sm:text-2xl font-semibold mb-4 text-sovereignty-accent',
                  },
                },
                {
                  type: 'paragraph',
                  content: '$t:terms.s3.p1',
                  props: { className: 'text-sovereignty-light mb-3' },
                },
                {
                  type: 'paragraph',
                  content: '$t:terms.s3.p2',
                  props: { className: 'text-sovereignty-light mb-3' },
                },
                {
                  type: 'div',
                  props: { className: 'ml-4 sm:ml-6 mb-4' },
                  children: [
                    {
                      type: 'link',
                      content: 'https://data.inpi.fr/marques/FR5200287',
                      props: {
                        href: 'https://data.inpi.fr/marques/FR5200287',
                        className:
                          'text-sovereignty-accent hover:text-sovereignty-accent-hover transition-colors duration-150 underline',
                        target: '_blank',
                        rel: 'noopener noreferrer',
                      },
                    },
                  ],
                },
                {
                  type: 'paragraph',
                  content: '$t:terms.s3.mayIntro',
                  props: { className: 'text-sovereignty-light mb-3' },
                },
                {
                  type: 'div',
                  props: { className: 'ml-4 sm:ml-6 space-y-2' },
                  children: [
                    {
                      type: 'paragraph',
                      content: '$t:terms.s3.may1',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:terms.s3.may2',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:terms.s3.may3',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                  ],
                },
                {
                  type: 'paragraph',
                  content: '$t:terms.s3.mayNotIntro',
                  props: { className: 'text-sovereignty-light mb-3 mt-4' },
                },
                {
                  type: 'div',
                  props: { className: 'ml-4 sm:ml-6 space-y-2' },
                  children: [
                    {
                      type: 'paragraph',
                      content: '$t:terms.s3.mayNot1',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:terms.s3.mayNot2',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:terms.s3.mayNot3',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                  ],
                },
                {
                  type: 'paragraph',
                  content: '$t:terms.s3.guidelinesNote',
                  props: { className: 'text-sovereignty-light mt-4' },
                },
              ],
            },

            // Section 4 - Warranty Disclaimer
            {
              type: 'div',
              props: { className: 'mb-8' },
              children: [
                {
                  type: 'h2',
                  content: '$t:terms.s4.title',
                  props: {
                    className: 'text-xl sm:text-2xl font-semibold mb-4 text-sovereignty-accent',
                  },
                },
                {
                  type: 'paragraph',
                  content: '$t:terms.s4.p1',
                  props: { className: 'text-sovereignty-light uppercase mb-4' },
                },
                {
                  type: 'paragraph',
                  content: '$t:terms.s4.p2',
                  props: { className: 'text-sovereignty-light mb-3' },
                },
                {
                  type: 'div',
                  props: { className: 'ml-4 sm:ml-6 space-y-2' },
                  children: [
                    {
                      type: 'paragraph',
                      content: '$t:terms.s4.item1',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:terms.s4.item2',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:terms.s4.item3',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:terms.s4.item4',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                  ],
                },
              ],
            },

            // Section 5 - Limitation of Liability
            {
              type: 'div',
              props: { className: 'mb-8' },
              children: [
                {
                  type: 'h2',
                  content: '$t:terms.s5.title',
                  props: {
                    className: 'text-xl sm:text-2xl font-semibold mb-4 text-sovereignty-accent',
                  },
                },
                {
                  type: 'paragraph',
                  content: '$t:terms.s5.p1',
                  props: { className: 'text-sovereignty-light uppercase mb-4' },
                },
                {
                  type: 'paragraph',
                  content: '$t:terms.s5.p2',
                  props: { className: 'text-sovereignty-light' },
                },
              ],
            },

            // Section 6 - Indemnification
            {
              type: 'div',
              props: { className: 'mb-8' },
              children: [
                {
                  type: 'h2',
                  content: '$t:terms.s6.title',
                  props: {
                    className: 'text-xl sm:text-2xl font-semibold mb-4 text-sovereignty-accent',
                  },
                },
                {
                  type: 'paragraph',
                  content: '$t:terms.s6.p1',
                  props: { className: 'text-sovereignty-light mb-3' },
                },
                {
                  type: 'div',
                  props: { className: 'ml-4 sm:ml-6 space-y-2' },
                  children: [
                    {
                      type: 'paragraph',
                      content: '$t:terms.s6.item1',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:terms.s6.item2',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:terms.s6.item3',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:terms.s6.item4',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                  ],
                },
              ],
            },

            // Section 7 - Modifications
            {
              type: 'div',
              props: { className: 'mb-8' },
              children: [
                {
                  type: 'h2',
                  content: '$t:terms.s7.title',
                  props: {
                    className: 'text-xl sm:text-2xl font-semibold mb-4 text-sovereignty-accent',
                  },
                },
                {
                  type: 'paragraph',
                  content: '$t:terms.s7.p1',
                  props: { className: 'text-sovereignty-light' },
                },
              ],
            },

            // Section 8 - Termination
            {
              type: 'div',
              props: { className: 'mb-8' },
              children: [
                {
                  type: 'h2',
                  content: '$t:terms.s8.title',
                  props: {
                    className: 'text-xl sm:text-2xl font-semibold mb-4 text-sovereignty-accent',
                  },
                },
                {
                  type: 'paragraph',
                  content: '$t:terms.s8.p1',
                  props: { className: 'text-sovereignty-light mb-3' },
                },
                {
                  type: 'div',
                  props: { className: 'ml-4 sm:ml-6 space-y-2' },
                  children: [
                    {
                      type: 'paragraph',
                      content: '$t:terms.s8.item1',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:terms.s8.item2',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:terms.s8.item3',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:terms.s8.item4',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                  ],
                },
              ],
            },

            // Section 9 - Governing Law
            {
              type: 'div',
              props: { className: 'mb-8' },
              children: [
                {
                  type: 'h2',
                  content: '$t:terms.s9.title',
                  props: {
                    className: 'text-xl sm:text-2xl font-semibold mb-4 text-sovereignty-accent',
                  },
                },
                {
                  type: 'paragraph',
                  content: '$t:terms.s9.p1',
                  props: { className: 'text-sovereignty-light' },
                },
              ],
            },

            // Section 10 - Severability
            {
              type: 'div',
              props: { className: 'mb-8' },
              children: [
                {
                  type: 'h2',
                  content: '$t:terms.s10.title',
                  props: {
                    className: 'text-xl sm:text-2xl font-semibold mb-4 text-sovereignty-accent',
                  },
                },
                {
                  type: 'paragraph',
                  content: '$t:terms.s10.p1',
                  props: { className: 'text-sovereignty-light' },
                },
              ],
            },

            // Section 11 - Entire Agreement
            {
              type: 'div',
              props: { className: 'mb-8' },
              children: [
                {
                  type: 'h2',
                  content: '$t:terms.s11.title',
                  props: {
                    className: 'text-xl sm:text-2xl font-semibold mb-4 text-sovereignty-accent',
                  },
                },
                {
                  type: 'paragraph',
                  content: '$t:terms.s11.p1',
                  props: { className: 'text-sovereignty-light' },
                },
              ],
            },

            // Section 12 - User Data and Privacy
            {
              type: 'div',
              props: { className: 'mb-8' },
              children: [
                {
                  type: 'h2',
                  content: '$t:terms.s12.title',
                  props: {
                    className: 'text-xl sm:text-2xl font-semibold mb-4 text-sovereignty-accent',
                  },
                },
                {
                  type: 'paragraph',
                  content: '$t:terms.s12.p1',
                  props: { className: 'text-sovereignty-light mb-4' },
                },
                {
                  type: 'paragraph',
                  content: '$t:terms.s12.p2',
                  props: { className: 'text-sovereignty-light mb-4' },
                },
                {
                  type: 'paragraph',
                  content: '$t:terms.s12.p3',
                  props: { className: 'text-sovereignty-light' },
                },
              ],
            },

            // Section 13 - Contact
            {
              type: 'div',
              props: { className: 'mb-8' },
              children: [
                {
                  type: 'h2',
                  content: '$t:terms.s13.title',
                  props: {
                    className: 'text-xl sm:text-2xl font-semibold mb-4 text-sovereignty-accent',
                  },
                },
                {
                  type: 'paragraph',
                  content: '$t:terms.s13.intro',
                  props: { className: 'text-sovereignty-light mb-3' },
                },
                {
                  type: 'div',
                  props: { className: 'ml-4 sm:ml-6 space-y-2' },
                  children: [
                    {
                      type: 'paragraph',
                      content: '$t:terms.s13.item1',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:terms.s13.item2',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:terms.s13.item3',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:terms.s13.item4',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:terms.s13.item5',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:terms.s13.item6',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:terms.s13.item7',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:terms.s13.item8',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:terms.s13.item9',
                      props: { className: 'text-sovereignty-gray-400' },
                    },
                  ],
                },
              ],
            },

            // Notice
            {
              type: 'div',
              props: {
                className:
                  'mb-8 p-4 sm:p-6 bg-sovereignty-gray-900 border border-sovereignty-accent rounded-lg',
              },
              children: [
                {
                  type: 'h2',
                  content: '$t:terms.notice.title',
                  props: {
                    className: 'text-xl sm:text-2xl font-semibold mb-4 text-sovereignty-accent',
                  },
                },
                {
                  type: 'paragraph',
                  content: '$t:terms.notice.p1',
                  props: { className: 'text-sovereignty-light font-semibold' },
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
