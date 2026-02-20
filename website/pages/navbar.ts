/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Shared navbar section for all website pages (except brand-charter).
 *
 * Contains:
 * - Sovrium horizontal logo (light variant on dark background, links to home)
 * - Desktop navigation links (Partners, Company)
 *
 * Uses `$t:nav.*` i18n tokens defined in `website/app.ts`.
 *
 * Usage: import and prepend to the `sections` array of any Page.
 */
export const navbar = {
  type: 'section' as const,
  props: {
    className: 'bg-sovereignty-darker border-b border-sovereignty-gray-800 sticky top-0 z-50',
  },
  children: [
    {
      type: 'container' as const,
      props: { className: 'max-w-7xl mx-auto px-4 sm:px-6 md:px-8' },
      children: [
        {
          type: 'nav' as const,
          props: {
            className: 'flex items-center justify-between h-16',
          },
          children: [
            // Logo (links to home)
            {
              type: 'link' as const,
              props: {
                href: '/',
                className: 'flex items-center shrink-0',
              },
              children: [
                {
                  type: 'image' as const,
                  props: {
                    src: '/logos/sovrium-horizontal-light.svg',
                    alt: 'Sovrium',
                    className: 'h-8 w-auto',
                  },
                },
              ],
            },

            // Desktop navigation links
            {
              type: 'flex' as const,
              props: {
                className: 'items-center gap-8',
              },
              children: [
                {
                  type: 'link' as const,
                  content: '$t:nav.partners',
                  props: {
                    href: '$t:nav.partners.href',
                    className:
                      'text-sovereignty-gray-400 hover:text-sovereignty-light transition-colors duration-150 text-sm font-medium',
                  },
                },
                {
                  type: 'link' as const,
                  content: '$t:nav.company',
                  props: {
                    href: '$t:nav.company.href',
                    className:
                      'text-sovereignty-gray-400 hover:text-sovereignty-light transition-colors duration-150 text-sm font-medium',
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}
