/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { BaseFieldSchema } from '@/domain/models/app/tables/fields/field-types'
import {
  CreatedAtFieldSchema,
  DateFieldSchema,
  DateTimeFieldSchema,
  DeletedAtFieldSchema,
  DurationFieldSchema,
  TimeFieldSchema,
  UpdatedAtFieldSchema,
} from '@/domain/models/app/tables/fields/field-types/date-time'
import datetimeFieldsBody from '@/domain/models/app/tables/fields/field-types/date-time/date-time.docs.md' with { type: 'file' }
import fieldTypesOverviewBody from '@/domain/models/app/tables/fields/field-types/field-types.docs.md' with { type: 'file' }
import {
  BarcodeFieldSchema,
  MultipleAttachmentsFieldSchema,
  SingleAttachmentFieldSchema,
} from '@/domain/models/app/tables/fields/field-types/media'
import attachmentFieldsBody from '@/domain/models/app/tables/fields/field-types/media/media.docs.md' with { type: 'file' }
import {
  CurrencyFieldSchema,
  DecimalFieldSchema,
  IntegerFieldSchema,
  PercentageFieldSchema,
  ProgressFieldSchema,
  RatingFieldSchema,
} from '@/domain/models/app/tables/fields/field-types/numeric'
import numberFieldsBody from '@/domain/models/app/tables/fields/field-types/numeric/numeric.docs.md' with { type: 'file' }
import {
  LookupFieldSchema,
  RelationshipFieldSchema,
  RollupFieldSchema,
} from '@/domain/models/app/tables/fields/field-types/relational'
import relationalFieldsBody from '@/domain/models/app/tables/fields/field-types/relational/relational.docs.md' with { type: 'file' }
import {
  CheckboxFieldSchema,
  MultiSelectFieldSchema,
  SingleSelectFieldSchema,
  StatusFieldSchema,
} from '@/domain/models/app/tables/fields/field-types/selection'
import selectionFieldsBody from '@/domain/models/app/tables/fields/field-types/selection/selection.docs.md' with { type: 'file' }
import {
  EmailFieldSchema,
  LongTextFieldSchema,
  PhoneNumberFieldSchema,
  RichTextFieldSchema,
  SingleLineTextFieldSchema,
  UrlFieldSchema,
} from '@/domain/models/app/tables/fields/field-types/text'
import textFieldsBody from '@/domain/models/app/tables/fields/field-types/text/text.docs.md' with { type: 'file' }
import {
  CreatedByFieldSchema,
  DeletedByFieldSchema,
  UpdatedByFieldSchema,
  UserFieldSchema,
} from '@/domain/models/app/tables/fields/field-types/user'
import userAuditFieldsBody from '@/domain/models/app/tables/fields/field-types/user/user.docs.md' with { type: 'file' }
import { defineArticle, defineSection } from './define'
import { derivedFieldArticles } from './fields-derived'

/**
 * Fields — the section manifest.
 *
 * Every `body` is imported `with { type: 'file' }`, so the value is a PATH and
 * the prose is never loaded until something reads it. Every entry of
 * `documents` is a VALUE import, so deleting the schema fails `tsc` here
 * rather than at the moment a reader asks for the article.
 */
export const section = defineSection({
  slug: 'fields',
  title: 'Fields',
  order: 2200,
  tab: 'tables',
  articles: [
    defineArticle({
      slug: 'field-types-overview',
      title: 'Field Types Overview',
      description:
        'Every field type a table column can declare, grouped into ten categories — and the base properties all of them share.',
      keywords: [
        'sovrium',
        'field types',
        'columns',
        'schema',
        'text',
        'numeric',
        'relational',
        'ai fields',
        'formula',
        'rollup',
        'lookup',
      ],
      order: 2200,
      sidebarLabel: 'Field Types',
      body: fieldTypesOverviewBody,
      documents: [BaseFieldSchema],
      stories: [
        'US-TABLES-FIELD-TYPES-COMMON-DESCRIPTION',
        'US-TABLES-FIELD-TYPES-COMMON-INDEXED',
        'US-TABLES-FIELD-TYPES-COMMON-LABEL',
        'US-TABLES-FIELD-TYPES-COMMON-REQUIRED',
        'US-TABLES-FIELD-TYPES-COMMON-UNIQUE',
      ],
    }),
    defineArticle({
      slug: 'text-fields',
      title: 'Text Fields',
      description:
        'The six text field types — single-line text, long text, rich text, email, URL and phone number.',
      keywords: [
        'sovrium',
        'text fields',
        'single-line-text',
        'long-text',
        'rich-text',
        'email',
        'url',
        'phone-number',
        'full-text search',
      ],
      order: 2210,
      sidebarLabel: 'Text Fields',
      body: textFieldsBody,
      documents: [
        SingleLineTextFieldSchema,
        LongTextFieldSchema,
        RichTextFieldSchema,
        EmailFieldSchema,
        UrlFieldSchema,
        PhoneNumberFieldSchema,
      ],
      stories: [
        'US-DESIGN-SYSTEM-FIELD-TYPES-TEXT',
        'US-PAGES-CRUD-COMPONENTS-RICH-TEXT-WYSIWYG-FORM-FIELD',
        'US-TABLES-FIELD-TYPES-SPECIAL-EMAIL',
        'US-TABLES-FIELD-TYPES-SPECIAL-PHONE-NUMBER',
        'US-TABLES-FIELD-TYPES-SPECIAL-URL',
        'US-TABLES-FIELD-TYPES-TEXT-LONG-TEXT',
        'US-TABLES-FIELD-TYPES-TEXT-RICH-TEXT',
        'US-TABLES-FIELD-TYPES-TEXT-SINGLE-LINE-TEXT',
      ],
    }),
    defineArticle({
      slug: 'number-fields',
      title: 'Number Fields',
      description:
        'The six numeric field types — integer, decimal, currency, percentage, rating and progress.',
      keywords: [
        'sovrium',
        'numeric fields',
        'integer',
        'decimal',
        'currency',
        'percentage',
        'rating',
        'progress',
        'precision',
        'thousandsSeparator',
      ],
      order: 2220,
      sidebarLabel: 'Number Fields',
      body: numberFieldsBody,
      documents: [
        IntegerFieldSchema,
        DecimalFieldSchema,
        CurrencyFieldSchema,
        PercentageFieldSchema,
        RatingFieldSchema,
        ProgressFieldSchema,
      ],
      stories: [
        'US-DESIGN-SYSTEM-FIELD-TYPES-NUMERIC',
        'US-TABLES-FIELD-TYPES-NUMBER-CURRENCY',
        'US-TABLES-FIELD-TYPES-NUMBER-DECIMAL',
        'US-TABLES-FIELD-TYPES-NUMBER-INTEGER',
        'US-TABLES-FIELD-TYPES-NUMBER-PERCENTAGE',
        'US-TABLES-FIELD-TYPES-SPECIAL-PROGRESS',
        'US-TABLES-FIELD-TYPES-SPECIAL-RATING',
      ],
    }),
    defineArticle({
      slug: 'datetime-fields',
      title: 'Date & Time Fields',
      description:
        'The seven date and time field types — date, datetime, time, duration, and the system audit timestamps created-at, updated-at and deleted-at.',
      keywords: [
        'sovrium',
        'date fields',
        'datetime',
        'time',
        'duration',
        'created-at',
        'updated-at',
        'deleted-at',
        'timezone',
        'soft delete',
      ],
      order: 2230,
      sidebarLabel: 'Date & Time Fields',
      body: datetimeFieldsBody,
      documents: [
        DateFieldSchema,
        DateTimeFieldSchema,
        TimeFieldSchema,
        DurationFieldSchema,
        CreatedAtFieldSchema,
        UpdatedAtFieldSchema,
        DeletedAtFieldSchema,
      ],
      stories: [
        'US-DESIGN-SYSTEM-FIELD-TYPES-DATE-TIME',
        'US-TABLES-FIELD-TYPES-CROSS-CUTTING-TIMEZONE-HANDLING',
        'US-TABLES-FIELD-TYPES-DATETIME-DATE',
        'US-TABLES-FIELD-TYPES-DATETIME-DATETIME',
        'US-TABLES-FIELD-TYPES-DATETIME-DURATION',
        'US-TABLES-FIELD-TYPES-DATETIME-TIME',
        'US-TABLES-FIELD-TYPES-SYSTEM-CREATED-AT',
        'US-TABLES-FIELD-TYPES-SYSTEM-DELETED-AT',
        'US-TABLES-FIELD-TYPES-SYSTEM-UPDATED-AT',
      ],
    }),
    defineArticle({
      slug: 'selection-fields',
      title: 'Selection Fields',
      description:
        'The four selection field types — checkbox, single-select, multi-select and status.',
      keywords: [
        'sovrium',
        'selection fields',
        'checkbox',
        'single-select',
        'multi-select',
        'status',
        'options',
        'colors',
        'workflow states',
      ],
      order: 2240,
      sidebarLabel: 'Selection Fields',
      body: selectionFieldsBody,
      documents: [
        CheckboxFieldSchema,
        SingleSelectFieldSchema,
        MultiSelectFieldSchema,
        StatusFieldSchema,
      ],
      stories: [
        'US-DESIGN-SYSTEM-FIELD-TYPES-SELECTION',
        'US-TABLES-FIELD-TYPES-SELECTION-CHECKBOX',
        'US-TABLES-FIELD-TYPES-SELECTION-MULTI-SELECT',
        'US-TABLES-FIELD-TYPES-SELECTION-SINGLE-SELECT',
        'US-TABLES-FIELD-TYPES-SELECTION-STATUS',
      ],
    }),
    defineArticle({
      slug: 'relational-fields',
      title: 'Relational Fields',
      description:
        'The three relational field types — relationship, lookup and rollup — that link tables and derive data without duplicating it.',
      keywords: [
        'sovrium',
        'relational fields',
        'relationship',
        'lookup',
        'rollup',
        'foreign key',
        'cardinality',
        'onDelete',
        'displayField',
        'aggregation',
      ],
      order: 2250,
      sidebarLabel: 'Relational Fields',
      body: relationalFieldsBody,
      documents: [RelationshipFieldSchema, LookupFieldSchema, RollupFieldSchema],
      stories: [
        'US-DESIGN-SYSTEM-FIELD-TYPES-RELATIONAL',
        'US-TABLES-FIELD-TYPES-ADVANCED-LOOKUP',
        'US-TABLES-FIELD-TYPES-ADVANCED-RELATIONSHIP',
        'US-TABLES-FIELD-TYPES-ADVANCED-ROLLUP',
      ],
    }),
    defineArticle({
      slug: 'user-audit-fields',
      title: 'User & Audit Fields',
      description:
        'The four user and audit field types — user, created-by, updated-by and deleted-by — that reference accounts and record who did what.',
      keywords: [
        'sovrium',
        'user fields',
        'created-by',
        'updated-by',
        'deleted-by',
        'audit',
        'authorship',
        'auth',
      ],
      order: 2260,
      sidebarLabel: 'User & Audit Fields',
      body: userAuditFieldsBody,
      documents: [
        UserFieldSchema,
        CreatedByFieldSchema,
        UpdatedByFieldSchema,
        DeletedByFieldSchema,
      ],
      stories: [
        'US-DESIGN-SYSTEM-FIELD-TYPES-USER',
        'US-FORMS-SUBMISSION-AUTHORSHIP',
        'US-RECORDS-API-AUTHORSHIP-CUSTOM-NAMED-FIELDS',
        'US-RECORDS-API-AUTHORSHIP-METADATA',
        'US-TABLES-FIELD-TYPES-ADVANCED-USER',
        'US-TABLES-FIELD-TYPES-SYSTEM-CREATED-BY',
        'US-TABLES-FIELD-TYPES-SYSTEM-DELETED-BY',
        'US-TABLES-FIELD-TYPES-SYSTEM-UPDATED-BY',
      ],
    }),
    defineArticle({
      slug: 'attachment-fields',
      title: 'Attachment Fields',
      description:
        'File uploads with bucket, MIME, size and thumbnail controls — plus the barcode field that shares their directory.',
      keywords: [
        'sovrium',
        'attachment fields',
        'single-attachment',
        'multiple-attachments',
        'file upload',
        'bucket',
        'MIME types',
        'barcode',
      ],
      order: 2270,
      sidebarLabel: 'Attachment Fields',
      body: attachmentFieldsBody,
      documents: [SingleAttachmentFieldSchema, MultipleAttachmentsFieldSchema, BarcodeFieldSchema],
      stories: [
        'US-DESIGN-SYSTEM-FIELD-TYPES-MEDIA',
        'US-TABLES-FIELD-TYPES-ATTACHMENT-ATTACHMENT-UPLOAD-INTEGRATION',
        'US-TABLES-FIELD-TYPES-ATTACHMENT-MULTIPLE-ATTACHMENTS',
        'US-TABLES-FIELD-TYPES-ATTACHMENT-SINGLE-ATTACHMENT',
        'US-TABLES-FIELD-TYPES-SPECIAL-BARCODE',
      ],
    }),
    ...derivedFieldArticles,
  ],
})
