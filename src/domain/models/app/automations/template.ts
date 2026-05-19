/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'


export const TEMPLATE_VAR_PATTERN = /\{\{[\w.]+\}\}/

export const ENV_VAR_PATTERN = /\$env\.[\w]+/

export const CONNECTION_REF_PATTERN = /\$connection\.[\w-]+/

export const TEMPLATE_EXPRESSION_PATTERN =
  /\{\{(?:[\w]+(?:\s+(?:[\w.$]+|"[^"]*"|\([^)]+\)))*|[\w.]+)\}\}/


export const TEMPLATE_TYPE_HELPER_PATTERN = /\{\{(json|number|boolean)\s+[\w.]+\}\}/
export const TEMPLATE_DATETIME_PATTERN = /\{\{currentDateTime\}\}/
export const TEMPLATE_REGEX_PATTERN = /\{\{regex\s+[\w.]+\s+"[^"]+"\}\}/



export const TEXT_HELPERS = [
  'uppercase',
  'lowercase',
  'capitalize',
  'titleCase',
  'sentenceCase',
  'camelCase',
  'snakeCase',
  'kebabCase',
  'slugify',
  'trim',
  'trimStart',
  'trimEnd',
  'replace',
  'replaceAll',
  'truncate',
  'padStart',
  'padEnd',
  'split',
  'substring',
  'length',
  'wordCount',
  'contains',
  'startsWith',
  'endsWith',
  'repeat',
  'reverse',
  'stripHtml',
  'escapeHtml',
  'unescapeHtml',
  'pluralize',
] as const

export const NUMBER_HELPERS = [
  'round',
  'ceil',
  'floor',
  'abs',
  'toFixed',
  'min',
  'max',
  'clamp',
  'add',
  'subtract',
  'multiply',
  'divide',
  'modulo',
  'percentage',
  'formatNumber',
  'formatCurrency',
  'random',
  'isEven',
  'isOdd',
] as const

export const DATE_HELPERS = [
  'now',
  'today',
  'formatDate',
  'parseDate',
  'addDays',
  'addHours',
  'addMinutes',
  'addMonths',
  'addYears',
  'subtractDays',
  'subtractHours',
  'subtractMonths',
  'dateDiff',
  'startOf',
  'endOf',
  'toTimezone',
  'dayOfWeek',
  'isWeekday',
  'isWeekend',
  'isBefore',
  'isAfter',
  'timestamp',
  'fromTimestamp',
] as const

export const EXTRACTION_HELPERS = [
  'extractEmail',
  'extractEmails',
  'extractUrl',
  'extractUrls',
  'extractNumber',
  'extractNumbers',
  'extractDomain',
  'extractPath',
  'regex',
  'matchAll',
] as const

export const COLLECTION_HELPERS = [
  'first',
  'last',
  'at',
  'join',
  'slice',
  'includes',
  'unique',
  'flatten',
  'sortAsc',
  'sortDesc',
  'reverseArray',
  'count',
  'keys',
  'values',
  'pick',
  'omit',
  'get',
  'stringify',
  'json',
] as const

export const LOGIC_HELPERS = [
  'if',
  'ifEmpty',
  'default',
  'coalesce',
  'switch',
  'eq',
  'ne',
  'gt',
  'gte',
  'lt',
  'lte',
  'not',
  'and',
  'or',
] as const

export const ENCODING_HELPERS = [
  'encodeUri',
  'decodeUri',
  'encodeUriComponent',
  'decodeUriComponent',
  'base64Encode',
  'base64Decode',
  'md5',
  'sha256',
] as const

export const TYPE_HELPERS = [
  'number',
  'boolean',
  'string',
  'toString',
  'toNumber',
  'toBoolean',
  'typeof',
] as const

export const DEPRECATED_HELPERS = ['currentDateTime'] as const

export const ALL_HELPERS = [
  ...TEXT_HELPERS,
  ...NUMBER_HELPERS,
  ...DATE_HELPERS,
  ...EXTRACTION_HELPERS,
  ...COLLECTION_HELPERS,
  ...LOGIC_HELPERS,
  ...ENCODING_HELPERS,
  ...TYPE_HELPERS,
  ...DEPRECATED_HELPERS,
] as const

export type TemplateHelper = (typeof ALL_HELPERS)[number]


export const TemplateStringSchema = Schema.String.pipe(
  Schema.annotations({
    title: 'Template String',
    description:
      'String with {{step.property}} variables, {{helper args}} expressions, and $env.VAR references',
  })
)

export type TemplateString = Schema.Schema.Type<typeof TemplateStringSchema>
