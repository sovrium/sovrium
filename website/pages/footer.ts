/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Shared footer section for all website pages.
 *
 * Contains:
 * - Consistent navigation links (Home, Privacy Policy, Terms of Service, Data Deletion, License)
 * - Copyright notice with legal entity name
 *
 * Uses hardcoded English strings (legal pages are not i18n-ized).
 *
 * Usage: import and append to the `sections` array of any Page.
 */
export const footer = {
  type: 'section' as const,
  props: {
    className:
      'py-8 bg-sovereignty-darker border-t border-sovereignty-gray-800 text-sovereignty-light',
  },
  children: [
    {
      type: 'container' as const,
      props: { className: 'max-w-4xl mx-auto px-4 text-center' },
      children: [
        {
          type: 'flex' as const,
          props: {
            className:
              'flex-col sm:flex-row justify-center gap-4 sm:gap-6 md:gap-8 text-sovereignty-gray-400 mb-4 text-center sm:text-left',
          },
          children: [
            {
              type: 'link' as const,
              content: 'Home',
              props: {
                href: '/',
                className: 'hover:text-sovereignty-accent transition-colors',
              },
            },
            {
              type: 'link' as const,
              content: 'Privacy Policy',
              props: {
                href: '/privacy-policy',
                className: 'hover:text-sovereignty-accent transition-colors',
              },
            },
            {
              type: 'link' as const,
              content: 'Terms of Service',
              props: {
                href: '/terms-of-service',
                className: 'hover:text-sovereignty-accent transition-colors',
              },
            },
            {
              type: 'link' as const,
              content: 'Data Deletion',
              props: {
                href: '/data-deletion',
                className: 'hover:text-sovereignty-accent transition-colors',
              },
            },
            {
              type: 'link' as const,
              content: 'License',
              props: {
                href: 'https://github.com/sovrium/sovrium/blob/main/LICENSE.md',
                className: 'hover:text-sovereignty-accent transition-colors',
              },
            },
          ],
        },
        {
          type: 'paragraph' as const,
          content:
            '\u00A9 2025-2026 ESSENTIAL SERVICES. Sovrium\u00AE is a registered trademark of ESSENTIAL SERVICES.',
          props: { className: 'text-sovereignty-gray-500 text-sm' },
        },
      ],
    },
  ],
}
