/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

// ─── Template Variable Patterns ─────────────────────────────────────────────

/**
 * Standard template variable pattern
 * Matches: {{stepName.property}}, {{trigger.data.email}}, {{loop.item.name}}
 */
export const TEMPLATE_VAR_PATTERN = /\{\{[\w.]+\}\}/

/**
 * Environment variable reference pattern
 * Matches: $env.API_KEY, $env.SLACK_WEBHOOK_URL
 */
export const ENV_VAR_PATTERN = /\$env\.[\w]+/

/**
 * Connection reference pattern
 * Matches: $connection.my-openai, $connection.slack-oauth
 */
export const CONNECTION_REF_PATTERN = /\$connection\.[\w-]+/

/**
 * Unified template expression pattern.
 *
 * Matches any expression within {{...}} brackets:
 * - Simple variables: {{step.property}}
 * - Helper calls: {{helperName arg1 "arg2"}}
 * - Nested helpers: {{helperName (otherHelper value)}}
 * - Zero-arg helpers: {{now}}, {{today}}
 * - Env references: $env.VAR_NAME
 */
export const TEMPLATE_EXPRESSION_PATTERN =
  /\{\{(?:[\w]+(?:\s+(?:[\w.$]+|"[^"]*"|\([^)]+\)))*|[\w.]+)\}\}/

// ─── Legacy Patterns (deprecated) ──────────────────────────────────────────

/** @deprecated Use TEMPLATE_EXPRESSION_PATTERN instead */
/** @public */
export const TEMPLATE_TYPE_HELPER_PATTERN = /\{\{(json|number|boolean)\s+[\w.]+\}\}/
/** @deprecated Use {{now}} instead */
/** @public */
export const TEMPLATE_DATETIME_PATTERN = /\{\{currentDateTime\}\}/
/** @deprecated Use TEMPLATE_EXPRESSION_PATTERN instead */
/** @public */
export const TEMPLATE_REGEX_PATTERN = /\{\{regex\s+[\w.]+\s+"[^"]+"\}\}/

// ─── Template Helper Categories ─────────────────────────────────────────────

/**
 * All available template helpers organized by category.
 *
 * Template helpers transform values within {{...}} expressions.
 *
 * Syntax:
 *   {{helperName argument1 "argument2" ...}}
 *
 * Nesting (inner expression in parentheses):
 *   {{helperName (otherHelper value) "arg2"}}
 *
 * Examples:
 *   {{uppercase trigger.data.name}}
 *   {{truncate trigger.data.body 100 "..."}}
 *   {{formatDate trigger.data.createdAt "YYYY-MM-DD"}}
 *   {{default trigger.data.name "Anonymous"}}
 *   {{slugify (lowercase trigger.data.title)}}
 *   {{number (round (multiply trigger.data.price trigger.data.qty) 2)}}
 */

/** Text transformation helpers */
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

/** Number formatting and arithmetic helpers */
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

/**
 * Date/time formatting and manipulation helpers.
 *
 * Date format tokens (Luxon-compatible):
 *   YYYY — 4-digit year (2026)
 *   YY   — 2-digit year (26)
 *   MM   — Month 01-12
 *   MMM  — Short month (Mar)
 *   MMMM — Full month (March)
 *   DD   — Day 01-31
 *   dd   — Short weekday (Mon)
 *   dddd — Full weekday (Monday)
 *   HH   — Hour 24h 00-23
 *   hh   — Hour 12h 01-12
 *   mm   — Minute 00-59
 *   ss   — Second 00-59
 *   A    — AM/PM
 *   Z    — Timezone offset (+05:00)
 */
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

/** Data extraction helpers */
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

/** Array and object manipulation helpers */
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

/** Logic and conditional helpers */
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

/** Encoding and hashing helpers */
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

/** Type coercion helpers */
export const TYPE_HELPERS = [
  'number',
  'boolean',
  'string',
  'toString',
  'toNumber',
  'toBoolean',
  'typeof',
] as const

/** @deprecated Use {{now}} instead of {{currentDateTime}} */
export const DEPRECATED_HELPERS = ['currentDateTime'] as const

/** All available template helper names */
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

/** @public */
export type TemplateHelper = (typeof ALL_HELPERS)[number]

// ─── Template String Schema ────────────────────────────────────────────────

/**
 * TemplateString - A string that may contain template variables and helper expressions
 *
 * ## Variable Syntax
 * - `{{stepName.propertyPath}}` — reference step output
 * - `$env.VAR_NAME` — reference environment variable (never logged)
 *
 * ## Helper Syntax
 * - `{{helperName value}}` — single argument
 * - `{{helperName value "arg2"}}` — with string literal argument
 * - `{{helperName value 42}}` — with number literal argument
 * - `{{helperName (otherHelper value)}}` — nested (compose helpers)
 *
 * ## Examples
 * ```yaml
 * greeting: "Hello, {{uppercase trigger.data.name}}"
 * slug: "{{slugify (lowercase trigger.data.title)}}"
 * excerpt: '{{truncate trigger.data.body 100 "..."}}'
 * date: '{{formatDate trigger.data.createdAt "YYYY-MM-DD"}}'
 * name: '{{default trigger.data.name "Anonymous"}}'
 * total: "{{number (round (multiply trigger.data.price trigger.data.qty) 2)}}"
 * email: "{{extractEmail trigger.data.text}}"
 * auth: "Bearer $env.API_KEY"
 * ```
 */
export const TemplateStringSchema = Schema.String.pipe(
  Schema.annotations({
    title: 'Template String',
    description:
      'String with {{step.property}} variables, {{helper args}} expressions, and $env.VAR references',
  })
)

/** @public */
export type TemplateString = Schema.Schema.Type<typeof TemplateStringSchema>
