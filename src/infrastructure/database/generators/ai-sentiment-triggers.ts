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

type AiSentimentField = Extract<Fields[number], { readonly type: 'ai-sentiment' }>

const SENTIMENT_PAYLOAD_KIND = 'sentiment'

const SENTIMENT_PLACEHOLDER_SQL = `  -- Deterministic keyword heuristic for the synchronous placeholder.
  has_positive := lower(source_content) ~ '(love|great|amazing|wonderful|excellent|awesome|outstanding|fantastic|good|happy|perfect|best|delight)';
  has_negative := lower(source_content) ~ '(terrible|awful|bad|horrible|worst|hate|disappoint|broken|slow|lost|urgent|angry|frustrat|poor|fail)';
  IF has_positive AND has_negative THEN
    sentiment_label := 'mixed';
    sentiment_score := 0.5;
  ELSIF has_positive THEN
    sentiment_label := 'positive';
    sentiment_score := 0.9;
  ELSIF has_negative THEN
    sentiment_label := 'negative';
    sentiment_score := 0.9;
  ELSE
    sentiment_label := 'neutral';
    sentiment_score := 0.5;
  END IF;`

const buildSentimentGuardSql = (fieldName: string, sourceFields: readonly string[]): string =>
  `  -- INSERT: honour an explicit non-NULL user value.
  IF TG_OP = 'INSERT' THEN
    IF NEW.${fieldName} IS NOT NULL THEN
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Source unchanged: nothing to re-analyse — leave the row as-is.
    IF NOT (${buildSourceChangedExpr(sourceFields)}) THEN
      RETURN NEW;
    END IF;
    -- User changed the sentiment column directly in this statement: honour it.
    IF NEW.${fieldName} IS DISTINCT FROM OLD.${fieldName} AND NEW.${fieldName} IS NOT NULL THEN
      RETURN NEW;
    END IF;
  END IF;

  -- NULL result when source content is empty
  IF source_content IS NULL OR btrim(source_content) = '' THEN
    NEW.${fieldName} = NULL;
    RETURN NEW;
  END IF;`

const buildSentimentNotifySql = (
  field: AiSentimentField,
  sanitized: string,
  fieldName: string
): string => {
  const promptLiteral = sqlTextLiteral(field.prompt)
  const systemPromptLiteral = sqlTextLiteral(field.systemPrompt)
  const modelLiteral = sqlTextLiteral(field.model)
  const temperatureLiteral = sqlNumberLiteral(field.temperature, 'real')
  const maxTokensLiteral = sqlNumberLiteral(field.maxTokens, 'int')

  return `${SENTIMENT_PLACEHOLDER_SQL}

  NEW.${fieldName} = jsonb_build_object(
    'label', sentiment_label,
    'score', sentiment_score,
    'explanation', 'Deterministic placeholder based on keyword analysis of the source text.'
  );

  -- Emit NOTIFY so the application layer can observe + log the sentiment
  -- compute event and invoke the AI provider for the canonical analysis.
  -- Payload format: JSON with kind discriminator, table, field, source,
  -- and configuration overrides.
  notify_payload := json_build_object(
    'kind', '${SENTIMENT_PAYLOAD_KIND}',
    'table', '${escapeSqlString(sanitized)}',
    'field', '${escapeSqlString(fieldName)}',
    'record_id', NEW.id,
    'value', NEW.${fieldName}::text,
    'source', left(source_content, 4000),
    'prompt', ${promptLiteral},
    'systemPrompt', ${systemPromptLiteral},
    'model', ${modelLiteral},
    'temperature', ${temperatureLiteral},
    'maxTokens', ${maxTokensLiteral}
  )::text;
  PERFORM pg_notify('sovrium_ai_compute', notify_payload);

  RETURN NEW;`
}

const buildSentimentTriggerSql = (
  field: AiSentimentField,
  sanitized: string
): readonly string[] => {
  const fieldName = field.name
  const functionBody = `${buildSentimentGuardSql(fieldName, field.sourceFields)}

${buildSentimentNotifySql(field, sanitized, fieldName)}`

  return buildAiComputeTriggerStatements({
    sanitized,
    fieldName,
    kindSlug: 'sentiment',
    computeOn: field.computeOn,
    functionBody,
    sourceExpr: buildSourceContentExpr(field.sourceFields),
    extraDeclarations: [
      'sentiment_label text',
      'sentiment_score real',
      'has_positive boolean',
      'has_negative boolean',
    ],
  })
}

export const generateAiSentimentTriggers = (table: Table): readonly string[] => {
  const aiSentimentFields = table.fields.filter(
    (field): field is AiSentimentField => field.type === 'ai-sentiment'
  )

  if (aiSentimentFields.length === 0) return []

  const sanitized = sanitizeTableName(table.name)
  return aiSentimentFields.flatMap((field) => buildSentimentTriggerSql(field, sanitized))
}
