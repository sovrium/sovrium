/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sanitizeTableName } from '../table-queries/shared/field-utils'
import {
  buildSourceContentExpr,
  buildTextArrayLiteral,
  escapeSqlString,
  resolveTriggerTiming,
  sqlTextLiteral,
} from './ai-field-triggers'
import type { Table } from '@/domain/models/app/tables'
import type { Fields } from '@/domain/models/app/tables/fields'

type AiTagField = Extract<Fields[number], { readonly type: 'ai-tag' }>

const TAG_PAYLOAD_KIND = 'categorize'

const buildTagGuardSql = (fieldName: string): string =>
  `  -- INSERT: honour an explicit non-empty user-supplied tag array.
  IF TG_OP = 'INSERT' THEN
    IF NEW.${fieldName} IS NOT NULL
       AND jsonb_typeof(NEW.${fieldName}) = 'array'
       AND jsonb_array_length(NEW.${fieldName}) > 0 THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Empty source content: leave the column as an empty array.
  IF source_content IS NULL OR btrim(source_content) = '' THEN
    NEW.${fieldName} = '[]'::jsonb;
    RETURN NEW;
  END IF;

  lower_content := lower(source_content);`

const buildTagSelectionSql = (field: AiTagField): string => {
  const maxTagsLimit = field.maxTags !== undefined ? `  chosen := chosen[1:${field.maxTags}];` : ''
  return `  -- Collect every tag whose keyword appears in the content.
  FOREACH tag IN ARRAY tags LOOP
    IF position(lower(tag) in lower_content) > 0 THEN
      chosen := array_append(chosen, tag);
    END IF;
  END LOOP;

  -- Fallback: assign the first configured tag when nothing matched.
  IF array_length(chosen, 1) IS NULL AND array_length(tags, 1) > 0 THEN
    chosen := array_append(chosen, tags[1]);
  END IF;
${maxTagsLimit}`
}

const buildTagNotifySql = (field: AiTagField, sanitized: string, fieldName: string): string => {
  const modelLiteral = sqlTextLiteral(field.model)
  return `  NEW.${fieldName} = to_jsonb(chosen);

  -- Emit NOTIFY so the application layer can observe + log the tagging
  -- and invoke the AI provider with the field's model override.
  notify_payload := json_build_object(
    'kind', '${TAG_PAYLOAD_KIND}',
    'table', '${escapeSqlString(sanitized)}',
    'field', '${escapeSqlString(fieldName)}',
    'record_id', NEW.id,
    'value', array_to_string(chosen, ', '),
    'source', left(source_content, 500),
    'categories', to_jsonb(tags),
    'model', ${modelLiteral}
  )::text;
  PERFORM pg_notify('sovrium_ai_compute', notify_payload);

  RETURN NEW;`
}

const buildTagFunctionSql = (
  field: AiTagField,
  sanitized: string,
  functionName: string
): string => {
  const fieldName = field.name
  const tagsLiteral = buildTextArrayLiteral(field.tags)
  const sourceExpr = buildSourceContentExpr(field.sourceFields)

  return `CREATE OR REPLACE FUNCTION ${functionName}()
RETURNS TRIGGER AS $$
DECLARE
  tags text[] := ${tagsLiteral};
  source_content text := ${sourceExpr};
  chosen text[] := ARRAY[]::text[];
  lower_content text;
  tag text;
  notify_payload text;
BEGIN
${buildTagGuardSql(fieldName)}

${buildTagSelectionSql(field)}

${buildTagNotifySql(field, sanitized, fieldName)}
END;
$$ LANGUAGE plpgsql`
}

const buildTagTriggerSql = (field: AiTagField, sanitized: string): readonly string[] => {
  const fieldName = field.name
  const functionName = `compute_${sanitized}_${fieldName}_tag`
  const triggerName = `trigger_${sanitized}_${fieldName}_ai_tag`
  const triggerTiming = resolveTriggerTiming(field.computeOn)

  return [
    buildTagFunctionSql(field, sanitized, functionName),
    `DROP TRIGGER IF EXISTS ${triggerName} ON ${sanitized}`,
    `CREATE TRIGGER ${triggerName}
${triggerTiming} ON ${sanitized}
FOR EACH ROW
EXECUTE FUNCTION ${functionName}()`,
  ]
}

export const generateAiTagTriggers = (table: Table): readonly string[] => {
  const aiTagFields = table.fields.filter((field): field is AiTagField => field.type === 'ai-tag')

  if (aiTagFields.length === 0) return []

  const sanitized = sanitizeTableName(table.name)
  return aiTagFields.flatMap((field) => buildTagTriggerSql(field, sanitized))
}
