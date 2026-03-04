/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { calloutTip, codeBlock, docsPage, propertyTable, sectionHeader } from './shared'

export const docsAnalytics = docsPage({
  activeId: 'analytics',
  path: '/docs/analytics',
  metaTitle: '$t:docs.analytics.meta.title',
  metaDescription: '$t:docs.analytics.meta.description',
  content: [
    // ── Title ────────────────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        {
          type: 'h1',
          content: '$t:docs.analytics.title',
          props: {
            className: 'text-3xl sm:text-4xl font-bold mb-4 text-sovereignty-light',
          },
        },
        {
          type: 'paragraph',
          content: '$t:docs.analytics.description',
          props: { className: 'text-base text-sovereignty-gray-300 max-w-3xl leading-relaxed' },
        },
      ],
    },

    // ── How It Works ───────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.analytics.howItWorks.title',
          '$t:docs.analytics.howItWorks.description',
          'how-it-works'
        ),
        {
          type: 'grid',
          props: { className: 'grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6' },
          children: [
            {
              $ref: 'docs-info-card',
              vars: {
                title: '$t:docs.analytics.howItWorks.collect.title',
                description: '$t:docs.analytics.howItWorks.collect.description',
              },
            },
            {
              $ref: 'docs-info-card',
              vars: {
                title: '$t:docs.analytics.howItWorks.store.title',
                description: '$t:docs.analytics.howItWorks.store.description',
              },
            },
            {
              $ref: 'docs-info-card',
              vars: {
                title: '$t:docs.analytics.howItWorks.query.title',
                description: '$t:docs.analytics.howItWorks.query.description',
              },
            },
          ],
        },
      ],
    },

    // ── Quick Enable ─────────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.analytics.quickEnable.title',
          '$t:docs.analytics.quickEnable.description',
          'quick-enable'
        ),
        codeBlock('# Boolean shorthand — enables all defaults\nanalytics: true', 'yaml'),
        calloutTip(
          '$t:docs.analytics.booleanVsObject.title',
          '$t:docs.analytics.booleanVsObject.description'
        ),
      ],
    },

    // ── Advanced Configuration ───────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.analytics.advanced.title',
          '$t:docs.analytics.advanced.description',
          'advanced-config'
        ),
        codeBlock(
          'analytics:\n  retentionDays: 90\n  respectDoNotTrack: true\n  excludePaths:\n    - /admin\n    - /api\n  sessionTimeout: 30',
          'yaml'
        ),
        propertyTable([
          { name: 'retentionDays', description: '$t:docs.analytics.props.retentionDays' },
          { name: 'respectDoNotTrack', description: '$t:docs.analytics.props.respectDoNotTrack' },
          { name: 'excludePaths', description: '$t:docs.analytics.props.excludePaths' },
          { name: 'sessionTimeout', description: '$t:docs.analytics.props.sessionTimeout' },
        ]),
      ],
    },

    // ── Privacy ──────────────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        calloutTip('$t:docs.analytics.privacy.title', '$t:docs.analytics.privacy.body'),
        {
          type: 'paragraph',
          content: '$t:docs.analytics.details',
          props: {
            className: 'text-sm text-sovereignty-gray-400 mt-2',
          },
        },
      ],
    },
  ],
})
