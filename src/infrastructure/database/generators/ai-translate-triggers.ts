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
 * AI Translate field shape (narrowed from Fields union).
 */
type AiTranslateField = Extract<Fields[number], { readonly type: 'ai-translate' }>

/**
 * NOTIFY payload kind for ai-translate fields. The `AiComputeListener`
 * discriminates on this value to choose the translation prompt path.
 */
const TRANSLATE_PAYLOAD_KIND = 'translate'

/**
 * Guard block for the translate function.
 *
 * Translate semantics differ from summary/categorize: a changed source must
 * re-translate, so the guard does *not* blanket-preserve any existing non-NULL
 * value on UPDATE. Instead:
 *
 * - INSERT: preserve an explicit non-empty user value.
 * - UPDATE: if the source field(s) did not change, leave the row untouched
 *   (no recompute, no AI NOTIFY — avoids wasteful provider calls when an
 *   unrelated column is updated). If the user changed the translated column
 *   directly in this same statement, honour that override.
 * - Either op: NULL out the column when the source content is empty.
 */
const buildTranslateGuardSql = (fieldName: string, sourceFields: readonly string[]): string =>
  `  -- INSERT: honour an explicit non-empty user value.
  IF TG_OP = 'INSERT' THEN
    IF NEW.${fieldName} IS NOT NULL AND NEW.${fieldName} <> '' THEN
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Source unchanged: nothing to re-translate — leave the row as-is.
    IF NOT (${buildSourceChangedExpr(sourceFields)}) THEN
      RETURN NEW;
    END IF;
    -- User changed the translated column directly in this statement: honour it.
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
 * Placeholder + NOTIFY block for translate fields.
 *
 * The deterministic synchronous placeholder is the trimmed source content
 * itself — PostgreSQL triggers cannot make outbound HTTP calls, so the column
 * is filled with the (untranslated) source text inside the INSERT transaction.
 * The NOTIFY payload carries `kind: 'translate'`, the source text, and the
 * target language so the `AiComputeListener` invokes the translation prompt
 * path against the configured AI provider (observational — the trigger value
 * is authoritative for the synchronous SELECT immediately after INSERT, like
 * the categorize/summary patterns).
 */
const buildTranslateNotifySql = (
  field: AiTranslateField,
  sanitized: string,
  fieldName: string
): string => {
  const targetLanguageLiteral = `'${escapeSqlString(field.targetLanguage)}'`
  const promptLiteral = sqlTextLiteral(field.prompt)
  const systemPromptLiteral = sqlTextLiteral(field.systemPrompt)
  const modelLiteral = sqlTextLiteral(field.model)
  const temperatureLiteral = sqlNumberLiteral(field.temperature, 'real')
  const maxTokensLiteral = sqlNumberLiteral(field.maxTokens, 'int')

  return `  NEW.${fieldName} = btrim(source_content);

  -- Emit NOTIFY so the application layer can observe + log the translate
  -- compute event and invoke the AI provider for the canonical translation.
  -- Payload format: JSON with kind discriminator, table, field, source,
  -- targetLanguage, and configuration overrides.
  notify_payload := json_build_object(
    'kind', '${TRANSLATE_PAYLOAD_KIND}',
    'table', '${escapeSqlString(sanitized)}',
    'field', '${escapeSqlString(fieldName)}',
    'value', NEW.${fieldName},
    'source', left(source_content, 4000),
    'targetLanguage', ${targetLanguageLiteral},
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
 * a single ai-translate field. The translate guard + placeholder + NOTIFY
 * logic lives in the function body; the trigger scaffolding is shared via
 * `buildAiComputeTriggerStatements`.
 */
const buildTranslateTriggerSql = (
  field: AiTranslateField,
  sanitized: string
): readonly string[] => {
  const fieldName = field.name
  const functionBody = `${buildTranslateGuardSql(fieldName, field.sourceFields)}

${buildTranslateNotifySql(field, sanitized, fieldName)}`

  return buildAiComputeTriggerStatements({
    sanitized,
    fieldName,
    kindSlug: 'translate',
    computeOn: field.computeOn,
    functionBody,
    sourceExpr: buildSourceContentExpr(field.sourceFields),
  })
}

/**
 * Generate a BEFORE INSERT/UPDATE trigger that produces a deterministic
 * placeholder (the trimmed source text) and emits a NOTIFY so the
 * application-layer `AiComputeListener` can invoke the real AI provider for
 * the canonical translation into the field's `targetLanguage`.
 *
 * Returns NULL when the single source field is empty / NULL (no NOTIFY).
 */
export const generateAiTranslateTriggers = (table: Table): readonly string[] => {
  const aiTranslateFields = table.fields.filter(
    (field): field is AiTranslateField => field.type === 'ai-translate'
  )

  if (aiTranslateFields.length === 0) return []

  const sanitized = sanitizeTableName(table.name)
  return aiTranslateFields.flatMap((field) => buildTranslateTriggerSql(field, sanitized))
}
