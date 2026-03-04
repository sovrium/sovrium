/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  badgeGroup,
  calloutWarning,
  codeBlock,
  docsPage,
  endpointGroup,
  endpointRow,
  sectionHeader,
} from './shared'

// ─── Page Definition ──────────────────────────────────────────────────────────

export const docsApiReference = docsPage({
  activeId: 'api-reference',
  path: '/docs/api-reference',
  metaTitle: '$t:docs.apiReference.meta.title',
  metaDescription: '$t:docs.apiReference.meta.description',
  toc: [
    { label: '$t:docs.apiReference.baseUrl.title', anchor: 'base-url' },
    { label: '$t:docs.apiReference.health.title', anchor: 'health' },
    { label: '$t:docs.apiReference.tables.title', anchor: 'tables' },
    {
      label: '$t:docs.apiReference.records.title',
      anchor: 'records',
      children: [
        { label: '$t:docs.apiReference.records.crud.title', anchor: 'records-crud' },
        { label: '$t:docs.apiReference.records.batch.title', anchor: 'records-batch' },
        { label: '$t:docs.apiReference.records.lifecycle.title', anchor: 'records-lifecycle' },
        { label: '$t:docs.apiReference.records.comments.title', anchor: 'records-comments' },
      ],
    },
    { label: '$t:docs.apiReference.views.title', anchor: 'views' },
    { label: '$t:docs.apiReference.activity.title', anchor: 'activity' },
    { label: '$t:docs.apiReference.analyticsEndpoints.title', anchor: 'analytics-endpoints' },
    { label: '$t:docs.apiReference.auth.title', anchor: 'authentication' },
    { label: '$t:docs.apiReference.features.title', anchor: 'features' },
    { label: '$t:docs.apiReference.openapi.title', anchor: 'openapi-schema' },
  ],
  content: [
    // ── Title ────────────────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        {
          type: 'h1',
          content: '$t:docs.apiReference.title',
          props: {
            className: 'text-3xl sm:text-4xl font-bold mb-4 text-sovereignty-light',
          },
        },
        {
          type: 'paragraph',
          content: '$t:docs.apiReference.description',
          props: { className: 'text-base text-sovereignty-gray-300 max-w-3xl leading-relaxed' },
        },
      ],
    },

    // ── Early Preview Callout ──────────────────────────────────────────
    calloutWarning(
      '$t:docs.apiReference.earlyPreview.title',
      '$t:docs.apiReference.earlyPreview.body'
    ),

    // ── Interactive Explorer CTA ──────────────────────────────────────
    {
      type: 'div',
      props: {
        className:
          'flex flex-col sm:flex-row items-start sm:items-center gap-4 p-5 rounded-lg border border-sovereignty-accent/30 bg-sovereignty-accent/5',
      },
      children: [
        {
          type: 'div',
          props: { className: 'flex-1' },
          children: [
            {
              type: 'h3',
              content: '$t:docs.apiReference.cta.title',
              props: { className: 'text-base font-semibold text-sovereignty-light mb-1' },
            },
            {
              type: 'paragraph',
              content: '$t:docs.apiReference.cta.description',
              props: { className: 'text-sm text-sovereignty-gray-400' },
            },
          ],
        },
        {
          type: 'link',
          props: {
            href: '$t:docs.apiReference.cta.href',
            target: '_blank',
            rel: 'noopener noreferrer',
            className:
              'inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-sovereignty-accent text-white font-medium text-sm hover:bg-sovereignty-accent/90 transition-colors shrink-0',
          },
          children: [
            { type: 'span', content: '$t:docs.apiReference.cta.button', props: {} },
            {
              type: 'span',
              content: '\u2197',
              props: { className: 'text-xs' },
            },
          ],
        },
      ],
    },

    // ── Base URL ──────────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.apiReference.baseUrl.title',
          '$t:docs.apiReference.baseUrl.description',
          'base-url'
        ),
        codeBlock('http://localhost:3000/api', 'text'),
      ],
    },

    // ── Health ────────────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.apiReference.health.title',
          '$t:docs.apiReference.health.description',
          'health'
        ),
        endpointGroup('', '', [
          endpointRow('GET', '/api/health', '$t:docs.apiReference.health.get'),
        ]),
      ],
    },

    // ── Tables ────────────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.apiReference.tables.title',
          '$t:docs.apiReference.tables.description',
          'tables'
        ),
        endpointGroup('', '', [
          endpointRow('GET', '/api/tables', '$t:docs.apiReference.tables.list'),
          endpointRow('GET', '/api/tables/{tableId}', '$t:docs.apiReference.tables.get'),
          endpointRow(
            'GET',
            '/api/tables/{tableId}/permissions',
            '$t:docs.apiReference.tables.permissions'
          ),
        ]),
      ],
    },

    // ── Records ───────────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.apiReference.records.title',
          '$t:docs.apiReference.records.description',
          'records'
        ),
        endpointGroup(
          '$t:docs.apiReference.records.crud.title',
          '',
          [
            endpointRow(
              'GET',
              '/api/tables/{tableId}/records',
              '$t:docs.apiReference.records.list'
            ),
            endpointRow(
              'POST',
              '/api/tables/{tableId}/records',
              '$t:docs.apiReference.records.create'
            ),
            endpointRow(
              'GET',
              '/api/tables/{tableId}/records/{recordId}',
              '$t:docs.apiReference.records.get'
            ),
            endpointRow(
              'PATCH',
              '/api/tables/{tableId}/records/{recordId}',
              '$t:docs.apiReference.records.update'
            ),
            endpointRow(
              'DELETE',
              '/api/tables/{tableId}/records/{recordId}',
              '$t:docs.apiReference.records.delete'
            ),
          ],
          'records-crud'
        ),
        endpointGroup(
          '$t:docs.apiReference.records.batch.title',
          '',
          [
            endpointRow(
              'POST',
              '/api/tables/{tableId}/records/batch',
              '$t:docs.apiReference.records.batchCreate'
            ),
            endpointRow(
              'PATCH',
              '/api/tables/{tableId}/records/batch',
              '$t:docs.apiReference.records.batchUpdate'
            ),
            endpointRow(
              'DELETE',
              '/api/tables/{tableId}/records/batch',
              '$t:docs.apiReference.records.batchDelete'
            ),
            endpointRow(
              'POST',
              '/api/tables/{tableId}/records/upsert',
              '$t:docs.apiReference.records.upsert'
            ),
          ],
          'records-batch'
        ),
        endpointGroup(
          '$t:docs.apiReference.records.lifecycle.title',
          '',
          [
            endpointRow('GET', '/api/tables/{tableId}/trash', '$t:docs.apiReference.records.trash'),
            endpointRow(
              'POST',
              '/api/tables/{tableId}/records/{recordId}/restore',
              '$t:docs.apiReference.records.restore'
            ),
            endpointRow(
              'POST',
              '/api/tables/{tableId}/records/batch/restore',
              '$t:docs.apiReference.records.batchRestore'
            ),
            endpointRow(
              'GET',
              '/api/tables/{tableId}/records/{recordId}/history',
              '$t:docs.apiReference.records.history'
            ),
          ],
          'records-lifecycle'
        ),
        endpointGroup(
          '$t:docs.apiReference.records.comments.title',
          '',
          [
            endpointRow(
              'GET',
              '/api/tables/{tableId}/records/{recordId}/comments',
              '$t:docs.apiReference.records.commentsList'
            ),
            endpointRow(
              'POST',
              '/api/tables/{tableId}/records/{recordId}/comments',
              '$t:docs.apiReference.records.commentsCreate'
            ),
            endpointRow(
              'GET',
              '.../{recordId}/comments/{commentId}',
              '$t:docs.apiReference.records.commentsGet'
            ),
            endpointRow(
              'PATCH',
              '.../{recordId}/comments/{commentId}',
              '$t:docs.apiReference.records.commentsUpdate'
            ),
            endpointRow(
              'DELETE',
              '.../{recordId}/comments/{commentId}',
              '$t:docs.apiReference.records.commentsDelete'
            ),
          ],
          'records-comments'
        ),
      ],
    },

    // ── Views ─────────────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.apiReference.views.title',
          '$t:docs.apiReference.views.description',
          'views'
        ),
        endpointGroup('', '', [
          endpointRow('GET', '/api/tables/{tableId}/views', '$t:docs.apiReference.views.list'),
          endpointRow(
            'GET',
            '/api/tables/{tableId}/views/{viewId}',
            '$t:docs.apiReference.views.get'
          ),
          endpointRow(
            'GET',
            '/api/tables/{tableId}/views/{viewId}/records',
            '$t:docs.apiReference.views.records'
          ),
        ]),
      ],
    },

    // ── Activity ──────────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.apiReference.activity.title',
          '$t:docs.apiReference.activity.description',
          'activity'
        ),
        endpointGroup('', '', [
          endpointRow('GET', '/api/activity', '$t:docs.apiReference.activity.list'),
          endpointRow('GET', '/api/activity/{activityId}', '$t:docs.apiReference.activity.get'),
        ]),
      ],
    },

    // ── Analytics ─────────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.apiReference.analyticsEndpoints.title',
          '$t:docs.apiReference.analyticsEndpoints.description',
          'analytics-endpoints'
        ),
        endpointGroup('', '', [
          endpointRow(
            'POST',
            '/api/analytics/collect',
            '$t:docs.apiReference.analyticsEndpoints.collect'
          ),
          endpointRow(
            'GET',
            '/api/analytics/overview',
            '$t:docs.apiReference.analyticsEndpoints.overview'
          ),
          endpointRow(
            'GET',
            '/api/analytics/pages',
            '$t:docs.apiReference.analyticsEndpoints.pages'
          ),
          endpointRow(
            'GET',
            '/api/analytics/referrers',
            '$t:docs.apiReference.analyticsEndpoints.referrers'
          ),
          endpointRow(
            'GET',
            '/api/analytics/devices',
            '$t:docs.apiReference.analyticsEndpoints.devices'
          ),
          endpointRow(
            'GET',
            '/api/analytics/campaigns',
            '$t:docs.apiReference.analyticsEndpoints.campaigns'
          ),
        ]),
      ],
    },

    // ── Authentication ────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.apiReference.auth.title',
          '$t:docs.apiReference.auth.description',
          'authentication'
        ),
        {
          type: 'div',
          props: {
            className:
              'p-4 rounded-lg border border-sovereignty-gray-800 bg-sovereignty-gray-900/30',
          },
          children: [
            {
              type: 'paragraph',
              content: '$t:docs.apiReference.auth.summary',
              props: { className: 'text-sm text-sovereignty-gray-300 leading-relaxed' },
            },
            {
              type: 'div',
              props: { className: 'flex flex-wrap gap-3 mt-3' },
              children: [
                {
                  type: 'link',
                  props: {
                    href: '$t:docs.sidebar.auth.href',
                    className:
                      'text-sm text-sovereignty-accent hover:text-sovereignty-accent/80 transition-colors',
                  },
                  children: [
                    {
                      type: 'span',
                      content: '$t:docs.apiReference.auth.configLink',
                      props: {},
                    },
                  ],
                },
                {
                  type: 'link',
                  props: {
                    href: '$t:docs.apiReference.cta.href',
                    target: '_blank',
                    rel: 'noopener noreferrer',
                    className:
                      'text-sm text-sovereignty-accent hover:text-sovereignty-accent/80 transition-colors',
                  },
                  children: [
                    {
                      type: 'span',
                      content: '$t:docs.apiReference.auth.scalarLink',
                      props: {},
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },

    // ── Cross-Cutting Features ────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.apiReference.features.title',
          '$t:docs.apiReference.features.description',
          'features'
        ),
        badgeGroup('', [
          'Pagination',
          'Soft Deletes',
          'RBAC',
          'Rate Limiting',
          'Field-Level Permissions',
          'OpenAPI 3.1',
        ]),
      ],
    },

    // ── OpenAPI Schema ────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.apiReference.openapi.title',
          '$t:docs.apiReference.openapi.description',
          'openapi-schema'
        ),
        codeBlock('curl https://your-instance.com/schemas/latest/app.openapi.json', 'bash'),
        {
          type: 'div',
          props: { className: 'mt-3' },
          children: [
            {
              type: 'link',
              props: {
                href: '/schemas/latest/app.openapi.json',
                target: '_blank',
                rel: 'noopener noreferrer',
                className:
                  'inline-flex items-center gap-2 text-sm text-sovereignty-accent hover:text-sovereignty-accent/80 transition-colors',
              },
              children: [
                {
                  type: 'span',
                  content: '$t:docs.apiReference.openapi.download',
                  props: {},
                },
                { type: 'span', content: '\u2197', props: { className: 'text-xs' } },
              ],
            },
          ],
        },
      ],
    },
  ],
})
