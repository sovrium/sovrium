/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sanitizeTableName } from '../table-queries/shared/field-utils'
import {
  buildAiComputeTriggerStatements,
  buildSourceChangedExpr,
  buildSourceContentExpr,
  escapeSqlString,
  sqlNumberLiteral,
  sqlTextLiteral,
} from './ai-field-triggers'
import type { Table } from '@/domain/models/app/tables'
import type { Fields } from '@/domain/models/app/tables/fields'

/**
 * AI Extract field shape (narrowed from Fields union).
 */
type AiExtractField = Extract<Fields[number], { readonly type: 'ai-extract' }>

/**
 * NOTIFY payload kind for ai-extract fields. The `AiComputeListener`
 * discriminates on this value to choose the extraction prompt path.
 */
const EXTRACT_PAYLOAD_KIND = 'extract'

/**
 * A derived target property of an ai-extract `schema`. `scalarKind` is a
 * coarse classification used only to decide the placeholder value (see
 * {@link buildExtractPlaceholderExpr}).
 */
type ExtractProperty = { readonly name: string; readonly scalarKind: 'numeric' | 'other' }

/**
 * Map a JSON-Schema-ish property definition to a coarse placeholder kind:
 * `'numeric'` for `number` / `integer` declarations (so the deterministic
 * placeholder can stay NULL and not break `(record->>'field')::numeric`
 * casts), `'other'` for everything else (string / boolean / object / array /
 * unknown — placeholder gets a source-text excerpt so `record->>'field'`
 * queries see a value).
 *
 * Accepts both `{ type: 'number' }` object definitions and the shorthand
 * where the property *value* is itself the type-name string (`'number'`).
 */
const classifyExtractProperty = (def: unknown): 'numeric' | 'other' => {
  const typeName =
    typeof def === 'string'
      ? def
      : def !== null && typeof def === 'object'
        ? (def as Record<string, unknown>)['type']
        : undefined
  return typeName === 'number' || typeName === 'integer' ? 'numeric' : 'other'
}

/**
 * Resolve the target properties from an ai-extract field's `schema`. Two
 * shapes are supported:
 *
 * - JSON-Schema-ish: `{ type: 'object', properties: { foo: {...}, bar: {...} } }`
 *   → returns `[{ name: 'foo', ... }, { name: 'bar', ... }]`.
 * - Shorthand map: `{ foo: 'string', bar: 'number' }` → returns the same shape
 *   (the reserved `type` key is dropped so a bare object schema still works).
 *
 * Returns `[]` when no property names can be derived.
 */
const resolveExtractProperties = (
  schema: Readonly<Record<string, unknown>>
): readonly ExtractProperty[] => {
  const props = schema['properties']
  const entries =
    props !== null && typeof props === 'object'
      ? Object.entries(props as Record<string, unknown>)
      : Object.entries(schema).filter(([k]) => k !== 'type')
  return entries.map(([name, def]) => ({ name, scalarKind: classifyExtractProperty(def) }))
}

/**
 * Build the deterministic synchronous placeholder for an ai-extract column:
 * a `jsonb_build_object(...)` keyed by the derived schema properties.
 * PostgreSQL triggers cannot make outbound HTTP calls, so the column holds
 * this stub object (non-NULL, schema-shaped) inside the INSERT transaction;
 * the NOTIFY tells the `AiComputeListener` to invoke the AI provider for the
 * canonical extraction (observational — the trigger value is authoritative
 * for the synchronous SELECT immediately after INSERT, like the summary /
 * translate patterns). When no property names can be derived, the placeholder
 * is an empty JSON object (`'{}'::jsonb`).
 *
 * Per-property placeholder value:
 * - `numeric` (declared `number` / `integer`): JSON `null` — keeps
 *   `(record->>'field')::numeric` casts from choking on free text.
 * - everything else: a trimmed excerpt of the concatenated source content so
 *   `record->>'field'` queries and `toHaveProperty` checks see a value.
 */
const buildExtractPlaceholderExpr = (properties: readonly ExtractProperty[]): string => {
  if (properties.length === 0) return `'{}'::jsonb`
  const pairs = properties
    .map((p) =>
      p.scalarKind === 'numeric'
        ? `'${escapeSqlString(p.name)}', NULL::text`
        : `'${escapeSqlString(p.name)}', left(btrim(source_content), 500)`
    )
    .join(', ')
  return `jsonb_build_object(${pairs})`
}

/**
 * Guard block for the extract function.
 *
 * Extract semantics mirror translate: a changed source must re-extract, so the
 * guard does not blanket-preserve an existing non-NULL value on UPDATE.
 *
 * - INSERT: honour an explicit non-NULL user value (treated as override).
 * - UPDATE: if no configured source field changed, leave the row untouched
 *   (no recompute, no AI NOTIFY). If the user changed the extracted column
 *   directly in this same statement, honour that override.
 * - Either op: NULL out the column when the concatenated source content is
 *   empty (matches "return NULL when all source fields are empty or NULL").
 */
const buildExtractGuardSql = (fieldName: string, sourceFields: readonly string[]): string =>
  `  -- INSERT: honour an explicit non-NULL user value.
  IF TG_OP = 'INSERT' THEN
    IF NEW.${fieldName} IS NOT NULL THEN
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Source unchanged: nothing to re-extract — leave the row as-is.
    IF NOT (${buildSourceChangedExpr(sourceFields)}) THEN
      RETURN NEW;
    END IF;
    -- User changed the extracted column directly in this statement: honour it.
    IF NEW.${fieldName} IS DISTINCT FROM OLD.${fieldName} AND NEW.${fieldName} IS NOT NULL THEN
      RETURN NEW;
    END IF;
  END IF;

  -- NULL result when source content is empty
  IF source_content IS NULL OR btrim(source_content) = '' THEN
    NEW.${fieldName} = NULL;
    RETURN NEW;
  END IF;`

/**
 * Placeholder + NOTIFY block for extract fields. The synchronous placeholder
 * is the schema-shaped stub object built by {@link buildExtractPlaceholderExpr};
 * the NOTIFY payload carries `kind: 'extract'`, the source text, the JSON
 * schema (serialised), and per-field overrides so the `AiComputeListener`
 * invokes the extraction prompt path against the configured AI provider.
 */
const buildExtractNotifySql = (
  field: AiExtractField,
  sanitized: string,
  fieldName: string,
  properties: readonly ExtractProperty[]
): string => {
  const placeholderExpr = buildExtractPlaceholderExpr(properties)
  const schemaLiteral = `'${escapeSqlString(JSON.stringify(field.schema))}'`
  const promptLiteral = sqlTextLiteral(field.prompt)
  const systemPromptLiteral = sqlTextLiteral(field.systemPrompt)
  const modelLiteral = sqlTextLiteral(field.model)
  const temperatureLiteral = sqlNumberLiteral(field.temperature, 'real')
  const maxTokensLiteral = sqlNumberLiteral(field.maxTokens, 'int')

  return `  NEW.${fieldName} = ${placeholderExpr};

  -- Emit NOTIFY so the application layer can observe + log the extract
  -- compute event and invoke the AI provider for the canonical extraction.
  -- Payload format: JSON with kind discriminator, table, field, source,
  -- schema (serialised JSON Schema), and configuration overrides.
  notify_payload := json_build_object(
    'kind', '${EXTRACT_PAYLOAD_KIND}',
    'table', '${escapeSqlString(sanitized)}',
    'field', '${escapeSqlString(fieldName)}',
    'value', NEW.${fieldName}::text,
    'source', left(source_content, 4000),
    'schema', ${schemaLiteral},
    'prompt', ${promptLiteral},
    'systemPrompt', ${systemPromptLiteral},
    'model', ${modelLiteral},
    'temperature', ${temperatureLiteral},
    'maxTokens', ${maxTokensLiteral}
  )::text;
  PERFORM pg_notify('sovrium_ai_compute', notify_payload);

  RETURN NEW;`
}

/**
 * Build the full set of SQL statements (function + drop + create trigger) for
 * a single ai-extract field. The extract guard + placeholder + NOTIFY logic
 * lives in the function body; the trigger scaffolding is shared via
 * `buildAiComputeTriggerStatements`.
 */
const buildExtractTriggerSql = (field: AiExtractField, sanitized: string): readonly string[] => {
  const fieldName = field.name
  const properties = resolveExtractProperties(field.schema)
  const functionBody = `${buildExtractGuardSql(fieldName, field.sourceFields)}

${buildExtractNotifySql(field, sanitized, fieldName, properties)}`

  return buildAiComputeTriggerStatements({
    sanitized,
    fieldName,
    kindSlug: 'extract',
    computeOn: field.computeOn,
    functionBody,
    sourceExpr: buildSourceContentExpr(field.sourceFields),
  })
}

/**
 * Generate a BEFORE INSERT/UPDATE trigger that produces a deterministic
 * schema-shaped placeholder JSONB object and emits a NOTIFY so the
 * application-layer `AiComputeListener` can invoke the real AI provider for
 * the canonical structured extraction matching the field's `schema`.
 *
 * Returns NULL when all configured source fields are empty / NULL (no NOTIFY).
 */
export const generateAiExtractTriggers = (table: Table): readonly string[] => {
  const aiExtractFields = table.fields.filter(
    (field): field is AiExtractField => field.type === 'ai-extract'
  )

  if (aiExtractFields.length === 0) return []

  const sanitized = sanitizeTableName(table.name)
  return aiExtractFields.flatMap((field) => buildExtractTriggerSql(field, sanitized))
}
