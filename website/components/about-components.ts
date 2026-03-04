/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { ComponentTemplate } from '@/index'

// ─── value-card: About page principle card with icon, title, description ─────
// Used in about.ts principles section (5 cards)
// vars: { key: 'sovereignty' | 'transparency' | 'simplicity' | 'minimalDeps' | 'ownership' }
export const valueCard: ComponentTemplate = {
  name: 'value-card',
  type: 'card',
  props: {
    className:
      'bg-sovereignty-gray-900 border border-sovereignty-gray-800 p-8 rounded-lg hover:border-sovereignty-accent transition-colors duration-300',
  },
  children: [
    {
      type: 'div',
      props: { className: 'text-3xl mb-4' },
      content: '$t:about.principles.$key.icon',
    },
    {
      type: 'h3',
      content: '$t:about.principles.$key.title',
      props: { className: 'text-xl font-semibold mb-3 text-sovereignty-light' },
    },
    {
      type: 'paragraph',
      content: '$t:about.principles.$key.description',
      props: { className: 'text-sovereignty-gray-400 leading-relaxed' },
    },
  ],
}
