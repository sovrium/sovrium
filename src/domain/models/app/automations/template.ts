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
  'pascalCase',
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
  'concat',
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
  'isEven',
  'isOdd',
] as const

/**
 * Date/time formatting and manipulation helpers.
 *
 * ## Format tokens — a CLOSED set
 *
 * The vocabulary is defined once, in `src/domain/services/date-tokens.ts`, and
 * is deliberately CLOSED: an unrecognised letter outside a quoted literal is a
 * failure, never a silent pass-through. Implying a full date-library
 * vocabulary would oblige us to deliver all of it.
 *
 *   yyyy — Calendar year, 4 digits (2026)      (legacy alias: YYYY)
 *   MM   — Month, 2 digits (01-12)
 *   dd   — Day of month, 2 digits (01-31)      (legacy alias: DD)
 *   HH   — Hour, 24-hour, 2 digits (00-23)
 *   mm   — Minute, 2 digits (00-59)
 *   ss   — Second, 2 digits (00-59)
 *   MMMM — Month name, full, localised (March / mars)
 *   MMM  — Month name, short, localised (Mar / mars)
 *   EEEE — Weekday name, full, localised (Saturday / samedi)
 *   EEE  — Weekday name, short, localised (Sat / sam.)
 *
 * To emit a literal letter, quote it: `"dd 'de' MMMM"`.
 *
 * ## Timezone and locale
 *
 * `formatDate`, `parseDate`, `today`, `startOf`, `endOf`, `dayOfWeek`,
 * `isWeekday` and `isWeekend` accept OPTIONAL trailing `timezone` (IANA) and,
 * where names are rendered, `locale` (BCP 47) arguments. Both default to `UTC`
 * and `en-US` so output is deterministic rather than host-dependent.
 *
 *   {{formatDate trigger.data.createdAt "yyyy-MM-dd"}}
 *   {{formatDate trigger.data.createdAt "dd MMMM yyyy" "Europe/Paris" "fr-FR"}}
 *
 * There is deliberately no `toTimezone` helper: an instant carries no zone, so
 * a "convert" that returned an instant would be a no-op that teaches the wrong
 * mental model. Rendering in a zone is what `formatDate`'s timezone argument
 * does. Nor are there `isBefore`/`isAfter` helpers — ordered comparison is
 * `{{gt}}`/`{{lt}}` here and the `greaterThan`/`lessThan` comparators in a
 * condition group; a third spelling would be a third place to keep in sync.
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
  'subtractMinutes',
  'subtractMonths',
  'subtractYears',
  'dateDiff',
  'startOf',
  'endOf',
  'dayOfWeek',
  'isWeekday',
  'isWeekend',
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
  'ifValue',
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
  'urlEncode',
  'urlDecode',
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
  Schema.annotate({
    title: 'Template String',
    description:
      'String with {{step.property}} variables, {{helper args}} expressions, and $env.VAR references',
  })
)

/** @public */
export type TemplateString = Schema.Schema.Type<typeof TemplateStringSchema>
