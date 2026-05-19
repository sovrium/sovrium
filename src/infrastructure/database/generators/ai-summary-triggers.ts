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

type AiSummaryField = Extract<Fields[number], { readonly type: 'ai-summary' }>

const SUMMARY_PAYLOAD_KIND = 'summary'

const DEFAULT_PLACEHOLDER_CAP = 200

const buildSummaryGuardSql = (fieldName: string, sourceFields: readonly string[]): string =>
  `  -- INSERT: honour an explicit non-empty user value.
  IF TG_OP = 'INSERT' THEN
    IF NEW.${fieldName} IS NOT NULL AND NEW.${fieldName} <> '' THEN
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Source unchanged: nothing to re-summarise — leave the row as-is.
    IF NOT (${buildSourceChangedExpr(sourceFields)}) THEN
      RETURN NEW;
    END IF;
    -- User changed the summary column directly in this statement: honour it.
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

const buildSummaryNotifySql = (
  field: AiSummaryField,
  sanitized: string,
  fieldName: string
): string => {
  const cap = field.maxLength ?? DEFAULT_PLACEHOLDER_CAP
  const promptLiteral =
    field.prompt !== undefined
      ? `'${escapeSqlString(field.prompt)}'`
      : `'Summarize the following content concisely'`
  const modelLiteral = sqlTextLiteral(field.model)
  const temperatureLiteral = sqlNumberLiteral(field.temperature, 'real')
  const maxTokensLiteral = sqlNumberLiteral(field.maxTokens, 'int')

  return `  NEW.${fieldName} = left(btrim(source_content), ${cap});

  -- Emit NOTIFY so the application layer can observe + log the summary
  -- compute event and invoke the AI provider for the canonical summary.
  -- Payload format: JSON with kind discriminator, table, field, source,
  -- and configuration overrides (prompt/model/temperature/maxTokens/maxLength).
  notify_payload := json_build_object(
    'kind', '${SUMMARY_PAYLOAD_KIND}',
    'table', '${escapeSqlString(sanitized)}',
    'field', '${escapeSqlString(fieldName)}',
    'value', NEW.${fieldName},
    'source', left(source_content, 2000),
    'prompt', ${promptLiteral},
    'model', ${modelLiteral},
    'temperature', ${temperatureLiteral},
    'maxTokens', ${maxTokensLiteral},
    'maxLength', ${field.maxLength ?? 'NULL::int'}
  )::text;
  PERFORM pg_notify('sovrium_ai_compute', notify_payload);

  RETURN NEW;`
}

const buildSummaryTriggerSql = (field: AiSummaryField, sanitized: string): readonly string[] => {
  if (field.computeOn === 'manual') return []

  const fieldName = field.name
  const functionBody = `${buildSummaryGuardSql(fieldName, field.sourceFields)}

${buildSummaryNotifySql(field, sanitized, fieldName)}`

  return buildAiComputeTriggerStatements({
    sanitized,
    fieldName,
    kindSlug: 'summary',
    computeOn: field.computeOn,
    functionBody,
    sourceExpr: buildSourceContentExpr(field.sourceFields),
  })
}

export const generateAiSummaryTriggers = (table: Table): readonly string[] => {
  const aiSummaryFields = table.fields.filter(
    (field): field is AiSummaryField => field.type === 'ai-summary'
  )

  if (aiSummaryFields.length === 0) return []

  const sanitized = sanitizeTableName(table.name)
  return aiSummaryFields.flatMap((field) => buildSummaryTriggerSql(field, sanitized))
}
