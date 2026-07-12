/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sanitizeTableName } from '../table-queries/shared/field-utils'
import {
  buildAiComputeTriggerStatements,
  buildSourceContentExpr,
  buildTextArrayLiteral,
  escapeSqlString,
} from './ai-field-triggers'
import type { Table } from '@/domain/models/app/tables'
import type { Fields } from '@/domain/models/app/tables/fields'

type AiCategorizeField = Extract<Fields[number], { readonly type: 'ai-categorize' }>

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

const buildNotifySql = (sanitized: string, fieldName: string): string =>
  `  NEW.${fieldName} = chosen;

  -- Emit NOTIFY so the application layer can observe + log the classification.
  -- Payload format: JSON with table, field, value, and a condensed source prefix.
  notify_payload := json_build_object(
    'kind', 'categorize',
    'table', '${escapeSqlString(sanitized)}',
    'field', '${escapeSqlString(fieldName)}',
    'record_id', NEW.id,
    'value', chosen,
    'source', left(source_content, 500),
    'categories', to_jsonb(categories)
  )::text;
  PERFORM pg_notify('sovrium_ai_compute', notify_payload);

  RETURN NEW;`

const buildCategorizeTriggerSql = (
  field: AiCategorizeField,
  sanitized: string
): readonly string[] => {
  const fieldName = field.name
  const functionBody = `${buildGuardSql(fieldName)}

${CATEGORY_SELECTION_SQL}

${buildNotifySql(sanitized, fieldName)}`

  return buildAiComputeTriggerStatements({
    sanitized,
    fieldName,
    kindSlug: 'categorize',
    functionNameSlug: 'category',
    computeOn: field.computeOn,
    functionBody,
    sourceExpr: buildSourceContentExpr(field.sourceFields),
    extraDeclarations: [
      `categories text[] := ${buildTextArrayLiteral(field.categories)}`,
      'chosen text := NULL',
      'lower_content text',
      'category text',
    ],
  })
}

export const generateAiCategorizeTriggers = (table: Table): readonly string[] => {
  const aiCategorizeFields = table.fields.filter(
    (field): field is AiCategorizeField => field.type === 'ai-categorize'
  )

  if (aiCategorizeFields.length === 0) return []

  const sanitized = sanitizeTableName(table.name)
  return aiCategorizeFields.flatMap((field) => buildCategorizeTriggerSql(field, sanitized))
}
