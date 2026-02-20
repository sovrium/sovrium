/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Link style constants shared between i18n and hardcoded footers.
 */
const linkClass = 'hover:text-sovereignty-light transition-colors duration-150 text-sm'

const columnTitleClass = 'text-sovereignty-light font-semibold text-sm tracking-wide mb-4'

/**
 * Creates a footer link node (i18n-aware or hardcoded).
 */
function footerLink(content: string, href: string) {
  return {
    type: 'link' as const,
    content,
    props: { href, className: linkClass },
  }
}

/**
 * Creates a column with a title and links.
 */
function footerColumn(title: string, links: readonly ReturnType<typeof footerLink>[]) {
  return {
    type: 'div' as const,
    props: { className: '' },
    children: [
      {
        type: 'paragraph' as const,
        content: title,
        props: { className: columnTitleClass },
      },
      {
        type: 'flex' as const,
        props: { className: 'flex-col gap-3' },
        children: links,
      },
    ],
  }
}

/**
 * Shared i18n footer section for all internationalized website pages
 * (home, partners, company).
 *
 * Layout:
 * - Top row: Sovrium logo + description | Product links | Company links | Legal links
 * - Bottom row: copyright notice
 *
 * Uses `$t:footer.*` i18n tokens defined in `website/app.ts`.
 *
 * Usage: import and append to the `sections` array of any i18n Page.
 */
export const footerI18n = {
  type: 'footer' as const,
  props: {
    className:
      'py-16 bg-sovereignty-darker border-t border-sovereignty-gray-800 text-sovereignty-light',
  },
  children: [
    {
      type: 'container' as const,
      props: { className: 'max-w-6xl mx-auto px-4 sm:px-6' },
      children: [
        // ── Top: Logo + Description | Link Columns ──────────────────────
        {
          type: 'grid' as const,
          props: {
            className: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 lg:gap-8 mb-12',
          },
          children: [
            // Brand column (spans 2 cols on lg)
            {
              type: 'div' as const,
              props: { className: 'lg:col-span-2' },
              children: [
                {
                  type: 'link' as const,
                  props: { href: '/', className: 'inline-block mb-4' },
                  children: [
                    {
                      type: 'image' as const,
                      props: {
                        src: '/logos/sovrium-horizontal-light.svg',
                        alt: 'Sovrium',
                        className: 'h-7 w-auto',
                      },
                    },
                  ],
                },
                {
                  type: 'paragraph' as const,
                  content: '$t:footer.description',
                  props: {
                    className: 'text-sovereignty-gray-400 text-sm leading-relaxed max-w-xs',
                  },
                },
              ],
            },

            // Product column
            footerColumn('$t:footer.col.product', [
              footerLink(
                '$t:footer.col.product.docs',
                'https://github.com/sovrium/sovrium/blob/main/README.md'
              ),
              footerLink('$t:footer.col.product.github', 'https://github.com/sovrium/sovrium'),
              footerLink(
                '$t:footer.col.product.license',
                'https://github.com/sovrium/sovrium/blob/main/LICENSE.md'
              ),
            ]),

            // Company column
            footerColumn('$t:footer.col.company', [
              footerLink('$t:footer.col.company.about', '$t:footer.col.company.about.href'),
              footerLink('$t:footer.col.company.partners', '$t:footer.col.company.partners.href'),
              footerLink(
                '$t:footer.col.company.trademark',
                'https://github.com/sovrium/sovrium/blob/main/TRADEMARK.md'
              ),
            ]),

            // Legal column
            footerColumn('$t:footer.col.legal', [
              footerLink('$t:footer.col.legal.privacy', '$t:footer.col.legal.privacy.href'),
              footerLink('$t:footer.col.legal.terms', '$t:footer.col.legal.terms.href'),
              footerLink(
                '$t:footer.col.legal.dataDeletion',
                '$t:footer.col.legal.dataDeletion.href'
              ),
            ]),
          ],
        },

        // ── Divider ─────────────────────────────────────────────────────
        {
          type: 'div' as const,
          props: { className: 'border-t border-sovereignty-gray-800 pt-8' },
          children: [
            {
              type: 'paragraph' as const,
              content: '$t:footer.copyright',
              props: { className: 'text-sovereignty-gray-500 text-sm' },
            },
          ],
        },
      ],
    },
  ],
}

/**
 * Shared footer section for non-i18n pages (legal: privacy-policy,
 * terms-of-service, data-deletion).
 *
 * Same multi-column layout as the i18n footer but with hardcoded English strings.
 *
 * Usage: import and append to the `sections` array of any non-i18n Page.
 */
export const footer = {
  type: 'footer' as const,
  props: {
    className:
      'py-16 bg-sovereignty-darker border-t border-sovereignty-gray-800 text-sovereignty-light',
  },
  children: [
    {
      type: 'container' as const,
      props: { className: 'max-w-6xl mx-auto px-4 sm:px-6' },
      children: [
        // ── Top: Logo + Description | Link Columns ──────────────────────
        {
          type: 'grid' as const,
          props: {
            className: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 lg:gap-8 mb-12',
          },
          children: [
            // Brand column (spans 2 cols on lg)
            {
              type: 'div' as const,
              props: { className: 'lg:col-span-2' },
              children: [
                {
                  type: 'link' as const,
                  props: { href: '/', className: 'inline-block mb-4' },
                  children: [
                    {
                      type: 'image' as const,
                      props: {
                        src: '/logos/sovrium-horizontal-light.svg',
                        alt: 'Sovrium',
                        className: 'h-7 w-auto',
                      },
                    },
                  ],
                },
                {
                  type: 'paragraph' as const,
                  content:
                    'A self-hosted, configuration-driven platform that puts you back in control of your software.',
                  props: {
                    className: 'text-sovereignty-gray-400 text-sm leading-relaxed max-w-xs',
                  },
                },
              ],
            },

            // Product column
            footerColumn('Product', [
              footerLink('Documentation', 'https://github.com/sovrium/sovrium/blob/main/README.md'),
              footerLink('GitHub', 'https://github.com/sovrium/sovrium'),
              footerLink('License', 'https://github.com/sovrium/sovrium/blob/main/LICENSE.md'),
            ]),

            // Company column
            footerColumn('Company', [
              footerLink('About', '/en/company'),
              footerLink('Our Partner Service', '/en/partners'),
              footerLink('Trademark', 'https://github.com/sovrium/sovrium/blob/main/TRADEMARK.md'),
            ]),

            // Legal column
            footerColumn('Legal', [
              footerLink('Privacy Policy', '/en/privacy-policy'),
              footerLink('Terms of Service', '/en/terms-of-service'),
              footerLink('Data Deletion', '/en/data-deletion'),
            ]),
          ],
        },

        // ── Divider ─────────────────────────────────────────────────────
        {
          type: 'div' as const,
          props: { className: 'border-t border-sovereignty-gray-800 pt-8' },
          children: [
            {
              type: 'paragraph' as const,
              content:
                '\u00A9 2025-2026 ESSENTIAL SERVICES. Sovrium\u00AE is a registered trademark of ESSENTIAL SERVICES.',
              props: { className: 'text-sovereignty-gray-500 text-sm' },
            },
          ],
        },
      ],
    },
  ],
}
