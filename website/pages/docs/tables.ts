/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { badgeGroup, calloutTip, codeBlock, docsPage, propertyTable, sectionHeader } from './shared'

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
        sectionHeader(
          '$t:docs.tables.structure.title',
          '$t:docs.tables.structure.description',
          'table-structure'
        ),
        codeBlock(
          'tables:\n  - id: 1\n    name: tasks\n    fields:\n      - id: 1\n        name: title\n        type: single-line-text\n        required: true\n      - id: 2\n        name: completed\n        type: checkbox\n    permissions:\n      create: authenticated\n      read: all\n      update: [admin, member]\n      delete: [admin]\n    indexes:\n      - fields: [title]\n        unique: true',
          'yaml'
        ),
      ],
    },

    // ── Base Field Properties ────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.tables.baseFields.title',
          '$t:docs.tables.baseFields.description',
          'base-fields'
        ),
        propertyTable([
          { name: 'id', description: '$t:docs.tables.baseFields.id' },
          { name: 'name', description: '$t:docs.tables.baseFields.name' },
          { name: 'type', description: '$t:docs.tables.baseFields.type' },
          { name: 'required', description: '$t:docs.tables.baseFields.required' },
          { name: 'unique', description: '$t:docs.tables.baseFields.unique' },
          { name: 'description', description: '$t:docs.tables.baseFields.descriptionProp' },
          { name: 'defaultValue', description: '$t:docs.tables.baseFields.defaultValue' },
        ]),
      ],
    },

    // ── Field Types ──────────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.tables.fieldTypes.title',
          '$t:docs.tables.fieldTypes.description',
          'field-types'
        ),

        // Text Fields
        {
          type: 'paragraph',
          content: '$t:docs.tables.fieldTypes.text.description',
          props: { className: 'text-sm text-sovereignty-gray-400 mb-2' },
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
        codeBlock(
          'fields:\n  - id: 1\n    name: title\n    type: single-line-text\n    required: true\n  - id: 2\n    name: notes\n    type: rich-text',
          'yaml'
        ),

        // Numeric Fields
        {
          type: 'paragraph',
          content: '$t:docs.tables.fieldTypes.numeric.description',
          props: { className: 'text-sm text-sovereignty-gray-400 mb-2 mt-6' },
        },
        badgeGroup('$t:docs.tables.fieldTypes.numeric', [
          'number',
          'currency',
          'percent',
          'rating',
        ]),
        codeBlock(
          'fields:\n  - id: 1\n    name: price\n    type: currency\n    options:\n      symbol: "$"\n      precision: 2\n  - id: 2\n    name: satisfaction\n    type: rating\n    options:\n      max: 5',
          'yaml'
        ),

        // Selection Fields
        {
          type: 'paragraph',
          content: '$t:docs.tables.fieldTypes.selection.description',
          props: { className: 'text-sm text-sovereignty-gray-400 mb-2 mt-6' },
        },
        badgeGroup('$t:docs.tables.fieldTypes.selection', [
          'single-select',
          'multi-select',
          'checkbox',
          'status',
        ]),
        codeBlock(
          'fields:\n  - id: 1\n    name: priority\n    type: single-select\n    options:\n      - label: Low\n        color: gray\n      - label: Medium\n        color: yellow\n      - label: High\n        color: red',
          'yaml'
        ),

        // Remaining categories (compact badge groups)
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
        sectionHeader(
          '$t:docs.tables.permissions.title',
          '$t:docs.tables.permissions.description',
          'permissions'
        ),
        codeBlock(
          'permissions:\n  create: authenticated       # Any logged-in user\n  read: all                   # Public access\n  update: [admin, member]     # Specific roles\n  delete: [admin]             # Admin only\n  comment: authenticated',
          'yaml'
        ),
        calloutTip('$t:docs.tables.permissions.tip.title', '$t:docs.tables.permissions.tip.body'),
      ],
    },
  ],
})
