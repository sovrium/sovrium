/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { ComponentTemplate } from '@/index'

// ─── value-card: Company value card with icon, title, description ──────────
// Used in company.ts values section (6 cards)
// vars: { key: 'sovereignty' | 'transparency' | ... }
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
      content: '$t:company.values.$key.icon',
    },
    {
      type: 'h3',
      content: '$t:company.values.$key.title',
      props: { className: 'text-xl font-semibold mb-3 text-sovereignty-light' },
    },
    {
      type: 'paragraph',
      content: '$t:company.values.$key.description',
      props: { className: 'text-sovereignty-gray-400 leading-relaxed' },
    },
  ],
}

// ─── principle-item: Company principle with title and description ──────────
// Used in company.ts principles section (4 items)
// vars: { key: 'configOverCode' | 'minimalDeps' | ... }
export const principleItem: ComponentTemplate = {
  name: 'principle-item',
  type: 'div',
  props: {
    className:
      'bg-sovereignty-gray-900 border border-sovereignty-gray-800 p-6 rounded-lg hover:border-sovereignty-accent transition-colors duration-300',
  },
  children: [
    {
      type: 'h4',
      content: '$t:company.principles.$key.title',
      props: { className: 'text-lg font-semibold mb-2 text-sovereignty-light' },
    },
    {
      type: 'paragraph',
      content: '$t:company.principles.$key.description',
      props: { className: 'text-sm text-sovereignty-gray-400 leading-relaxed' },
    },
  ],
}
