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
 * Used by docs pages (e.g. schema paths) and brand charter page.
 */
const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8')) as {
  version: string
}
/** Version without `v` prefix — for schema paths like `/schemas/0.1.0/...` */
export const rawVersion = packageJson.version

/** Version with `v` prefix — for display (e.g. brand charter, docs hero) */
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
 * Inline script that powers the Pagefind search modal.
 *
 * Features:
 * - Opens on click of `#search-btn` or `[data-search-btn]`
 * - Opens on `Cmd+K` (macOS) / `Ctrl+K` (Windows/Linux)
 * - Closes on `Escape`, backdrop click, or close button
 * - Lazy-loads Pagefind UI JS/CSS on first open
 * - Auto-focuses the search input when modal opens
 * - Prevents body scroll when modal is open
 *
 * Import and add to the page's `scripts.inlineScripts` array.
 */
export const searchScript = {
  code: [
    '(function(){',
    'var modal=document.getElementById("search-modal");',
    'var container=document.getElementById("search-container");',
    'if(!modal||!container)return;',
    'var loaded=false;',
    'function open(){',
    'modal.classList.remove("hidden");',
    'modal.setAttribute("aria-hidden","false");',
    'document.body.style.overflow="hidden";',
    'requestAnimationFrame(function(){',
    'modal.querySelector("[data-search-backdrop]").style.opacity="1";',
    'modal.querySelector("[data-search-panel]").style.opacity="1";',
    'modal.querySelector("[data-search-panel]").style.transform="scale(1)";',
    '});',
    'if(!loaded){',
    'loaded=true;',
    'var css=document.createElement("link");',
    'css.rel="stylesheet";css.href="/pagefind/pagefind-ui.css";',
    'document.head.appendChild(css);',
    'var js=document.createElement("script");',
    'js.src="/pagefind/pagefind-ui.js";',
    'js.onload=function(){',
    'new PagefindUI({element:container,showSubResults:true,showImages:false});',
    'setTimeout(function(){var i=container.querySelector("input");if(i)i.focus()},100);',
    '};',
    'document.body.appendChild(js);',
    '}else{',
    'setTimeout(function(){var i=container.querySelector("input");if(i){i.focus();i.select()}},50);',
    '}',
    '}',
    'function close(){',
    'modal.querySelector("[data-search-backdrop]").style.opacity="0";',
    'modal.querySelector("[data-search-panel]").style.opacity="0";',
    'modal.querySelector("[data-search-panel]").style.transform="scale(0.95)";',
    'setTimeout(function(){',
    'modal.classList.add("hidden");',
    'modal.setAttribute("aria-hidden","true");',
    'document.body.style.overflow="";',
    '},200);',
    '}',
    'document.querySelectorAll("#search-btn,[data-search-btn]").forEach(function(b){',
    'b.addEventListener("click",function(e){e.preventDefault();open()});',
    '});',
    'modal.querySelector("[data-search-backdrop]").addEventListener("click",close);',
    'modal.querySelector("[data-search-close]").addEventListener("click",close);',
    'document.addEventListener("keydown",function(e){',
    'if((e.metaKey||e.ctrlKey)&&e.key==="k"){e.preventDefault();open()}',
    'if(e.key==="Escape"&&!modal.classList.contains("hidden"))close();',
    '});',
    '})();',
  ].join(''),
  position: 'body-end' as const,
}

/**
 * Creates the search modal overlay section.
 *
 * This should be placed as a top-level section in every page's `sections` array,
 * after the navbar. The modal is hidden by default and shown via `searchScript`.
 *
 * Uses a dark backdrop overlay with a centered search panel styled to match
 * the sovereignty dark theme. Pagefind UI CSS variables are overridden inline
 * to match the brand colors.
 */
export function createSearchModal() {
  return {
    type: 'div' as const,
    props: {
      id: 'search-modal',
      className: 'hidden fixed inset-0 z-[100]',
      'aria-hidden': 'true',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': 'Search',
      'data-pagefind-ignore': 'all',
    },
    children: [
      // Backdrop
      {
        type: 'div' as const,
        props: {
          'data-search-backdrop': 'true',
          className: 'fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200',
          style: 'opacity:0',
        },
      },
      // Panel
      {
        type: 'div' as const,
        props: {
          className: 'fixed inset-0 flex items-start justify-center pt-[15vh] px-4',
        },
        children: [
          {
            type: 'div' as const,
            props: {
              'data-search-panel': 'true',
              className:
                'w-full max-w-2xl bg-sovereignty-darker border border-sovereignty-gray-800 rounded-xl shadow-2xl overflow-hidden transition-all duration-200',
              style:
                'opacity:0;transform:scale(0.95);--pagefind-ui-scale:0.9;--pagefind-ui-primary:#3b82f6;--pagefind-ui-text:#e8ecf4;--pagefind-ui-background:#050810;--pagefind-ui-border:#1f2937;--pagefind-ui-tag:#111827;--pagefind-ui-border-width:1px;--pagefind-ui-border-radius:8px;--pagefind-ui-image-border-radius:8px;--pagefind-ui-image-box-ratio:0;--pagefind-ui-font:Inter,system-ui,-apple-system,sans-serif',
            },
            children: [
              // Header with close button
              {
                type: 'flex' as const,
                props: {
                  className: 'items-center justify-between px-5 pt-4 pb-2',
                },
                children: [
                  {
                    type: 'span' as const,
                    content: '$t:nav.search.title',
                    props: {
                      className: 'text-sm font-medium text-sovereignty-gray-400',
                    },
                  },
                  {
                    type: 'flex' as const,
                    props: { className: 'items-center gap-3' },
                    children: [
                      {
                        type: 'span' as const,
                        content: '$t:nav.search.shortcut',
                        props: {
                          className:
                            'hidden sm:inline text-[11px] text-sovereignty-gray-500 border border-sovereignty-gray-700 rounded px-1.5 py-0.5',
                        },
                      },
                      {
                        type: 'button' as const,
                        props: {
                          'data-search-close': 'true',
                          type: 'button',
                          className:
                            'inline-flex items-center justify-center w-7 h-7 rounded bg-transparent hover:bg-sovereignty-gray-800 p-0 text-sovereignty-gray-500 hover:text-sovereignty-light transition-colors duration-150',
                          'aria-label': 'Close search',
                        },
                        children: [
                          {
                            type: 'icon' as const,
                            props: { name: 'x', size: 16 },
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
              // Pagefind UI container
              {
                type: 'div' as const,
                props: {
                  id: 'search-container',
                  className: 'px-5 pb-5',
                },
              },
            ],
          },
        ],
      },
    ],
  }
}

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
 * On click of `#mobile-menu-btn`, toggles `#mobile-menu` visibility with
 * a maxHeight slide animation, and swaps between the `menu` (hamburger)
 * and `x` (close) Lucide icons.
 *
 * The menu uses absolute positioning with overflow-hidden on the outer
 * container (animated via maxHeight) and a full-viewport-height inner
 * container. Body scroll is locked when the menu is open.
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
    // Open: remove hidden, expand to full viewport height, lock body scroll
    'menu.classList.remove("hidden");',
    'menu.style.maxHeight="100dvh";',
    'btn.setAttribute("aria-expanded","true");',
    'document.body.style.overflow="hidden";',
    'if(menuIcon)menuIcon.style.display="none";',
    'if(closeIcon)closeIcon.style.display="block";',
    '}else{',
    // Close: collapse to 0, then hide after transition, unlock body scroll
    'menu.style.maxHeight="0px";',
    'setTimeout(function(){menu.classList.add("hidden");menu.style.maxHeight=""},300);',
    'btn.setAttribute("aria-expanded","false");',
    'document.body.style.overflow="";',
    'if(menuIcon)menuIcon.style.display="block";',
    'if(closeIcon)closeIcon.style.display="none";',
    '}',
    '});',
    '})();',
  ].join(''),
  position: 'body-end' as const,
}

/**
 * GitHub octocat SVG as a base64 data URI (white fill, used in both desktop and mobile).
 */
const githubIconSrc =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAyNCIgaGVpZ2h0PSIxMDI0IiB2aWV3Qm94PSIwIDAgMTAyNCAxMDI0IiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgo8cGF0aCBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGNsaXAtcnVsZT0iZXZlbm9kZCIgZD0iTTggMEMzLjU4IDAgMCAzLjU4IDAgOEMwIDExLjU0IDIuMjkgMTQuNTMgNS40NyAxNS41OUM1Ljg3IDE1LjY2IDYuMDIgMTUuNDIgNi4wMiAxNS4yMUM2LjAyIDE1LjAyIDYuMDEgMTQuMzkgNi4wMSAxMy43MkM0IDE0LjA5IDMuNDggMTMuMjMgMy4zMiAxMi43OEMzLjIzIDEyLjU1IDIuODQgMTEuODQgMi41IDExLjY1QzIuMjIgMTEuNSAxLjgyIDExLjEzIDIuNDkgMTEuMTJDMy4xMiAxMS4xMSAzLjU3IDExLjcgMy43MiAxMS45NEM0LjQ0IDEzLjE1IDUuNTkgMTIuODEgNi4wNSAxMi42QzYuMTIgMTIuMDggNi4zMyAxMS43MyA2LjU2IDExLjUzQzQuNzggMTEuMzMgMi45MiAxMC42NCAyLjkyIDcuNThDMi45MiA2LjcxIDMuMjMgNS45OSAzLjc0IDUuNDNDMy42NiA1LjIzIDMuMzggNC40MSAzLjgyIDMuMzFDMy44MiAzLjMxIDQuNDkgMy4xIDYuMDIgNC4xM0M2LjY2IDMuOTUgNy4zNCAzLjg2IDguMDIgMy44NkM4LjcgMy44NiA5LjM4IDMuOTUgMTAuMDIgNC4xM0MxMS41NSAzLjA5IDEyLjIyIDMuMzEgMTIuMjIgMy4zMUMxMi42NiA0LjQxIDEyLjM4IDUuMjMgMTIuMyA1LjQzQzEyLjgxIDUuOTkgMTMuMTIgNi43IDEzLjEyIDcuNThDMTMuMTIgMTAuNjUgMTEuMjUgMTEuMzMgOS40NyAxMS41M0M5Ljc2IDExLjc4IDEwLjAxIDEyLjI2IDEwLjAxIDEzLjAxQzEwLjAxIDE0LjA4IDEwIDE0Ljk0IDEwIDE1LjIxQzEwIDE1LjQyIDEwLjE1IDE1LjY3IDEwLjU1IDE1LjU5QzEzLjcxIDE0LjUzIDE2IDExLjUzIDE2IDhDMTYgMy41OCAxMi40MiAwIDggMFoiIHRyYW5zZm9ybT0ic2NhbGUoNjQpIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4K'

/**
 * Creates the shared navbar section for all website pages (except brand-charter).
 *
 * Desktop layout (left to right):
 * ```
 * [Logo] [Search docs...  ⌘K] .......... [Docs] [Services] [About] [GitHub] [Get Started] [🌐]
 * ```
 *
 * Contains:
 * - Sovrium horizontal logo (light variant on dark background, links to home)
 * - Wide search button next to logo (triggers Pagefind search modal)
 * - Desktop navigation links (Docs, Services, About) - visible on md+ screens
 * - GitHub icon link
 * - "Get Started" CTA button (accent-colored, links to docs)
 * - Globe icon language switcher (far right)
 * - Mobile hamburger button - visible on small screens
 * - Mobile dropdown menu with search first, nav links, language switcher
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
      'data-pagefind-ignore': 'all',
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
              // ── Left group: Logo + Search ──────────────────────────
              {
                type: 'flex' as const,
                props: {
                  className: 'flex items-center gap-4 shrink-0',
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

                  // Search button (desktop) — wide input-like appearance
                  // Hidden on mobile (search is first item in mobile menu instead)
                  {
                    type: 'button' as const,
                    props: {
                      id: 'search-btn',
                      type: 'button',
                      className:
                        'hidden md:flex items-center gap-2 h-9 px-3 rounded-lg border border-sovereignty-gray-700 bg-sovereignty-gray-900/50 text-sovereignty-gray-500 hover:text-sovereignty-gray-300 hover:border-sovereignty-gray-500 hover:bg-sovereignty-gray-900/70 transition-colors duration-200 cursor-pointer',
                      'aria-label': 'Search documentation',
                    },
                    children: [
                      {
                        type: 'icon' as const,
                        props: {
                          name: 'search',
                          size: 15,
                          className: 'shrink-0 text-sovereignty-gray-500',
                        },
                      },
                      {
                        type: 'span' as const,
                        content: '$t:nav.search.placeholder',
                        props: {
                          className:
                            'text-sm font-normal flex-1 text-left hidden lg:inline truncate',
                        },
                      },
                      {
                        type: 'span' as const,
                        content: '$t:nav.search',
                        props: {
                          className: 'text-sm font-normal lg:hidden',
                        },
                      },
                      {
                        type: 'span' as const,
                        content: '$t:nav.search.shortcut',
                        props: {
                          className:
                            'text-[10px] text-sovereignty-gray-600 border border-sovereignty-gray-700 rounded px-1.5 py-0.5 ml-auto shrink-0 font-medium',
                        },
                      },
                    ],
                  },
                ],
              },

              // ── Right group: Nav links + GitHub + CTA + Language ───
              {
                type: 'flex' as const,
                props: {
                  className: 'hidden md:flex items-center gap-6',
                },
                children: [
                  // Navigation links (plain text, no version badge)
                  {
                    type: 'link' as const,
                    content: '$t:nav.docs',
                    props: {
                      href: '$t:nav.docs.href',
                      className: desktopClass('docs'),
                      ...(activePage === 'docs' ? { 'aria-current': 'page' } : {}),
                    },
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

                  // GitHub icon link
                  {
                    type: 'link' as const,
                    props: {
                      href: 'https://github.com/sovrium/sovrium',
                      target: '_blank',
                      rel: 'noopener noreferrer',
                      className:
                        'inline-flex items-center justify-center w-9 h-9 opacity-70 hover:opacity-100 transition-opacity duration-200',
                      'aria-label': 'Sovrium on GitHub',
                    },
                    children: [
                      {
                        type: 'img' as const,
                        props: {
                          src: githubIconSrc,
                          alt: 'GitHub',
                          className: 'h-5 w-5',
                        },
                      },
                    ],
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

                  // Globe language switcher icon (hidden at md, shown at lg+)
                  {
                    type: 'div' as const,
                    props: {
                      className: 'hidden lg:block',
                    },
                    children: [
                      {
                        type: 'link' as const,
                        props: {
                          href: '#',
                          className:
                            'inline-flex items-center justify-center w-8 h-8 rounded-md text-sovereignty-gray-500 hover:text-sovereignty-light hover:bg-sovereignty-gray-800 transition-colors duration-150',
                          'data-lang-switch': '$t:nav.lang.code',
                          'aria-label': 'Switch language',
                          title: '$t:nav.lang.label',
                        },
                        children: [
                          {
                            type: 'icon' as const,
                            props: { name: 'globe', size: 16 },
                          },
                        ],
                      },
                    ],
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
          // Uses absolute positioning with explicit viewport-height sizing.
          // The `height: 100dvh` combined with `top: 100%` (below the navbar)
          // ensures the opaque dark background covers all page content.
          // overflow-hidden on the outer div clips at maxHeight (animated by JS);
          // overflow-y-auto on the inner div allows scrolling within the menu.
          {
            type: 'div' as const,
            props: {
              className:
                'hidden md:hidden absolute top-full left-0 w-full shadow-xl overflow-hidden z-50',
              style: 'background-color:#050810;transition:max-height 300ms ease-in-out',
              id: 'mobile-menu',
            },
            children: [
              {
                type: 'div' as const,
                props: {
                  className: 'max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-4 overflow-y-auto',
                  style: 'height:calc(100dvh - 4rem)',
                },
                children: [
                  // ── Group 1: Search (first item in mobile menu) ────
                  {
                    type: 'div' as const,
                    props: {
                      className: 'mb-3',
                    },
                    children: [
                      {
                        type: 'button' as const,
                        props: {
                          'data-search-btn': 'true',
                          type: 'button',
                          className:
                            'flex items-center gap-3 w-full h-12 px-4 rounded-lg border border-sovereignty-gray-700 bg-sovereignty-gray-900/50 text-sovereignty-gray-400 hover:text-sovereignty-light hover:border-sovereignty-gray-500 transition-colors duration-150 cursor-pointer',
                        },
                        children: [
                          {
                            type: 'icon' as const,
                            props: {
                              name: 'search',
                              size: 18,
                              className: 'shrink-0',
                            },
                          },
                          {
                            type: 'span' as const,
                            content: '$t:nav.search.placeholder',
                            props: {
                              className: 'text-base font-medium flex-1 text-left',
                            },
                          },
                          {
                            type: 'span' as const,
                            content: '$t:nav.search.shortcut',
                            props: {
                              className:
                                'text-[10px] text-sovereignty-gray-600 border border-sovereignty-gray-700 rounded px-1.5 py-0.5 font-medium',
                            },
                          },
                        ],
                      },
                    ],
                  },

                  // ── Group 2: Navigation links ──────────────────────
                  {
                    type: 'nav' as const,
                    props: {
                      className: 'space-y-1',
                      'aria-label': 'Mobile navigation',
                    },
                    children: [
                      {
                        type: 'link' as const,
                        content: '$t:nav.docs',
                        props: {
                          href: '$t:nav.docs.href',
                          className: mobileClass('docs'),
                          ...(activePage === 'docs' ? { 'aria-current': 'page' } : {}),
                        },
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
                    ],
                  },

                  // ── Separator ──────────────────────────────────────
                  {
                    type: 'div' as const,
                    props: {
                      className: 'h-px bg-sovereignty-gray-800 my-3',
                      'aria-hidden': 'true',
                    },
                  },

                  // ── Group 3: Utility links (GitHub) ────────────────
                  {
                    type: 'div' as const,
                    props: {
                      className: 'space-y-1',
                    },
                    children: [
                      // GitHub link (mobile)
                      {
                        type: 'link' as const,
                        props: {
                          href: 'https://github.com/sovrium/sovrium',
                          target: '_blank',
                          rel: 'noopener noreferrer',
                          className:
                            'flex items-center gap-3 text-sovereignty-gray-300 hover:text-sovereignty-light hover:bg-sovereignty-gray-800 transition-colors duration-150 text-base font-medium px-4 py-3 rounded-lg',
                          'aria-label': 'Sovrium on GitHub',
                        },
                        children: [
                          {
                            type: 'img' as const,
                            props: {
                              src: githubIconSrc,
                              alt: 'GitHub',
                              className: 'h-5 w-5',
                            },
                          },
                          {
                            type: 'span' as const,
                            content: 'GitHub',
                          },
                        ],
                      },
                    ],
                  },

                  // ── Separator ──────────────────────────────────────
                  {
                    type: 'div' as const,
                    props: {
                      className: 'h-px bg-sovereignty-gray-800 my-3',
                      'aria-hidden': 'true',
                    },
                  },

                  // ── Group 4: CTA + Language switcher ───────────────
                  {
                    type: 'div' as const,
                    props: {
                      className: 'space-y-3',
                    },
                    children: [
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

                      // Language switcher (mobile) — inline row
                      {
                        type: 'div' as const,
                        props: {
                          className: 'flex items-center justify-between px-4',
                        },
                        children: [
                          {
                            type: 'span' as const,
                            content: '$t:nav.lang.switch.label',
                            props: {
                              className: 'text-sm text-sovereignty-gray-500',
                            },
                          },
                          {
                            type: 'link' as const,
                            content: '$t:nav.lang.label',
                            props: {
                              href: '#',
                              className:
                                'text-sm font-medium text-sovereignty-gray-300 hover:text-sovereignty-light transition-colors duration-150 px-3 py-1.5 rounded-md border border-sovereignty-gray-700 hover:border-sovereignty-gray-500',
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
          },
        ],
      },
    ],
  }
}
