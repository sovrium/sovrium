/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  badgeGroup,
  calloutTip,
  calloutWarning,
  codeBlock,
  docsPage,
  propertyTable,
  sectionHeader,
} from './shared'

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
            className: 'text-3xl sm:text-4xl font-bold mb-4 text-sovereignty-light',
          },
        },
        {
          type: 'paragraph',
          content: '$t:docs.tables.description',
          props: { className: 'text-base text-sovereignty-gray-300 max-w-3xl leading-relaxed' },
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

    // ── Table Properties ──────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.tables.tableProps.title',
          '$t:docs.tables.tableProps.description',
          'table-properties'
        ),
        propertyTable([
          { name: 'id', description: '$t:docs.tables.tableProps.id' },
          { name: 'name', description: '$t:docs.tables.tableProps.name' },
          { name: 'fields', description: '$t:docs.tables.tableProps.fields' },
          { name: 'primaryKey', description: '$t:docs.tables.tableProps.primaryKey' },
          { name: 'indexes', description: '$t:docs.tables.tableProps.indexes' },
          { name: 'uniqueConstraints', description: '$t:docs.tables.tableProps.uniqueConstraints' },
          { name: 'foreignKeys', description: '$t:docs.tables.tableProps.foreignKeys' },
          { name: 'constraints', description: '$t:docs.tables.tableProps.constraints' },
          { name: 'views', description: '$t:docs.tables.tableProps.views' },
          { name: 'permissions', description: '$t:docs.tables.tableProps.permissions' },
          { name: 'allowDestructive', description: '$t:docs.tables.tableProps.allowDestructive' },
        ]),
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
          { name: 'indexed', description: '$t:docs.tables.baseFields.indexed' },
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
        propertyTable([
          { name: 'rich-text.maxLength', description: '$t:docs.tables.fieldTypes.text.maxLength' },
          {
            name: 'rich-text.fullTextSearch',
            description: '$t:docs.tables.fieldTypes.text.fullTextSearch',
          },
          { name: 'barcode.format', description: '$t:docs.tables.fieldTypes.text.barcodeFormat' },
        ]),
        codeBlock(
          'fields:\n  - id: 1\n    name: title\n    type: single-line-text\n    required: true\n  - id: 2\n    name: notes\n    type: rich-text\n    maxLength: 5000\n    fullTextSearch: true',
          'yaml'
        ),

        // Numeric Fields
        {
          type: 'paragraph',
          content: '$t:docs.tables.fieldTypes.numeric.description',
          props: { className: 'text-sm text-sovereignty-gray-400 mb-2 mt-6' },
        },
        badgeGroup('$t:docs.tables.fieldTypes.numeric', [
          'integer',
          'decimal',
          'currency',
          'percentage',
          'rating',
          'progress',
        ]),
        propertyTable([
          { name: 'min / max', description: '$t:docs.tables.fieldTypes.numeric.minMax' },
          { name: 'precision', description: '$t:docs.tables.fieldTypes.numeric.precision' },
          { name: 'currency', description: '$t:docs.tables.fieldTypes.numeric.currency' },
          {
            name: 'symbolPosition',
            description: '$t:docs.tables.fieldTypes.numeric.symbolPosition',
          },
          {
            name: 'thousandsSeparator',
            description: '$t:docs.tables.fieldTypes.numeric.thousandsSep',
          },
          {
            name: 'negativeFormat',
            description: '$t:docs.tables.fieldTypes.numeric.negativeFormat',
          },
          { name: 'rating.max', description: '$t:docs.tables.fieldTypes.numeric.ratingMax' },
          { name: 'rating.style', description: '$t:docs.tables.fieldTypes.numeric.ratingStyle' },
          {
            name: 'progress.color',
            description: '$t:docs.tables.fieldTypes.numeric.progressColor',
          },
        ]),
        codeBlock(
          'fields:\n  - id: 1\n    name: price\n    type: currency\n    currency: USD\n    precision: 2\n    symbolPosition: before\n  - id: 2\n    name: satisfaction\n    type: rating\n    max: 5\n    style: stars',
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
        propertyTable([
          { name: 'options', description: '$t:docs.tables.fieldTypes.selection.options' },
          {
            name: 'options[].label',
            description: '$t:docs.tables.fieldTypes.selection.optionLabel',
          },
          {
            name: 'options[].color',
            description: '$t:docs.tables.fieldTypes.selection.optionColor',
          },
          {
            name: 'maxSelections',
            description: '$t:docs.tables.fieldTypes.selection.maxSelections',
          },
        ]),
        codeBlock(
          'fields:\n  - id: 1\n    name: priority\n    type: single-select\n    options:\n      - label: Low\n        color: gray\n      - label: Medium\n        color: yellow\n      - label: High\n        color: red\n  - id: 2\n    name: tags\n    type: multi-select\n    maxSelections: 5\n    options:\n      - label: Frontend\n        color: blue\n      - label: Backend\n        color: green',
          'yaml'
        ),

        // Date & Time Fields
        {
          type: 'paragraph',
          content: '$t:docs.tables.fieldTypes.dateTime.description',
          props: { className: 'text-sm text-sovereignty-gray-400 mb-2 mt-6' },
        },
        badgeGroup('$t:docs.tables.fieldTypes.dateTime', ['date', 'datetime', 'time', 'duration']),
        propertyTable([
          {
            name: 'dateFormat',
            description: '$t:docs.tables.fieldTypes.dateTime.dateFormat',
          },
          {
            name: 'timeFormat',
            description: '$t:docs.tables.fieldTypes.dateTime.timeFormat',
          },
          {
            name: 'includeTime',
            description: '$t:docs.tables.fieldTypes.dateTime.includeTime',
          },
          {
            name: 'timezone',
            description: '$t:docs.tables.fieldTypes.dateTime.timezone',
          },
          {
            name: 'duration.format',
            description: '$t:docs.tables.fieldTypes.dateTime.durationFormat',
          },
        ]),

        // User & Audit Fields
        badgeGroup('$t:docs.tables.fieldTypes.user', [
          'user',
          'created-by',
          'created-at',
          'updated-by',
          'updated-at',
          'deleted-by',
          'deleted-at',
        ]),
        {
          type: 'paragraph',
          content: '$t:docs.tables.fieldTypes.user.description',
          props: { className: 'text-sm text-sovereignty-gray-400 mb-2' },
        },

        // Media Fields
        badgeGroup('$t:docs.tables.fieldTypes.media', [
          'single-attachment',
          'multiple-attachments',
        ]),
        propertyTable([
          {
            name: 'allowedFileTypes',
            description: '$t:docs.tables.fieldTypes.media.allowedFileTypes',
          },
          { name: 'maxFileSize', description: '$t:docs.tables.fieldTypes.media.maxFileSize' },
          { name: 'maxFiles', description: '$t:docs.tables.fieldTypes.media.maxFiles' },
          { name: 'storage', description: '$t:docs.tables.fieldTypes.media.storage' },
          {
            name: 'generateThumbnail(s)',
            description: '$t:docs.tables.fieldTypes.media.generateThumbnail',
          },
          {
            name: 'storeMetadata',
            description: '$t:docs.tables.fieldTypes.media.storeMetadata',
          },
        ]),

        // Computed Fields
        badgeGroup('$t:docs.tables.fieldTypes.computed', ['formula', 'autonumber']),
        propertyTable([
          { name: 'formula', description: '$t:docs.tables.fieldTypes.computed.formula' },
          { name: 'resultType', description: '$t:docs.tables.fieldTypes.computed.resultType' },
          { name: 'format', description: '$t:docs.tables.fieldTypes.computed.format' },
          { name: 'prefix', description: '$t:docs.tables.fieldTypes.computed.prefix' },
          { name: 'startFrom', description: '$t:docs.tables.fieldTypes.computed.startFrom' },
          { name: 'digits', description: '$t:docs.tables.fieldTypes.computed.digits' },
        ]),
        codeBlock(
          'fields:\n  - id: 1\n    name: total\n    type: formula\n    formula: "price * quantity"\n    resultType: decimal\n  - id: 2\n    name: ticket_number\n    type: autonumber\n    prefix: "TKT-"\n    startFrom: 1000\n    digits: 5',
          'yaml'
        ),

        // Advanced Fields
        badgeGroup('$t:docs.tables.fieldTypes.advanced', [
          'json',
          'array',
          'geolocation',
          'color',
          'button',
        ]),
        propertyTable([
          { name: 'json.schema', description: '$t:docs.tables.fieldTypes.advanced.jsonSchema' },
          { name: 'array.itemType', description: '$t:docs.tables.fieldTypes.advanced.itemType' },
          { name: 'array.maxItems', description: '$t:docs.tables.fieldTypes.advanced.maxItems' },
          { name: 'button.label', description: '$t:docs.tables.fieldTypes.advanced.buttonLabel' },
          { name: 'button.action', description: '$t:docs.tables.fieldTypes.advanced.buttonAction' },
          { name: 'button.url', description: '$t:docs.tables.fieldTypes.advanced.buttonUrl' },
        ]),
      ],
    },

    // ── Relational Fields ────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.tables.relational.title',
          '$t:docs.tables.relational.description',
          'relational-fields'
        ),

        // relationship
        {
          type: 'h4',
          content: 'relationship',
          props: {
            className: 'text-base font-semibold text-sovereignty-light mt-4 mb-2 font-mono',
          },
        },
        {
          type: 'paragraph',
          content: '$t:docs.tables.relational.relationship.description',
          props: { className: 'text-sm text-sovereignty-gray-400 mb-2' },
        },
        propertyTable([
          {
            name: 'relatedTable',
            description: '$t:docs.tables.relational.relationship.relatedTable',
          },
          {
            name: 'relationType',
            description: '$t:docs.tables.relational.relationship.relationType',
          },
          {
            name: 'foreignKey',
            description: '$t:docs.tables.relational.relationship.foreignKey',
          },
          {
            name: 'displayField',
            description: '$t:docs.tables.relational.relationship.displayField',
          },
          {
            name: 'onDelete',
            description: '$t:docs.tables.relational.relationship.onDelete',
          },
          {
            name: 'onUpdate',
            description: '$t:docs.tables.relational.relationship.onUpdate',
          },
          {
            name: 'reciprocalField',
            description: '$t:docs.tables.relational.relationship.reciprocalField',
          },
          {
            name: 'allowMultiple',
            description: '$t:docs.tables.relational.relationship.allowMultiple',
          },
        ]),

        // lookup
        {
          type: 'h4',
          content: 'lookup',
          props: {
            className: 'text-base font-semibold text-sovereignty-light mt-6 mb-2 font-mono',
          },
        },
        {
          type: 'paragraph',
          content: '$t:docs.tables.relational.lookup.description',
          props: { className: 'text-sm text-sovereignty-gray-400 mb-2' },
        },
        propertyTable([
          {
            name: 'relationshipField',
            description: '$t:docs.tables.relational.lookup.relationshipField',
          },
          {
            name: 'relatedField',
            description: '$t:docs.tables.relational.lookup.relatedField',
          },
          { name: 'filters', description: '$t:docs.tables.relational.lookup.filters' },
        ]),

        // rollup
        {
          type: 'h4',
          content: 'rollup',
          props: {
            className: 'text-base font-semibold text-sovereignty-light mt-6 mb-2 font-mono',
          },
        },
        {
          type: 'paragraph',
          content: '$t:docs.tables.relational.rollup.description',
          props: { className: 'text-sm text-sovereignty-gray-400 mb-2' },
        },
        propertyTable([
          {
            name: 'relationshipField',
            description: '$t:docs.tables.relational.rollup.relationshipField',
          },
          {
            name: 'relatedField',
            description: '$t:docs.tables.relational.rollup.relatedField',
          },
          {
            name: 'aggregation',
            description: '$t:docs.tables.relational.rollup.aggregation',
          },
          { name: 'format', description: '$t:docs.tables.relational.rollup.format' },
          { name: 'filters', description: '$t:docs.tables.relational.rollup.filters' },
        ]),

        // count
        {
          type: 'h4',
          content: 'count',
          props: {
            className: 'text-base font-semibold text-sovereignty-light mt-6 mb-2 font-mono',
          },
        },
        {
          type: 'paragraph',
          content: '$t:docs.tables.relational.count.description',
          props: { className: 'text-sm text-sovereignty-gray-400 mb-2' },
        },
        propertyTable([
          {
            name: 'relationshipField',
            description: '$t:docs.tables.relational.count.relationshipField',
          },
          { name: 'conditions', description: '$t:docs.tables.relational.count.conditions' },
        ]),

        // Chain example
        codeBlock(
          'tables:\n  - name: customers\n    fields:\n      - { id: 1, name: email, type: email }\n      - { id: 2, name: full_name, type: single-line-text }\n\n  - name: orders\n    fields:\n      - { id: 1, name: customer, type: relationship,\n          relatedTable: customers, relationType: many-to-one }\n      - { id: 2, name: customer_email, type: lookup,\n          relationshipField: customer, relatedField: email }\n      - { id: 3, name: total, type: currency, currency: USD }\n\n  - name: customers  # add rollup to customers\n    fields:\n      - { id: 3, name: order_count, type: count,\n          relationshipField: orders }\n      - { id: 4, name: total_spent, type: rollup,\n          relationshipField: orders,\n          relatedField: total, aggregation: sum }',
          'yaml'
        ),
        calloutTip('$t:docs.tables.relational.tip.title', '$t:docs.tables.relational.tip.body'),
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
        propertyTable([
          { name: 'create', description: '$t:docs.tables.permissions.props.create' },
          { name: 'read', description: '$t:docs.tables.permissions.props.read' },
          { name: 'update', description: '$t:docs.tables.permissions.props.update' },
          { name: 'delete', description: '$t:docs.tables.permissions.props.delete' },
          { name: 'comment', description: '$t:docs.tables.permissions.props.comment' },
          { name: 'fields', description: '$t:docs.tables.permissions.props.fields' },
          { name: 'inherit', description: '$t:docs.tables.permissions.props.inherit' },
          { name: 'override', description: '$t:docs.tables.permissions.props.override' },
        ]),
        codeBlock(
          'permissions:\n  create: authenticated\n  read: all\n  update: [admin, member]\n  delete: [admin]\n  comment: authenticated\n  fields:\n    salary:\n      read: [admin, hr]\n      update: [admin]\n    notes:\n      read: [admin, member]\n      update: [admin, member]',
          'yaml'
        ),
        calloutTip('$t:docs.tables.permissions.tip.title', '$t:docs.tables.permissions.tip.body'),
        calloutWarning(
          '$t:docs.tables.permissions.security.title',
          '$t:docs.tables.permissions.security.body'
        ),
      ],
    },

    // ── Indexes & Constraints ────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.tables.indexes.title',
          '$t:docs.tables.indexes.description',
          'indexes-constraints'
        ),

        // Indexes
        {
          type: 'h4',
          content: '$t:docs.tables.indexes.indexesTitle',
          props: {
            className: 'text-base font-semibold text-sovereignty-light mt-2 mb-2',
          },
        },
        propertyTable([
          { name: 'name', description: '$t:docs.tables.indexes.indexName' },
          { name: 'fields', description: '$t:docs.tables.indexes.indexFields' },
          { name: 'unique', description: '$t:docs.tables.indexes.indexUnique' },
          { name: 'where', description: '$t:docs.tables.indexes.indexWhere' },
        ]),

        // Unique Constraints
        {
          type: 'h4',
          content: '$t:docs.tables.indexes.uniqueTitle',
          props: {
            className: 'text-base font-semibold text-sovereignty-light mt-6 mb-2',
          },
        },
        propertyTable([
          { name: 'name', description: '$t:docs.tables.indexes.uniqueName' },
          { name: 'fields', description: '$t:docs.tables.indexes.uniqueFields' },
        ]),

        // Check Constraints
        {
          type: 'h4',
          content: '$t:docs.tables.indexes.constraintsTitle',
          props: {
            className: 'text-base font-semibold text-sovereignty-light mt-6 mb-2',
          },
        },
        propertyTable([
          { name: 'name', description: '$t:docs.tables.indexes.constraintName' },
          { name: 'check', description: '$t:docs.tables.indexes.constraintCheck' },
        ]),

        codeBlock(
          'tables:\n  - name: products\n    fields:\n      - { id: 1, name: sku, type: single-line-text }\n      - { id: 2, name: price, type: decimal, min: 0 }\n      - { id: 3, name: category, type: single-line-text }\n    indexes:\n      - name: idx_sku\n        fields: [sku]\n        unique: true\n      - name: idx_category_price\n        fields: [category, price]\n    uniqueConstraints:\n      - name: uq_sku\n        fields: [sku]\n    constraints:\n      - name: chk_positive_price\n        check: "price > 0"',
          'yaml'
        ),
      ],
    },
  ],
})
