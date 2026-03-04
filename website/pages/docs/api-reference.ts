/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { favicons } from '../favicons'
import { footerI18n } from '../footer'
import { createNavbar, langSwitchScript, mobileMenuScript } from '../navbar'
import type { Page } from '@/index'

// ─── Scalar Initialization Script ─────────────────────────────────────────────
// Loads Scalar API Reference from CDN and initializes it with sovereignty theme.

const scalarInitScript = {
  code: [
    '(function(){',
    'var el=document.getElementById("scalar-api-reference");',
    'if(!el)return;',
    'var s=document.createElement("script");',
    's.src="https://cdn.jsdelivr.net/npm/@scalar/api-reference";',
    's.defer=true;',
    's.onload=function(){',
    'if(typeof Scalar==="undefined"||!Scalar.createApiReference)return;',
    'Scalar.createApiReference("#scalar-api-reference",{',
    'spec:{url:"/api/openapi.json"},',
    'theme:"none",',
    'darkMode:true,',
    'hideDownloadButton:false,',
    'metaData:{title:"Sovrium API Reference"},',
    '});',
    '};',
    'document.body.appendChild(s);',
    '})();',
  ].join(''),
  position: 'body-end' as const,
}

// ─── Custom Styles for Scalar ─────────────────────────────────────────────────
// Override Scalar CSS variables to match sovereignty theme.

const scalarCustomStyles = [
  {
    type: 'style' as const,
    content: [
      '#scalar-api-reference{',
      '--scalar-background-1:#050810;',
      '--scalar-background-2:#0a0e1a;',
      '--scalar-background-3:#111827;',
      '--scalar-color-1:#e8ecf4;',
      '--scalar-color-2:#d1d5db;',
      '--scalar-color-3:#9ca3af;',
      '--scalar-color-accent:#3b82f6;',
      '--scalar-button-1:#3b82f6;',
      '--scalar-button-1-hover:#2563eb;',
      '--scalar-font:Inter,system-ui,-apple-system,sans-serif;',
      '--scalar-font-code:"Fira Code",Monaco,"Courier New",monospace;',
      'min-height:80vh;',
      '}',
    ].join(''),
  },
]

// ─── Page Definition ──────────────────────────────────────────────────────────

export const docsApiReference: Page = {
  name: 'docs-api-reference',
  path: '/docs/api-reference',
  meta: {
    title: '$t:docs.apiReference.meta.title',
    description: '$t:docs.apiReference.meta.description',
    favicons,
    customElements: scalarCustomStyles,
  },
  scripts: {
    inlineScripts: [mobileMenuScript, langSwitchScript, scalarInitScript],
  },
  sections: [
    // ── Navbar ──────────────────────────────────────────────────────────
    createNavbar('docs'),

    // ── Early Preview Banner ────────────────────────────────────────────
    {
      type: 'div',
      props: {
        className:
          'bg-sovereignty-accent/10 border-b border-sovereignty-accent/20 text-center py-2 px-4',
      },
      children: [
        {
          type: 'span',
          content: '$t:docs.apiReference.earlyPreview',
          props: { className: 'text-xs text-sovereignty-accent font-medium' },
        },
      ],
    },

    // ── Scalar API Reference Container ──────────────────────────────────
    {
      type: 'section',
      props: {
        className: 'bg-sovereignty-darker text-sovereignty-light',
      },
      children: [
        {
          type: 'div',
          props: { id: 'scalar-api-reference' },
          children: [
            // Loading state (replaced by Scalar on init)
            {
              type: 'div',
              props: {
                className: 'flex items-center justify-center min-h-[60vh]',
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
                          'animate-spin rounded-full h-8 w-8 border-b-2 border-sovereignty-accent mx-auto mb-4',
                      },
                      children: [],
                    },
                    {
                      type: 'paragraph',
                      content: '$t:docs.apiReference.loading',
                      props: { className: 'text-sovereignty-gray-400 text-sm' },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },

    // ── Footer ──────────────────────────────────────────────────────────
    footerI18n,
  ],
} as Page
