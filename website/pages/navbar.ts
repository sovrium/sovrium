/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Navbar link style constant (desktop).
 */
const navLinkClass =
  'text-sovereignty-gray-400 hover:text-sovereignty-light transition-colors duration-150 text-sm font-medium'

/**
 * Navbar link style constant (mobile dropdown).
 */
const mobileNavLinkClass =
  'block text-sovereignty-gray-300 hover:text-sovereignty-light hover:bg-sovereignty-gray-800 transition-colors duration-150 text-base font-medium px-4 py-3 rounded-lg'

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
 * Inline script that powers the mobile hamburger menu toggle.
 *
 * On click of `#mobile-menu-btn`, toggles `#mobile-menu` visibility and
 * swaps between the `menu` (hamburger) and `x` (close) Lucide icons.
 *
 * The button contains two SVG icons rendered via the `icon` component type:
 * - `#mobile-menu-icon` (menu/hamburger) — visible when menu is closed
 * - `#mobile-close-icon` (x/close) — visible when menu is open
 *
 * Import and add to the page's `scripts.inlineScripts` array alongside
 * `langSwitchScript`.
 */
export const mobileMenuScript = {
  code: [
    '(function(){',
    'var btn=document.getElementById("mobile-menu-btn");',
    'var menu=document.getElementById("mobile-menu");',
    'var menuIcon=document.getElementById("mobile-menu-icon");',
    'var closeIcon=document.getElementById("mobile-close-icon");',
    'if(!btn||!menu)return;',
    // Ensure the close icon is hidden on load (overrides any inline styles)
    'if(closeIcon)closeIcon.style.display="none";',
    'btn.addEventListener("click",function(){',
    'var isHidden=menu.classList.contains("hidden");',
    'if(isHidden){',
    'menu.classList.remove("hidden");',
    'menu.style.maxHeight=menu.scrollHeight+"px";',
    'btn.setAttribute("aria-expanded","true");',
    'if(menuIcon)menuIcon.style.display="none";',
    'if(closeIcon)closeIcon.style.display="block";',
    '}else{',
    'menu.style.maxHeight="0px";',
    'setTimeout(function(){menu.classList.add("hidden");menu.style.maxHeight=""},300);',
    'btn.setAttribute("aria-expanded","false");',
    'if(menuIcon)menuIcon.style.display="block";',
    'if(closeIcon)closeIcon.style.display="none";',
    '}',
    '});',
    '})();',
  ].join(''),
  position: 'body-end' as const,
}

/**
 * Shared navbar section for all website pages (except brand-charter).
 *
 * Contains:
 * - Sovrium horizontal logo (light variant on dark background, links to home)
 * - Desktop navigation links (Partners, Company) - visible on md+ screens
 * - Mobile hamburger button - visible on small screens
 * - Mobile dropdown menu with nav links + language switcher
 * - Language switcher (toggles between EN/FR)
 *
 * Uses `$t:nav.*` i18n tokens defined in `website/app.ts`.
 *
 * Usage: import and prepend to the `sections` array of any Page.
 * Also add `mobileMenuScript` to the page's `scripts.inlineScripts` array.
 */
export const navbar = {
  type: 'section' as const,
  props: {
    className:
      'bg-sovereignty-darker border-b border-sovereignty-gray-800 sticky top-0 z-50 relative',
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

            // Desktop navigation links + language switcher (hidden on mobile)
            {
              type: 'flex' as const,
              props: {
                className: 'hidden md:flex items-center gap-8',
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

            // Mobile menu toggle button (visible on small screens only)
            // Contains two Lucide icons: menu (hamburger) and x (close).
            // The mobileMenuScript swaps their visibility on click.
            {
              type: 'button' as const,
              props: {
                id: 'mobile-menu-btn',
                type: 'button',
                className:
                  'md:hidden inline-flex items-center justify-center w-9 h-9 rounded-lg bg-transparent hover:bg-sovereignty-gray-800 p-0 border border-sovereignty-gray-700 text-sovereignty-gray-400 hover:text-sovereignty-light hover:border-sovereignty-gray-500 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-sovereignty-accent',
                'aria-controls': 'mobile-menu',
                'aria-expanded': 'false',
                'aria-label': 'Toggle navigation',
              },
              children: [
                {
                  type: 'icon' as const,
                  props: {
                    id: 'mobile-menu-icon',
                    name: 'menu',
                    size: 18,
                    className: 'block',
                  },
                },
                // The close icon starts hidden via JS (mobileMenuScript sets
                // display:none on load). CSS class 'hidden' cannot override the
                // inline display:inline-block that the rendering system applies
                // to contentless child components.
                {
                  type: 'icon' as const,
                  props: {
                    id: 'mobile-close-icon',
                    name: 'x',
                    size: 18,
                  },
                },
              ],
            },
          ],
        },

        // Mobile dropdown menu (hidden by default, toggled via mobileMenuScript)
        // Uses absolute positioning to overlay content instead of pushing it down.
        {
          type: 'div' as const,
          props: {
            className:
              'hidden md:hidden absolute top-full left-0 w-full bg-sovereignty-darker border-b border-sovereignty-gray-800 shadow-lg overflow-hidden transition-all duration-300 ease-in-out z-50',
            id: 'mobile-menu',
          },
          children: [
            {
              type: 'div' as const,
              props: { className: 'max-w-7xl mx-auto px-4 sm:px-6 md:px-8 pb-4 pt-2 space-y-1' },
              children: [
                {
                  type: 'link' as const,
                  content: '$t:nav.partners',
                  props: {
                    href: '$t:nav.partners.href',
                    className: mobileNavLinkClass,
                  },
                },
                {
                  type: 'link' as const,
                  content: '$t:nav.company',
                  props: {
                    href: '$t:nav.company.href',
                    className: mobileNavLinkClass,
                  },
                },

                // Horizontal separator
                {
                  type: 'div' as const,
                  props: {
                    className: 'h-px bg-sovereignty-gray-800 my-2',
                    'aria-hidden': 'true',
                  },
                },

                // Language switcher link (mobile)
                {
                  type: 'link' as const,
                  content: '$t:nav.lang.label',
                  props: {
                    href: '#',
                    className: mobileNavLinkClass,
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
