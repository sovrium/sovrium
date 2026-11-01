/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// The console shell's two hidden hosts, placed after the palette and outside the SPA swap
// region (`#admin-surface-content`), so a swap never unmounts them: the SPA nav island, and
// the offline notice it clones when a navigation fails.

import type { TemplateNodeEncoded } from '@/domain/models/app/components'

export const consoleSpaNavHost: TemplateNodeEncoded = {
  type: 'container',
  element: 'div',
  props: {
    className: 'hidden',
    'data-island': 'admin-spa-nav',
    'data-island-props': '{}',
  },
  children: [
    {
      type: 'text',
      element: 'span',
      props: {
        className: 'sr-only',
      },
      content: '',
    },
  ],
}

export const consoleOfflineHost: TemplateNodeEncoded = {
  type: 'container',
  element: 'div',
  props: {
    className: 'hidden',
    'data-spa-offline-template': 'true',
  },
  children: [
    {
      type: 'container',
      element: 'div',
      props: {
        role: 'status',
        className:
          'border-border bg-muted text-foreground m-4 flex items-center justify-between gap-4 rounded-md border px-4 py-3 text-sm',
      },
      children: [
        {
          type: 'text',
          element: 'p',
          content: '$t:admin.offline.message',
        },
        {
          type: 'button',
          variant: 'outline',
          content: '$t:admin.offline.retry',
          props: {
            type: 'button',
            'data-spa-retry': 'true',
          },
        },
      ],
    },
  ],
}
