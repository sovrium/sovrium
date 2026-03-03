/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { docsPage } from './shared'

export const docsAuth = docsPage({
  activeId: 'auth',
  path: '/docs/auth',
  metaTitle: '$t:docs.auth.meta.title',
  metaDescription: '$t:docs.auth.meta.description',
  content: [
    {
      type: 'div',
      props: {},
      children: [
        {
          type: 'h1',
          content: '$t:docs.auth.title',
          props: {
            className: 'text-3xl sm:text-4xl font-bold mb-2 text-sovereignty-light',
          },
        },
        {
          type: 'paragraph',
          content: '$t:docs.auth.description',
          props: { className: 'text-sovereignty-gray-400 mb-6' },
        },
        {
          type: 'grid',
          props: {
            className: 'grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6',
          },
          children: [
            {
              $ref: 'docs-info-card',
              vars: {
                title: '$t:docs.auth.strategies.title',
                description: '$t:docs.auth.strategies.description',
              },
            },
            {
              $ref: 'docs-info-card',
              vars: {
                title: '$t:docs.auth.roles.title',
                description: '$t:docs.auth.roles.description',
              },
            },
            {
              $ref: 'docs-info-card',
              vars: {
                title: '$t:docs.auth.twoFactor.title',
                description: '$t:docs.auth.twoFactor.description',
              },
            },
            {
              $ref: 'docs-info-card',
              vars: {
                title: '$t:docs.auth.emails.title',
                description: '$t:docs.auth.emails.description',
              },
            },
          ],
        },
        {
          $ref: 'docs-code-block',
          vars: {
            code: 'auth:\n  strategies:\n    - type: email-password\n    - type: magic-link\n    - type: oauth\n      provider: google\n  defaultRole: member\n  roles:\n    - name: editor\n      description: Can edit content\n  twoFactor: true\n  emails:\n    verification:\n      subject: "Verify your email, $name"\n      body: "Click here to verify: $url"',
          },
        },
      ],
    },
  ],
})
