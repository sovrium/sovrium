/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { docsPage } from './shared'

export const docsAnalytics = docsPage({
  activeId: 'analytics',
  path: '/docs/analytics',
  metaTitle: '$t:docs.analytics.meta.title',
  metaDescription: '$t:docs.analytics.meta.description',
  content: [
    {
      type: 'div',
      props: {},
      children: [
        {
          type: 'h1',
          content: '$t:docs.analytics.title',
          props: {
            className: 'text-3xl sm:text-4xl font-bold mb-2 text-sovereignty-light',
          },
        },
        {
          type: 'paragraph',
          content: '$t:docs.analytics.description',
          props: { className: 'text-sovereignty-gray-400 mb-6' },
        },
        {
          $ref: 'docs-code-block',
          vars: {
            code: '# Simple: enable with defaults\nanalytics: true\n\n# Advanced: configure options\nanalytics:\n  retentionDays: 90\n  respectDoNotTrack: true\n  excludePaths:\n    - /admin\n    - /api\n  sessionTimeout: 30',
          },
        },
        {
          type: 'paragraph',
          content: '$t:docs.analytics.details',
          props: {
            className: 'text-sm text-sovereignty-gray-400 mt-4',
          },
        },
      ],
    },
  ],
})
