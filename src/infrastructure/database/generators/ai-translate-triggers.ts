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

type AiTranslateField = Extract<Fields[number], { readonly type: 'ai-translate' }>

const TRANSLATE_PAYLOAD_KIND = 'translate'

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
    'record_id', NEW.id,
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

export const generateAiTranslateTriggers = (table: Table): readonly string[] => {
  const aiTranslateFields = table.fields.filter(
    (field): field is AiTranslateField => field.type === 'ai-translate'
  )

  if (aiTranslateFields.length === 0) return []

  const sanitized = sanitizeTableName(table.name)
  return aiTranslateFields.flatMap((field) => buildTranslateTriggerSql(field, sanitized))
}
