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
 * AI Summary field shape (narrowed from Fields union).
 */
type AiSummaryField = Extract<Fields[number], { readonly type: 'ai-summary' }>

/**
 * NOTIFY payload kind for ai-summary fields. The `AiComputeListener` discriminates
 * on this value to choose between categorize-style and summary-style prompts.
 */
const SUMMARY_PAYLOAD_KIND = 'summary'

/**
 * Default placeholder character cap. AI's free-form summary is async (it lands
 * via the observational AI call in the listener); the synchronous trigger
 * value is a deterministic excerpt so the column is non-NULL inside the
 * INSERT transaction. Capped to keep the placeholder short and predictable.
 */
const DEFAULT_PLACEHOLDER_CAP = 200

/**
 * Guard block for the summary function.
 *
 * Summary semantics match translate's: a changed source must re-summarise, so
 * the guard does *not* blanket-preserve an existing non-NULL value on UPDATE.
 * Instead:
 *
 * - INSERT: preserve an explicit non-empty user value.
 * - UPDATE: if the source field(s) did not change, leave the row untouched
 *   (no recompute, no AI NOTIFY — avoids wasteful provider calls when an
 *   unrelated column is updated). If the user changed the summary column
 *   directly in this same statement, honour that override.
 * - Either op: NULL out the column when the source content is empty.
 */
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

/**
 * Placeholder selection + NOTIFY block for summary fields.
 *
 * The deterministic placeholder is a trimmed excerpt of the concatenated
 * source content, capped at either `maxLength` (when set) or
 * `DEFAULT_PLACEHOLDER_CAP`. The NOTIFY payload carries `kind: 'summary'` so
 * the listener invokes the summary prompt path rather than the categorize one.
 */
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

  return `  NEW.${fieldName} = left(btrim(source_content), ${cap});

  -- Emit NOTIFY so the application layer can observe + log the summary
  -- compute event and invoke the AI provider for the canonical summary.
  -- Payload format: JSON with kind discriminator, table, field, source,
  -- and configuration overrides (prompt/model/temperature/maxLength).
  notify_payload := json_build_object(
    'kind', '${SUMMARY_PAYLOAD_KIND}',
    'table', '${escapeSqlString(sanitized)}',
    'field', '${escapeSqlString(fieldName)}',
    'value', NEW.${fieldName},
    'source', left(source_content, 2000),
    'prompt', ${promptLiteral},
    'model', ${modelLiteral},
    'temperature', ${temperatureLiteral},
    'maxLength', ${field.maxLength ?? 'NULL::int'}
  )::text;
  PERFORM pg_notify('sovrium_ai_compute', notify_payload);

  RETURN NEW;`
}

/**
 * Build the full set of SQL statements (function + drop + create trigger) for
 * a single ai-summary field. Returns `[]` when `computeOn === 'manual'`,
 * matching the user-story expectation that manual fields stay NULL until
 * explicitly triggered.
 *
 * The function fills the column with a deterministic excerpt of the source
 * content so the column is non-NULL inside the same transaction as the
 * INSERT. The NOTIFY payload tells the listener to invoke the AI provider
 * for the canonical free-form summary (observational only — the trigger
 * value is authoritative for the synchronous SELECT immediately after
 * INSERT, matching the categorize pattern).
 */
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

/**
 * Generate a BEFORE INSERT/UPDATE trigger that produces a deterministic
 * placeholder summary and emits a NOTIFY so the application-layer
 * `AiComputeListener` can invoke the real AI provider for the canonical
 * free-form summary.
 *
 * Why a placeholder?
 *
 * PostgreSQL triggers cannot make outbound HTTP calls in PL/pgSQL, so the
 * synchronous trigger writes a non-NULL excerpt of the concatenated source
 * content (capped at `maxLength` or `DEFAULT_PLACEHOLDER_CAP`). This lets
 * tests asserting on `summary` immediately after INSERT see a string value
 * (matching the synchronous-first contract used by the categorize triggers).
 * The NOTIFY payload includes `kind: 'summary'` so the listener picks the
 * summary prompt template; the AI response itself is currently used only
 * for audit / observability (see `AiComputeListener.handlePayload`).
 *
 * `computeOn: 'manual'` produces zero statements — the field stays NULL
 * until explicitly triggered by an out-of-band mechanism.
 */
export const generateAiSummaryTriggers = (table: Table): readonly string[] => {
  const aiSummaryFields = table.fields.filter(
    (field): field is AiSummaryField => field.type === 'ai-summary'
  )

  if (aiSummaryFields.length === 0) return []

  const sanitized = sanitizeTableName(table.name)
  return aiSummaryFields.flatMap((field) => buildSummaryTriggerSql(field, sanitized))
}
