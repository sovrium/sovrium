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

type AiGenerateField = Extract<Fields[number], { readonly type: 'ai-generate' }>

const GENERATE_PAYLOAD_KIND = 'generate'

const buildInterpolatedPromptExpr = (prompt: string, sourceFields: readonly string[]): string => {
  const base = `'${escapeSqlString(prompt)}'`
  return sourceFields.reduce(
    (acc, sf) => `replace(${acc}, '{{${escapeSqlString(sf)}}}', COALESCE(NEW.${sf}::text, ''))`,
    base
  )
}

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

export const generateAiGenerateTriggers = (table: Table): readonly string[] => {
  const aiGenerateFields = table.fields.filter(
    (field): field is AiGenerateField => field.type === 'ai-generate'
  )

  if (aiGenerateFields.length === 0) return []

  const sanitized = sanitizeTableName(table.name)
  return aiGenerateFields.flatMap((field) => buildGenerateTriggerSql(field, sanitized))
}
