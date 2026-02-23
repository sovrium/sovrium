/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { ComponentTemplate } from '@/index'

// ─── sovrium-badge: Fixed "Built with Sovrium" badge ──────────────────────
// Used across all pages as the last section
// No vars needed (shorthand syntax: { component: 'sovrium-badge' })
export const sovriumBadge: ComponentTemplate = {
  name: 'sovrium-badge',
  type: 'div',
  props: {
    className: 'fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 hidden sm:block',
  },
  children: [
    {
      type: 'link',
      props: {
        href: 'https://github.com/sovrium/sovrium',
        className:
          'flex items-center gap-2 bg-sovereignty-gray-900 hover:bg-sovereignty-gray-800 border border-sovereignty-gray-700 hover:border-sovereignty-accent text-sovereignty-gray-400 hover:text-sovereignty-accent px-3 py-2 rounded-lg text-xs font-medium transition-all duration-300 shadow-lg',
        target: '_blank',
        rel: 'noopener noreferrer',
      },
      children: [
        { type: 'span', content: '\u26A1', props: { className: 'text-sm' } },
        { type: 'span', content: 'Built with Sovrium' },
      ],
    },
  ],
}
