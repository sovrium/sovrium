/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { favicons } from '../favicons'
import type { PageConfig } from '@/index'

// ─── Scalar Theme Customization ─────────────────────────────────────────────
// Custom CSS to make Scalar blend with the Sovrium dark theme.

const scalarCustomStyles = [
  {
    type: 'style' as const,
    attributes: { type: 'text/css' },
    content: [
      // Override Scalar's default theme with Sovrium brand colors
      '.scalar-api-reference {',
      '  --scalar-background-1: #050810 !important;',
      '  --scalar-background-2: #0a0e1a !important;',
      '  --scalar-background-3: #111827 !important;',
      '  --scalar-background-accent: #050810 !important;',
      '  --scalar-color-1: #e8ecf4 !important;',
      '  --scalar-color-2: #d1d5db !important;',
      '  --scalar-color-3: #9ca3af !important;',
      '  --scalar-color-accent: #3b82f6 !important;',
      '  --scalar-color-green: #10b981 !important;',
      '  --scalar-color-red: #ef4444 !important;',
      '  --scalar-color-yellow: #f59e0b !important;',
      '  --scalar-color-blue: #3b82f6 !important;',
      '  --scalar-color-orange: #f97316 !important;',
      '  --scalar-color-purple: #8b5cf6 !important;',
      '  --scalar-border-color: #1f2937 !important;',
      '  --scalar-scrollbar-color: #374151 !important;',
      '  --scalar-scrollbar-color-active: #4b5563 !important;',
      '  --scalar-sidebar-background-1: #050810 !important;',
      '  --scalar-sidebar-color-1: #e8ecf4 !important;',
      '  --scalar-sidebar-color-2: #9ca3af !important;',
      '  --scalar-sidebar-color-active: #3b82f6 !important;',
      '  --scalar-sidebar-border-color: #1f2937 !important;',
      '  --scalar-sidebar-search-background: #111827 !important;',
      '  --scalar-sidebar-search-border-color: #1f2937 !important;',
      '  --scalar-sidebar-search-color: #e8ecf4 !important;',
      '  --scalar-button-1: #3b82f6 !important;',
      '  --scalar-button-1-color: #ffffff !important;',
      '  --scalar-button-1-hover: #2563eb !important;',
      '  font-family: Inter, system-ui, -apple-system, sans-serif !important;',
      '}',
      // Full-page layout: Scalar fills viewport and handles its own scrolling
      'html, body { margin: 0; padding: 0; height: 100%; }',
      '#scalar-api-reference { min-height: 100vh; }',
      // Remove Scalar's own header/top bar
      '.scalar-api-reference .scalar-api-reference__header { display: none !important; }',
    ].join('\n'),
  },
]

// ─── Scalar Initialization Script ───────────────────────────────────────────

const scalarInitScript = {
  code: [
    '(function(){',
    'function init(){',
    'Scalar.createApiReference("#scalar-api-reference",{',
    'url:"/schemas/latest/app.openapi.json",',
    'darkMode:true,',
    'hideDarkModeToggle:true,',
    'withDefaultFonts:false,',
    'showSidebar:true,',
    'searchHotKey:"k",',
    'defaultHttpClient:{targetKey:"javascript",clientKey:"fetch"},',
    'metaData:{title:"Sovrium API Reference"}',
    '});}',
    'if(typeof Scalar!=="undefined"){init();return}',
    'var attempts=0;',
    'var timer=setInterval(function(){',
    'attempts++;',
    'if(typeof Scalar!=="undefined"){clearInterval(timer);init()}',
    'else if(attempts>100){clearInterval(timer);console.error("Scalar CDN failed to load")}',
    '},100);',
    '})();',
  ].join(''),
  position: 'body-end' as const,
}

// ─── Page Definition ────────────────────────────────────────────────────────
// Full-page Scalar API explorer — no navbar or footer, Scalar takes 100vh.

export const docsScalar: PageConfig = {
  name: 'docs-scalar',
  path: '/docs/scalar',
  meta: {
    title: '$t:docs.scalar.meta.title',
    description: '$t:docs.scalar.meta.description',
    author: 'ESSENTIAL SERVICES',
    favicons,
    openGraph: {
      title: '$t:docs.scalar.meta.title',
      description: '$t:docs.scalar.meta.description',
      type: 'website',
      url: 'https://sovrium.com/docs/scalar',
      image: 'https://sovrium.com/og-image.png',
      siteName: 'Sovrium',
    },
    twitter: {
      card: 'summary_large_image',
      title: '$t:docs.scalar.meta.title',
      description: '$t:docs.scalar.meta.description',
      image: 'https://sovrium.com/og-image.png',
    },
    customElements: scalarCustomStyles,
  },
  scripts: {
    externalScripts: [
      {
        src: 'https://cdn.jsdelivr.net/npm/@scalar/api-reference',
        async: true,
        position: 'body-end',
      },
    ],
    inlineScripts: [scalarInitScript],
  },
  sections: [
    // ── Full-page Scalar Embed ──────────────────────────────────────────────
    {
      type: 'section',
      props: {
        className: 'bg-sovereignty-darker',
      },
      children: [
        {
          type: 'div',
          props: {
            id: 'scalar-api-reference',
            className: 'w-full',
            style: 'min-height:100vh',
          },
          children: [
            // Loading placeholder
            {
              type: 'div',
              props: {
                className: 'flex items-center justify-center h-full text-sovereignty-gray-400',
              },
              children: [
                {
                  type: 'div',
                  props: { className: 'text-center' },
                  children: [
                    {
                      type: 'div',
                      props: {
                        className:
                          'inline-block w-8 h-8 border-2 border-sovereignty-gray-700 border-t-sovereignty-accent rounded-full mb-4',
                        style: 'animation:spin 1s linear infinite',
                      },
                    },
                    {
                      type: 'paragraph',
                      content: '$t:docs.scalar.loading',
                      props: { className: 'text-sm' },
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
