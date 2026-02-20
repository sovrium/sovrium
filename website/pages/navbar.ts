/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Navbar link style constant.
 */
const navLinkClass =
  'text-sovereignty-gray-400 hover:text-sovereignty-light transition-colors duration-150 text-sm font-medium'

/**
 * Inline script that enables the language switcher link in the navbar.
 *
 * On page load, finds every `[data-lang-switch]` anchor and sets its `href`
 * to the current page path with the language prefix swapped.
 *
 * Example: on `/en/company` with `data-lang-switch="fr"`, sets `href="/fr/company"`.
 *
 * Import and add to the page's `scripts.inlineScripts` array.
 */
export const langSwitchScript = {
  code: [
    'document.querySelectorAll("[data-lang-switch]").forEach(function(a){',
    'var t=a.getAttribute("data-lang-switch");',
    'var s=location.pathname.split("/").filter(Boolean);',
    'if(s.length>0){s[0]=t;a.href="/"+s.join("/")}',
    'else{a.href="/"+t+"/"}',
    '});',
  ].join(''),
  position: 'body-end' as const,
}

/**
 * Shared navbar section for all website pages (except brand-charter).
 *
 * Contains:
 * - Sovrium horizontal logo (light variant on dark background, links to home)
 * - Desktop navigation links (Partners, Company)
 * - Language switcher (toggles between EN/FR)
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

            // Desktop navigation links + language switcher
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
                    className: navLinkClass,
                  },
                },
                {
                  type: 'link' as const,
                  content: '$t:nav.company',
                  props: {
                    href: '$t:nav.company.href',
                    className: navLinkClass,
                  },
                },

                // Vertical separator
                {
                  type: 'div' as const,
                  props: {
                    className: 'w-px h-4 bg-sovereignty-gray-700',
                    'aria-hidden': 'true',
                  },
                },

                // Language switcher link
                {
                  type: 'link' as const,
                  content: '$t:nav.lang.label',
                  props: {
                    href: '#',
                    className: navLinkClass,
                    'data-lang-switch': '$t:nav.lang.code',
                    'aria-label': 'Switch language',
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
