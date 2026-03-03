/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Sovrium version read from package.json at module load time.
 * Displayed as a subtle badge in the navbar next to the Docs link.
 */
const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8')) as {
  version: string
}
/** Version without `v` prefix — for schema paths like `/schemas/0.0.2/...` */
export const rawVersion = packageJson.version

/** Version with `v` prefix — for display (e.g. navbar badge) */
export const version = `v${rawVersion}`

/**
 * Navbar link style constants (desktop).
 * Active links use bright text (sovereignty-light) for maximum contrast against
 * the dark navbar background. This follows the same brightness logic as the
 * hover state: gray-400 = inactive, light = active or hovered.
 * Blue is reserved for interactive/actionable elements in the page body.
 */
const navLinkInactiveClass =
  'text-sovereignty-gray-400 hover:text-sovereignty-light transition-colors duration-150 text-sm font-medium'
const navLinkActiveClass =
  'text-sovereignty-light transition-colors duration-150 text-sm font-medium'

/**
 * Navbar link style constants (mobile dropdown).
 * Active links use bright text and a subtle background highlight.
 */
const mobileNavLinkInactiveClass =
  'block text-sovereignty-gray-300 hover:text-sovereignty-light hover:bg-sovereignty-gray-800 transition-colors duration-150 text-base font-medium px-4 py-3 rounded-lg'
const mobileNavLinkActiveClass =
  'block text-sovereignty-light bg-sovereignty-gray-800 transition-colors duration-150 text-base font-medium px-4 py-3 rounded-lg'

/**
 * Known nav link identifiers for active state highlighting.
 * Pages pass one of these to `createNavbar()` to highlight the corresponding link.
 */
export type NavPage = 'docs' | 'partner' | 'about'

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
 * Creates the shared navbar section for all website pages (except brand-charter).
 *
 * Contains:
 * - Sovrium horizontal logo (light variant on dark background, links to home)
 * - Desktop navigation links (Docs, Services, About) - visible on md+ screens
 * - "Get Started" CTA button (accent-colored, links to docs)
 * - Mobile hamburger button - visible on small screens
 * - Mobile dropdown menu with nav links + language switcher
 * - Language switcher (toggles between EN/FR)
 *
 * Uses `$t:nav.*` i18n tokens defined in `website/app.ts`.
 *
 * @param activePage - Optional identifier of the currently active page.
 *   Pass `'docs'`, `'partner'`, or `'about'` to highlight the corresponding
 *   nav link. Omit for pages without a corresponding nav link (e.g. home,
 *   legal pages).
 *
 * Usage: import and call in the `sections` array of any Page.
 * Also add `mobileMenuScript` to the page's `scripts.inlineScripts` array.
 */
export function createNavbar(activePage?: NavPage) {
  const desktopClass = (page: NavPage) =>
    activePage === page ? navLinkActiveClass : navLinkInactiveClass
  const mobileClass = (page: NavPage) =>
    activePage === page ? mobileNavLinkActiveClass : mobileNavLinkInactiveClass

  return {
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
                  // Docs link with version badge
                  {
                    type: 'link' as const,
                    props: {
                      href: '$t:nav.docs.href',
                      className: `${desktopClass('docs')} flex items-center gap-2`,
                      ...(activePage === 'docs' ? { 'aria-current': 'page' } : {}),
                    },
                    children: [
                      {
                        type: 'span' as const,
                        content: '$t:nav.docs',
                      },
                      {
                        type: 'span' as const,
                        content: version,
                        props: {
                          className:
                            'text-[10px] leading-none font-medium px-1.5 py-0.5 rounded-full bg-sovereignty-gray-800 text-sovereignty-gray-400 border border-sovereignty-gray-700',
                        },
                      },
                    ],
                  },
                  {
                    type: 'link' as const,
                    content: '$t:nav.partner',
                    props: {
                      href: '$t:nav.partner.href',
                      className: desktopClass('partner'),
                      ...(activePage === 'partner' ? { 'aria-current': 'page' } : {}),
                    },
                  },
                  {
                    type: 'link' as const,
                    content: '$t:nav.about',
                    props: {
                      href: '$t:nav.about.href',
                      className: desktopClass('about'),
                      ...(activePage === 'about' ? { 'aria-current': 'page' } : {}),
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
                      className: navLinkInactiveClass,
                      'data-lang-switch': '$t:nav.lang.code',
                      'aria-label': 'Switch language',
                    },
                  },

                  // CTA button
                  {
                    type: 'link' as const,
                    content: '$t:nav.cta',
                    props: {
                      href: '$t:nav.cta.href',
                      className:
                        'bg-sovereignty-accent hover:bg-sovereignty-accent/90 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors duration-200',
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
                props: {
                  className: 'max-w-7xl mx-auto px-4 sm:px-6 md:px-8 pb-4 pt-2 space-y-1',
                },
                children: [
                  // Docs link with version badge (mobile)
                  {
                    type: 'link' as const,
                    props: {
                      href: '$t:nav.docs.href',
                      className: `${mobileClass('docs')} flex items-center gap-2`,
                      ...(activePage === 'docs' ? { 'aria-current': 'page' } : {}),
                    },
                    children: [
                      {
                        type: 'span' as const,
                        content: '$t:nav.docs',
                      },
                      {
                        type: 'span' as const,
                        content: version,
                        props: {
                          className:
                            'text-[10px] leading-none font-medium px-1.5 py-0.5 rounded-full bg-sovereignty-gray-800 text-sovereignty-gray-400 border border-sovereignty-gray-700',
                        },
                      },
                    ],
                  },
                  {
                    type: 'link' as const,
                    content: '$t:nav.partner',
                    props: {
                      href: '$t:nav.partner.href',
                      className: mobileClass('partner'),
                      ...(activePage === 'partner' ? { 'aria-current': 'page' } : {}),
                    },
                  },
                  {
                    type: 'link' as const,
                    content: '$t:nav.about',
                    props: {
                      href: '$t:nav.about.href',
                      className: mobileClass('about'),
                      ...(activePage === 'about' ? { 'aria-current': 'page' } : {}),
                    },
                  },

                  // CTA button (mobile)
                  {
                    type: 'link' as const,
                    content: '$t:nav.cta',
                    props: {
                      href: '$t:nav.cta.href',
                      className:
                        'block bg-sovereignty-accent hover:bg-sovereignty-accent/90 text-white text-base font-medium px-4 py-3 rounded-lg transition-colors duration-200 text-center',
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
                      className: mobileNavLinkInactiveClass,
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
}

