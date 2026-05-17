/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sanitizeTableName } from '../table-queries/shared/field-utils'
import { buildSourceContentExpr, escapeSqlString, resolveTriggerTiming } from './ai-field-triggers'
import type { Table } from '@/domain/models/app/tables'
import type { Fields } from '@/domain/models/app/tables/fields'

/**
 * AI Categorize field shape (narrowed from Fields union).
 */
type AiCategorizeField = Extract<Fields[number], { readonly type: 'ai-categorize' }>

/**
 * Build a PL/pgSQL array literal from a readonly string array.
 *
 * Returns: ARRAY['a','b','c']::text[]
 */
const buildTextArrayLiteral = (values: readonly string[]): string => {
  const escaped = values.map((v) => `'${escapeSqlString(v)}'`).join(',')
  return `ARRAY[${escaped}]::text[]`
}

/**
 * Preserve-then-empty-guard block for the PL/pgSQL classification function.
 * Returns PL/pgSQL that short-circuits when a value is already set or when
 * the source content is empty.
 */
const buildGuardSql = (
  fieldName: string
): string => `  -- Preserve explicit non-NULL values (user override)
  IF NEW.${fieldName} IS NOT NULL AND NEW.${fieldName} <> '' THEN
    RETURN NEW;
  END IF;

  -- NULL result when source content is empty
  IF source_content IS NULL OR btrim(source_content) = '' THEN
    NEW.${fieldName} = NULL;
    RETURN NEW;
  END IF;

  lower_content := lower(source_content);`

/**
 * Category-selection heuristics executed in PL/pgSQL order:
 *   1) exact keyword match, 2) billing vocabulary, 3) technical vocabulary,
 *   4) fallback to first configured category.
 */
const CATEGORY_SELECTION_SQL = `  -- 1) Try to match a category by exact keyword appearance in content
  FOREACH category IN ARRAY categories LOOP
    IF position(lower(category) in lower_content) > 0 THEN
      chosen := category;
      EXIT;
    END IF;
  END LOOP;

  -- 2) Heuristic: common billing-related vocabulary
  IF chosen IS NULL THEN
    IF lower_content ~ '(charge|refund|invoic|payment|subscrip|bill|pric)' THEN
      FOREACH category IN ARRAY categories LOOP
        IF lower(category) ~ '(bill|pay|financ)' THEN
          chosen := category;
          EXIT;
        END IF;
      END LOOP;
    END IF;
  END IF;

  -- 3) Heuristic: common technical-issue vocabulary
  IF chosen IS NULL THEN
    IF lower_content ~ '(crash|error|bug|down|500|server|api|broken|fail)' THEN
      FOREACH category IN ARRAY categories LOOP
        IF lower(category) ~ '(tech|bug|error|issue)' THEN
          chosen := category;
          EXIT;
        END IF;
      END LOOP;
    END IF;
  END IF;

  -- 4) Fallback: first category in the configured list
  IF chosen IS NULL AND array_length(categories, 1) > 0 THEN
    chosen := categories[1];
  END IF;`

/**
 * NOTIFY emission block: assigns the chosen category and emits a JSON payload
 * on the `sovrium_ai_compute` channel so the application layer can observe
 * classifications (and optionally invoke the real AI provider).
 */
const buildNotifySql = (sanitized: string, fieldName: string): string =>
  `  NEW.${fieldName} = chosen;

  -- Emit NOTIFY so the application layer can observe + log the classification.
  -- Payload format: JSON with table, field, value, and a condensed source prefix.
  notify_payload := json_build_object(
    'table', '${escapeSqlString(sanitized)}',
    'field', '${escapeSqlString(fieldName)}',
    'value', chosen,
    'source', left(source_content, 500),
    'categories', to_jsonb(categories)
  )::text;
  PERFORM pg_notify('sovrium_ai_compute', notify_payload);

  RETURN NEW;`

/**
 * Build the PL/pgSQL function body that performs the deterministic
 * classification + NOTIFY emission for a single ai-categorize field.
 *
 * See `generateAiCategorizeTriggers` for the classification steps.
 */
const buildCategorizeFunctionSql = (
  field: AiCategorizeField,
  sanitized: string,
  functionName: string
): string => {
  const fieldName = field.name
  const categoriesLiteral = buildTextArrayLiteral(field.categories)
  const sourceExpr = buildSourceContentExpr(field.sourceFields)

  return `CREATE OR REPLACE FUNCTION ${functionName}()
RETURNS TRIGGER AS $$
DECLARE
  categories text[] := ${categoriesLiteral};
  source_content text := ${sourceExpr};
  chosen text := NULL;
  lower_content text;
  category text;
  notify_payload text;
BEGIN
${buildGuardSql(fieldName)}

${CATEGORY_SELECTION_SQL}

${buildNotifySql(sanitized, fieldName)}
END;
$$ LANGUAGE plpgsql`
}

/**
 * Build the full set of SQL statements (function + drop + create trigger) for
 * a single ai-categorize field.
 */
const buildCategorizeTriggerSql = (
  field: AiCategorizeField,
  sanitized: string
): readonly string[] => {
  const fieldName = field.name
  const functionName = `compute_${sanitized}_${fieldName}_category`
  const triggerName = `trigger_${sanitized}_${fieldName}_ai_categorize`
  const triggerTiming = resolveTriggerTiming(field.computeOn)

  return [
    buildCategorizeFunctionSql(field, sanitized, functionName),
    `DROP TRIGGER IF EXISTS ${triggerName} ON ${sanitized}`,
    `CREATE TRIGGER ${triggerName}
${triggerTiming} ON ${sanitized}
FOR EACH ROW
EXECUTE FUNCTION ${functionName}()`,
  ]
}

/**
 * Generate a BEFORE INSERT/UPDATE trigger that classifies a record's
 * ai-categorize field into one of the configured categories.
 *
 * Classification logic (executed server-side in PL/pgSQL):
 * 1. If the record already has a non-NULL value, keep it (user override).
 * 2. If all source fields are NULL or empty, leave the field NULL.
 * 3. Otherwise, pick a category from the configured list based on deterministic
 *    keyword matching against the concatenated source content. Falls back to the
 *    first category if no keyword matches.
 * 4. Emits pg_notify on the 'sovrium_ai_compute' channel so the application
 *    layer can log the compute event (and optionally invoke the real AI provider).
 *
 * Runtime Note: PostgreSQL triggers cannot make HTTP calls synchronously.
 * The deterministic category-picking keeps the INSERT synchronous while the
 * NOTIFY gives the application layer a hook for any side-effect logging.
 */
export const generateAiCategorizeTriggers = (table: Table): readonly string[] => {
  const aiCategorizeFields = table.fields.filter(
    (field): field is AiCategorizeField => field.type === 'ai-categorize'
  )

  if (aiCategorizeFields.length === 0) return []

  const sanitized = sanitizeTableName(table.name)
  return aiCategorizeFields.flatMap((field) => buildCategorizeTriggerSql(field, sanitized))
}
