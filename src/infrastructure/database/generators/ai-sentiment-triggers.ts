/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sanitizeTableName } from '../table-queries/shared/field-utils'
import {
  buildSourceChangedExpr,
  buildSourceContentExpr,
  escapeSqlString,
  resolveTriggerTiming,
  sqlNumberLiteral,
  sqlTextLiteral,
} from './ai-field-triggers'
import type { Table } from '@/domain/models/app/tables'
import type { Fields } from '@/domain/models/app/tables/fields'

/**
 * AI Sentiment field shape (narrowed from Fields union).
 */
type AiSentimentField = Extract<Fields[number], { readonly type: 'ai-sentiment' }>

/**
 * NOTIFY payload kind for ai-sentiment fields. The `AiComputeListener`
 * discriminates on this value to choose the sentiment prompt path.
 */
const SENTIMENT_PAYLOAD_KIND = 'sentiment'

/**
 * Deterministic synchronous placeholder for an ai-sentiment column: a
 * `jsonb_build_object('label', ..., 'score', ..., 'explanation', ...)` where
 * the label/score are picked by a coarse keyword heuristic against the
 * concatenated source content. PostgreSQL triggers cannot make outbound HTTP
 * calls, so the column holds this stub object (non-NULL, schema-shaped) inside
 * the INSERT transaction; the NOTIFY tells the `AiComputeListener` to invoke
 * the AI provider for the canonical sentiment analysis (observational — the
 * trigger value is authoritative for the synchronous SELECT immediately after
 * INSERT, like the summary / translate / extract patterns).
 *
 * Heuristic (deterministic, server-side PL/pgSQL):
 * - both positive & negative vocabulary present → `mixed`, score 0.5
 * - only positive vocabulary present            → `positive`, score 0.9
 * - only negative vocabulary present            → `negative`, score 0.9
 * - neither                                     → `neutral`, score 0.5
 *
 * `label` is always one of `positive` / `negative` / `neutral` / `mixed` and
 * `score` is always a float in `[0.0, 1.0]`, matching the field's documented
 * output contract.
 */
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

/**
 * Guard block for the sentiment function.
 *
 * Sentiment semantics mirror translate/extract: a changed source must
 * re-analyse, so the guard does not blanket-preserve an existing non-NULL
 * value on UPDATE.
 *
 * - INSERT: honour an explicit non-NULL user value (treated as override).
 * - UPDATE: if no configured source field changed, leave the row untouched
 *   (no recompute, no AI NOTIFY). If the user changed the sentiment column
 *   directly in this same statement, honour that override.
 * - Either op: NULL out the column when the concatenated source content is
 *   empty (matches "return NULL when all source fields are empty or NULL").
 */
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

/**
 * Placeholder + NOTIFY block for sentiment fields. The synchronous placeholder
 * is the heuristic-derived `{ label, score, explanation }` object; the NOTIFY
 * payload carries `kind: 'sentiment'`, the source text, and per-field overrides
 * so the `AiComputeListener` invokes the sentiment prompt path against the
 * configured AI provider.
 */
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

/**
 * Build the full set of SQL statements (function + drop + create trigger) for
 * a single ai-sentiment field. The sentiment function declares extra locals
 * (`sentiment_label`, `sentiment_score`, `has_positive`, `has_negative`) on
 * top of the shared `source_content` / `notify_payload`, so the function body
 * is assembled inline here (mirroring the categorize generator) rather than
 * via the shared `buildAiComputeTriggerStatements` helper (which only declares
 * the common locals).
 */
const buildSentimentTriggerSql = (
  field: AiSentimentField,
  sanitized: string
): readonly string[] => {
  const fieldName = field.name
  const functionName = `compute_${sanitized}_${fieldName}_sentiment`
  const triggerName = `trigger_${sanitized}_${fieldName}_ai_sentiment`
  const triggerTiming = resolveTriggerTiming(field.computeOn)
  const sourceExpr = buildSourceContentExpr(field.sourceFields)
  const functionBody = `${buildSentimentGuardSql(fieldName, field.sourceFields)}

${buildSentimentNotifySql(field, sanitized, fieldName)}`

  const functionSql = `CREATE OR REPLACE FUNCTION ${functionName}()
RETURNS TRIGGER AS $$
DECLARE
  source_content text := ${sourceExpr};
  notify_payload text;
  sentiment_label text;
  sentiment_score real;
  has_positive boolean;
  has_negative boolean;
BEGIN
${functionBody}
END;
$$ LANGUAGE plpgsql`

  return [
    functionSql,
    `DROP TRIGGER IF EXISTS ${triggerName} ON ${sanitized}`,
    `CREATE TRIGGER ${triggerName}
${triggerTiming} ON ${sanitized}
FOR EACH ROW
EXECUTE FUNCTION ${functionName}()`,
  ]
}

/**
 * Generate a BEFORE INSERT/UPDATE trigger that produces a deterministic
 * `{ label, score, explanation }` JSONB placeholder and emits a NOTIFY so the
 * application-layer `AiComputeListener` can invoke the real AI provider for
 * the canonical sentiment analysis.
 *
 * Returns NULL when all configured source fields are empty / NULL (no NOTIFY).
 */
export const generateAiSentimentTriggers = (table: Table): readonly string[] => {
  const aiSentimentFields = table.fields.filter(
    (field): field is AiSentimentField => field.type === 'ai-sentiment'
  )

  if (aiSentimentFields.length === 0) return []

  const sanitized = sanitizeTableName(table.name)
  return aiSentimentFields.flatMap((field) => buildSentimentTriggerSql(field, sanitized))
}
