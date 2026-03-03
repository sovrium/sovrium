/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { badgeGroup, docsPage } from './shared'

export const docsTables = docsPage({
  activeId: 'tables',
  path: '/docs/tables',
  metaTitle: '$t:docs.tables.meta.title',
  metaDescription: '$t:docs.tables.meta.description',
  content: [
    // ── Title ────────────────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        {
          type: 'h1',
          content: '$t:docs.tables.title',
          props: {
            className: 'text-3xl sm:text-4xl font-bold mb-2 text-sovereignty-light',
          },
        },
        {
          type: 'paragraph',
          content: '$t:docs.tables.description',
          props: { className: 'text-sovereignty-gray-400 mb-6' },
        },
      ],
    },

    // ── Table Structure ──────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        {
          type: 'h2',
          content: '$t:docs.tables.structure.title',
          props: {
            className: 'text-xl font-semibold mb-3 text-sovereignty-light',
          },
        },
        {
          $ref: 'docs-code-block',
          vars: {
            code: 'tables:\n  - id: 1\n    name: tasks\n    fields:\n      - id: 1\n        name: title\n        type: single-line-text\n        required: true\n      - id: 2\n        name: completed\n        type: checkbox\n    permissions:\n      create: authenticated\n      read: all\n      update: [admin, member]\n      delete: [admin]\n    indexes:\n      - fields: [title]\n        unique: true',
          },
        },
      ],
    },

    // ── Base Field Properties ────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        {
          type: 'h2',
          content: '$t:docs.tables.baseFields.title',
          props: {
            className: 'text-xl font-semibold mb-3 text-sovereignty-light',
          },
        },
        {
          type: 'paragraph',
          content: '$t:docs.tables.baseFields.description',
          props: {
            className: 'text-sm text-sovereignty-gray-400 mb-6',
          },
        },
      ],
    },

    // ── Field Types ──────────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        {
          type: 'h2',
          content: '$t:docs.tables.fieldTypes.title',
          props: {
            className: 'text-xl font-semibold mb-3 text-sovereignty-light',
          },
        },
        {
          type: 'paragraph',
          content: '$t:docs.tables.fieldTypes.description',
          props: {
            className: 'text-sm text-sovereignty-gray-400 mb-4',
          },
        },
        badgeGroup('$t:docs.tables.fieldTypes.text', [
          'single-line-text',
          'long-text',
          'rich-text',
          'email',
          'url',
          'phone-number',
          'barcode',
        ]),
        badgeGroup('$t:docs.tables.fieldTypes.numeric', [
          'number',
          'currency',
          'percent',
          'rating',
        ]),
        badgeGroup('$t:docs.tables.fieldTypes.selection', [
          'single-select',
          'multi-select',
          'checkbox',
          'status',
        ]),
        badgeGroup('$t:docs.tables.fieldTypes.dateTime', ['date', 'date-time', 'time']),
        badgeGroup('$t:docs.tables.fieldTypes.user', ['user', 'created-by', 'updated-by']),
        badgeGroup('$t:docs.tables.fieldTypes.relational', ['link', 'lookup']),
        badgeGroup('$t:docs.tables.fieldTypes.media', ['attachment', 'image', 'file', 'signature']),
        badgeGroup('$t:docs.tables.fieldTypes.computed', ['formula', 'auto-number', 'rollup']),
        badgeGroup('$t:docs.tables.fieldTypes.advanced', [
          'json',
          'geo',
          'duration',
          'button',
          'ai-generated',
          'last-modified-time',
          'created-time',
        ]),
      ],
    },

    // ── Permissions ──────────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        {
          type: 'h2',
          content: '$t:docs.tables.permissions.title',
          props: {
            className: 'text-xl font-semibold mb-3 text-sovereignty-light',
          },
        },
        {
          type: 'paragraph',
          content: '$t:docs.tables.permissions.description',
          props: {
            className: 'text-sm text-sovereignty-gray-400 mb-4',
          },
        },
        {
          $ref: 'docs-code-block',
          vars: {
            code: 'permissions:\n  create: authenticated       # Any logged-in user\n  read: all                   # Public access\n  update: [admin, member]     # Specific roles\n  delete: [admin]             # Admin only\n  comment: authenticated',
          },
        },
      ],
    },
  ],
})
