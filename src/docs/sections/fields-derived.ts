/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  ArrayFieldSchema,
  AutonumberFieldSchema,
  ButtonFieldSchema,
  CodeFieldSchema,
  ColorFieldSchema,
  CountFieldSchema,
  FormulaFieldSchema,
  GeolocationFieldSchema,
  JsonFieldSchema,
} from '@/domain/models/app/tables/fields/field-types/advanced'
import buttonFieldsBody from '@/domain/models/app/tables/fields/field-types/advanced/button-fields.docs.md' with { type: 'file' }
import computedFieldsBody from '@/domain/models/app/tables/fields/field-types/advanced/computed-fields.docs.md' with { type: 'file' }
import formulaFieldsBody from '@/domain/models/app/tables/fields/field-types/advanced/formula-fields.docs.md' with { type: 'file' }
import structuredFieldsBody from '@/domain/models/app/tables/fields/field-types/advanced/structured-fields.docs.md' with { type: 'file' }
import {
  AiCategorizeFieldSchema,
  AiExtractFieldSchema,
  AiGenerateFieldSchema,
  AiSentimentFieldSchema,
  AiSummaryFieldSchema,
  AiTagFieldSchema,
  AiTranslateFieldSchema,
} from '@/domain/models/app/tables/fields/field-types/ai'
import aiFieldsBody from '@/domain/models/app/tables/fields/field-types/ai/ai.docs.md' with { type: 'file' }
import { defineArticle } from './define'
import type { DocArticle } from './define'

/**
 * The derived field types, as articles of the Fields section.
 *
 * Computed, structured and AI-backed types live in their own module rather
 * than in `fields.ts` because that file
 * is already at its line ceiling, and a manifest split by file size is less
 * confusing than a section split by it: these four stay part of Fields, in
 * their published order, and the section assembles them by spread.
 */
export const derivedFieldArticles: readonly DocArticle[] = [
  defineArticle({
    slug: 'formula-fields',
    title: 'Formula Fields',
    description:
      'A column computed from an expression over the record’s other fields — and the display properties that decide how the result reads.',
    keywords: [
      'sovrium',
      'formula field',
      'computed column',
      'resultType',
      'format',
      'currency',
      'precision',
      'derived value',
    ],
    order: 2280,
    sidebarLabel: 'Formula Fields',
    body: formulaFieldsBody,
    documents: [FormulaFieldSchema],
    stories: [
      'US-TABLES-FIELD-TYPES-ADVANCED-FORMULA-ARRAYS',
      'US-TABLES-FIELD-TYPES-ADVANCED-FORMULA-CORE',
      'US-TABLES-FIELD-TYPES-ADVANCED-FORMULA-DATE-TIME',
      'US-TABLES-FIELD-TYPES-ADVANCED-FORMULA-ERROR-HANDLING',
      'US-TABLES-FIELD-TYPES-ADVANCED-FORMULA-LOGICAL',
      'US-TABLES-FIELD-TYPES-ADVANCED-FORMULA-MATH',
      'US-TABLES-FIELD-TYPES-ADVANCED-FORMULA-METADATA',
      'US-TABLES-FIELD-TYPES-ADVANCED-FORMULA-OPERATORS',
      'US-TABLES-FIELD-TYPES-ADVANCED-FORMULA-REGEX',
      'US-TABLES-FIELD-TYPES-ADVANCED-FORMULA-ROLLUP',
      'US-TABLES-FIELD-TYPES-ADVANCED-FORMULA-STRINGS',
      'US-TABLES-FIELD-TYPES-SYSTEM-SPECIAL-FIELDS-IN-FORMULAS',
      'US-TABLES-FIELD-TYPES-ADVANCED-FORMULA-TRIGGER-COMPUTED-CROSS-DIALECT',
      'US-TABLES-FIELD-TYPES-ADVANCED-FORMULA-USE-CASES',
    ],
  }),
  defineArticle({
    slug: 'computed-fields',
    title: 'Count & Autonumber Fields',
    description:
      'Two columns the engine fills in — a count of related records, and a sequence the database allocates.',
    keywords: [
      'sovrium',
      'count field',
      'autonumber',
      'relationshipField',
      'sequence',
      'derived column',
    ],
    order: 2281,
    sidebarLabel: 'Count & Autonumber',
    body: computedFieldsBody,
    documents: [CountFieldSchema, AutonumberFieldSchema],
    stories: ['US-TABLES-FIELD-TYPES-ADVANCED-COUNT', 'US-TABLES-FIELD-TYPES-SYSTEM-AUTONUMBER'],
  }),
  defineArticle({
    slug: 'button-fields',
    title: 'Button Fields',
    description:
      'A column that is a control rather than a value — it opens a URL or runs an automation, and can be shown on some records only.',
    keywords: ['sovrium', 'button field', 'action', 'automation', 'visibleWhen', 'record action'],
    order: 2282,
    sidebarLabel: 'Button Fields',
    body: buttonFieldsBody,
    documents: [ButtonFieldSchema],
    stories: ['US-DESIGN-SYSTEM-FIELD-TYPES-ADVANCED', 'US-TABLES-FIELD-TYPES-ADVANCED-BUTTON'],
  }),
  defineArticle({
    slug: 'structured-fields',
    title: 'Structured Fields',
    description:
      'Five field types holding a value with more shape than a string or a number — nested data, lists, colours, source code and coordinates.',
    keywords: [
      'sovrium',
      'json field',
      'array field',
      'itemType',
      'maxItems',
      'color field',
      'code field',
      'geolocation',
    ],
    order: 2284,
    sidebarLabel: 'Structured',
    body: structuredFieldsBody,
    documents: [
      JsonFieldSchema,
      ArrayFieldSchema,
      ColorFieldSchema,
      CodeFieldSchema,
      GeolocationFieldSchema,
    ],
    stories: [
      'US-TABLES-FIELD-TYPES-ADVANCED-ARRAY',
      'US-TABLES-FIELD-TYPES-ADVANCED-CODE',
      'US-TABLES-FIELD-TYPES-ADVANCED-GEOLOCATION',
      'US-TABLES-FIELD-TYPES-ADVANCED-JSON',
      'US-TABLES-FIELD-TYPES-CROSS-DIALECT-STORAGE-ROUNDTRIP',
      'US-TABLES-FIELD-TYPES-SPECIAL-COLOR',
    ],
  }),
  defineArticle({
    slug: 'ai-fields',
    title: 'AI Fields',
    description:
      'The seven AI field types — ai-generate, ai-summary, ai-categorize, ai-extract, ai-sentiment, ai-tag and ai-translate — that compute a value from other fields with a language model.',
    keywords: [
      'sovrium',
      'ai fields',
      'ai-generate',
      'ai-summary',
      'ai-categorize',
      'ai-extract',
      'ai-sentiment',
      'ai-tag',
      'ai-translate',
      'sourceFields',
      'prompt',
    ],
    order: 2290,
    sidebarLabel: 'AI Fields',
    body: aiFieldsBody,
    documents: [
      AiGenerateFieldSchema,
      AiSummaryFieldSchema,
      AiCategorizeFieldSchema,
      AiExtractFieldSchema,
      AiSentimentFieldSchema,
      AiTagFieldSchema,
      AiTranslateFieldSchema,
    ],
    stories: [
      'US-DESIGN-SYSTEM-FIELD-TYPES-AI',
      'US-TABLES-FIELD-TYPES-AI-AI-CATEGORIZE',
      'US-TABLES-FIELD-TYPES-AI-AI-COMPUTE-REFINEMENT',
      'US-TABLES-FIELD-TYPES-AI-AI-EXTRACT',
      'US-TABLES-FIELD-TYPES-AI-AI-GENERATE',
      'US-TABLES-FIELD-TYPES-AI-AI-SENTIMENT',
      'US-TABLES-FIELD-TYPES-AI-AI-SUMMARY',
      'US-TABLES-FIELD-TYPES-AI-AI-TAG',
      'US-TABLES-FIELD-TYPES-AI-AI-TRANSLATE',
    ],
  }),
]
