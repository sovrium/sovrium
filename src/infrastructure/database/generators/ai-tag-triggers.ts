/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sanitizeTableName } from '@/domain/kernel/sql/table-naming'
import {
  buildAiComputeTriggerStatements,
  buildSourceContentExpr,
  buildTextArrayLiteral,
  escapeSqlString,
  sqlTextLiteral,
} from './ai-field-triggers'
import type { Table } from '@/domain/models/app/tables'
import type { Fields } from '@/domain/models/app/tables/fields'

/**
 * AI Tag field shape (narrowed from Fields union).
 */
type AiTagField = Extract<Fields[number], { readonly type: 'ai-tag' }>

/**
 * NOTIFY payload kind for ai-tag fields. Reuses the categorize discriminator so
 * the `AiComputeListener` invokes the classification prompt path — tagging is
 * a multi-label classification over a fixed vocabulary. The per-field `model`
 * override travels in the same payload so the AI mock observes the chosen model.
 */
const TAG_PAYLOAD_KIND = 'categorize'

/**
 * Guard block for the tag function.
 *
 * - INSERT: preserve an explicit non-default user value (a non-empty JSONB
 *   array supplied directly).
 * - Either op: leave the column as the default empty array `[]` when the
 *   source content is empty.
 */
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

/**
 * Tag-selection block: deterministically collect every configured tag whose
 * lowercased text appears in the source content. When no tag matches, fall
 * back to the first configured tag so the column is never empty for non-empty
 * input. Honours `maxTags` by truncating the selection.
 */
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

/**
 * NOTIFY emission block: assigns the chosen tags as a JSONB array and emits a
 * payload on `sovrium_ai_compute` carrying `kind: 'categorize'`, the tag
 * vocabulary (as `categories`), and the per-field `model` override so the
 * application layer can invoke the real AI provider with the right model.
 */
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

/**
 * Build the full set of SQL statements (function + drop + create trigger) for a
 * single ai-tag field via the shared {@link buildAiComputeTriggerStatements}
 * scaffold. The tag function needs the common `source_content`/`notify_payload`
 * locals plus the `tags` vocabulary array and the `chosen`/`lower_content`/`tag`
 * scratch locals, forwarded through `extraDeclarations`.
 */
const buildTagTriggerSql = (field: AiTagField, sanitized: string): readonly string[] => {
  const fieldName = field.name
  const functionBody = `${buildTagGuardSql(fieldName)}

${buildTagSelectionSql(field)}

${buildTagNotifySql(field, sanitized, fieldName)}`

  return buildAiComputeTriggerStatements({
    sanitized,
    fieldName,
    kindSlug: 'tag',
    computeOn: field.computeOn,
    functionBody,
    sourceExpr: buildSourceContentExpr(field.sourceFields),
    extraDeclarations: [
      `tags text[] := ${buildTextArrayLiteral(field.tags)}`,
      'chosen text[] := ARRAY[]::text[]',
      'lower_content text',
      'tag text',
    ],
  })
}

/**
 * Generate a BEFORE INSERT/UPDATE trigger that assigns a record's ai-tag field
 * a JSONB array of labels selected from the configured `tags` vocabulary.
 *
 * Tagging logic (executed server-side in PL/pgSQL):
 * 1. If the record already has a non-empty tag array, keep it (user override).
 * 2. If all source fields are NULL or empty, leave the column as `[]`.
 * 3. Otherwise, deterministically collect every tag whose keyword appears in
 *    the concatenated source content (falling back to the first tag when none
 *    match), truncated to `maxTags` when configured.
 * 4. Emits pg_notify on the 'sovrium_ai_compute' channel — carrying the field's
 *    `model` override — so the application layer can invoke the real AI
 *    provider for the canonical tagging.
 *
 * Runtime Note: PostgreSQL triggers cannot make HTTP calls synchronously. The
 * deterministic tag-picking keeps the INSERT synchronous while the NOTIFY gives
 * the application layer a hook for the observational AI provider round-trip.
 */
export const generateAiTagTriggers = (table: Table): readonly string[] => {
  const aiTagFields = table.fields.filter((field): field is AiTagField => field.type === 'ai-tag')

  if (aiTagFields.length === 0) return []

  const sanitized = sanitizeTableName(table.name)
  return aiTagFields.flatMap((field) => buildTagTriggerSql(field, sanitized))
}
