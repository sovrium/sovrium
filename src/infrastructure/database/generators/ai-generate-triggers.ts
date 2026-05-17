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
 * AI Generate field shape (narrowed from Fields union).
 */
type AiGenerateField = Extract<Fields[number], { readonly type: 'ai-generate' }>

/**
 * NOTIFY payload kind for ai-generate fields. The `AiComputeListener`
 * discriminates on this value to choose the free-form generation prompt path.
 */
const GENERATE_PAYLOAD_KIND = 'generate'

/**
 * Build the PL/pgSQL expression that interpolates the configured `prompt`
 * template against the record's source-field column values. Each
 * `{{fieldName}}` placeholder is rewritten as a `replace(...)` call wrapping
 * the running expression; NULL columns become empty strings via
 * `COALESCE(..., '')`. The innermost value is the literal prompt template.
 *
 * Returns e.g. for prompt `Describe {{name}} for {{audience}}`:
 *   replace(replace('Describe {{name}} for {{audience}}',
 *     '{{name}}', COALESCE(NEW.name::text, '')),
 *     '{{audience}}', COALESCE(NEW.audience::text, ''))
 */
const buildInterpolatedPromptExpr = (prompt: string, sourceFields: readonly string[]): string => {
  const base = `'${escapeSqlString(prompt)}'`
  return sourceFields.reduce(
    (acc, sf) => `replace(${acc}, '{{${escapeSqlString(sf)}}}', COALESCE(NEW.${sf}::text, ''))`,
    base
  )
}

/**
 * Guard block for the generate function.
 *
 * Generate semantics mirror translate/summary: a changed source must
 * re-generate, so the guard does not blanket-preserve an existing non-NULL
 * value on UPDATE.
 *
 * - INSERT: honour an explicit non-empty user value (treated as override).
 * - UPDATE: if no configured source field changed, leave the row untouched
 *   (no recompute, no AI NOTIFY). If the user changed the generated column
 *   directly in this same statement, honour that override.
 * - Either op: NULL out the column when the concatenated source content is
 *   empty (matches "return NULL when all source fields are empty or NULL").
 */
const buildGenerateGuardSql = (fieldName: string, sourceFields: readonly string[]): string =>
  `  -- INSERT: honour an explicit non-empty user value.
  IF TG_OP = 'INSERT' THEN
    IF NEW.${fieldName} IS NOT NULL AND NEW.${fieldName} <> '' THEN
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Source unchanged: nothing to re-generate — leave the row as-is.
    IF NOT (${buildSourceChangedExpr(sourceFields)}) THEN
      RETURN NEW;
    END IF;
    -- User changed the generated column directly in this statement: honour it.
    IF NEW.${fieldName} IS DISTINCT FROM OLD.${fieldName}
       AND NEW.${fieldName} IS NOT NULL AND NEW.${fieldName} <> '' THEN
      RETURN NEW;
    END IF;
  END IF;

  -- NULL result when source content is empty
  IF source_content IS NULL OR btrim(source_content) = '' THEN
    NEW.${fieldName} = NULL;
    RETURN NEW;
  END IF;`

/**
 * Placeholder + NOTIFY block for generate fields.
 *
 * The deterministic synchronous placeholder is the interpolated prompt
 * template (`{{fieldName}}` → source column values) — PostgreSQL triggers
 * cannot make outbound HTTP calls, so the column is filled with this resolved
 * prompt text inside the INSERT transaction. The NOTIFY payload carries
 * `kind: 'generate'`, the interpolated prompt, and per-field overrides
 * (`systemPrompt`/`model`/`temperature`/`maxTokens`) so the
 * `AiComputeListener` invokes the generation prompt path against the
 * configured AI provider (observational — the trigger value is authoritative
 * for the synchronous SELECT immediately after INSERT, like the
 * summary/translate/extract patterns).
 */
const buildGenerateNotifySql = (
  field: AiGenerateField,
  sanitized: string,
  fieldName: string
): string => {
  const interpolatedExpr = buildInterpolatedPromptExpr(field.prompt ?? '', field.sourceFields)
  const systemPromptLiteral = sqlTextLiteral(field.systemPrompt)
  const modelLiteral = sqlTextLiteral(field.model)
  const temperatureLiteral = sqlNumberLiteral(field.temperature, 'real')
  const maxTokensLiteral = sqlNumberLiteral(field.maxTokens, 'int')

  return `  NEW.${fieldName} = ${interpolatedExpr};

  -- Emit NOTIFY so the application layer can observe + log the generate
  -- compute event and invoke the AI provider for the canonical generated text.
  -- Payload format: JSON with kind discriminator, table, field, the
  -- interpolated prompt, source content, and configuration overrides.
  notify_payload := json_build_object(
    'kind', '${GENERATE_PAYLOAD_KIND}',
    'table', '${escapeSqlString(sanitized)}',
    'field', '${escapeSqlString(fieldName)}',
    'value', NEW.${fieldName},
    'prompt', NEW.${fieldName},
    'source', left(source_content, 4000),
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
 * a single ai-generate field. The generate guard + interpolated-prompt
 * placeholder + NOTIFY logic lives in the function body; the trigger
 * scaffolding is shared via `buildAiComputeTriggerStatements`.
 */
const buildGenerateTriggerSql = (field: AiGenerateField, sanitized: string): readonly string[] => {
  if (field.computeOn === 'manual') return []

  const fieldName = field.name
  const functionBody = `${buildGenerateGuardSql(fieldName, field.sourceFields)}

${buildGenerateNotifySql(field, sanitized, fieldName)}`

  return buildAiComputeTriggerStatements({
    sanitized,
    fieldName,
    kindSlug: 'generate',
    computeOn: field.computeOn,
    functionBody,
    sourceExpr: buildSourceContentExpr(field.sourceFields),
  })
}

/**
 * Generate a BEFORE INSERT/UPDATE trigger that interpolates the field's
 * `prompt` template against the record's source-field values, writes the
 * resolved prompt text as a deterministic synchronous placeholder, and emits
 * a NOTIFY so the application-layer `AiComputeListener` can invoke the real AI
 * provider for the canonical free-form generated text.
 *
 * Returns NULL when all configured source fields are empty / NULL (no NOTIFY).
 */
export const generateAiGenerateTriggers = (table: Table): readonly string[] => {
  const aiGenerateFields = table.fields.filter(
    (field): field is AiGenerateField => field.type === 'ai-generate'
  )

  if (aiGenerateFields.length === 0) return []

  const sanitized = sanitizeTableName(table.name)
  return aiGenerateFields.flatMap((field) => buildGenerateTriggerSql(field, sanitized))
}
