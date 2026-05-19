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

type AiExtractField = Extract<Fields[number], { readonly type: 'ai-extract' }>

const EXTRACT_PAYLOAD_KIND = 'extract'

type ExtractProperty = { readonly name: string; readonly scalarKind: 'numeric' | 'other' }

const classifyExtractProperty = (def: unknown): 'numeric' | 'other' => {
  const typeName =
    typeof def === 'string'
      ? def
      : def !== null && typeof def === 'object'
        ? (def as Record<string, unknown>)['type']
        : undefined
  return typeName === 'number' || typeName === 'integer' ? 'numeric' : 'other'
}

const resolveExtractProperties = (
  schema: Readonly<Record<string, unknown>>
): readonly ExtractProperty[] => {
  const props = schema['properties']
  const entries =
    props !== null && typeof props === 'object'
      ? Object.entries(props as Record<string, unknown>)
      : Object.entries(schema).filter(([k]) => k !== 'type')
  return entries.map(([name, def]) => ({ name, scalarKind: classifyExtractProperty(def) }))
}

const buildExtractPlaceholderExpr = (properties: readonly ExtractProperty[]): string => {
  if (properties.length === 0) return `'{}'::jsonb`
  const pairs = properties
    .map((p) =>
      p.scalarKind === 'numeric'
        ? `'${escapeSqlString(p.name)}', NULL::text`
        : `'${escapeSqlString(p.name)}', left(btrim(source_content), 500)`
    )
    .join(', ')
  return `jsonb_build_object(${pairs})`
}

const buildExtractGuardSql = (fieldName: string, sourceFields: readonly string[]): string =>
  `  -- INSERT: honour an explicit non-NULL user value.
  IF TG_OP = 'INSERT' THEN
    IF NEW.${fieldName} IS NOT NULL THEN
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Source unchanged: nothing to re-extract — leave the row as-is.
    IF NOT (${buildSourceChangedExpr(sourceFields)}) THEN
      RETURN NEW;
    END IF;
    -- User changed the extracted column directly in this statement: honour it.
    IF NEW.${fieldName} IS DISTINCT FROM OLD.${fieldName} AND NEW.${fieldName} IS NOT NULL THEN
      RETURN NEW;
    END IF;
  END IF;

  -- NULL result when source content is empty
  IF source_content IS NULL OR btrim(source_content) = '' THEN
    NEW.${fieldName} = NULL;
    RETURN NEW;
  END IF;`

const buildExtractNotifySql = (
  field: AiExtractField,
  sanitized: string,
  fieldName: string,
  properties: readonly ExtractProperty[]
): string => {
  const placeholderExpr = buildExtractPlaceholderExpr(properties)
  const schemaLiteral = `'${escapeSqlString(JSON.stringify(field.schema))}'`
  const promptLiteral = sqlTextLiteral(field.prompt)
  const systemPromptLiteral = sqlTextLiteral(field.systemPrompt)
  const modelLiteral = sqlTextLiteral(field.model)
  const temperatureLiteral = sqlNumberLiteral(field.temperature, 'real')
  const maxTokensLiteral = sqlNumberLiteral(field.maxTokens, 'int')

  return `  NEW.${fieldName} = ${placeholderExpr};

  -- Emit NOTIFY so the application layer can observe + log the extract
  -- compute event and invoke the AI provider for the canonical extraction.
  -- Payload format: JSON with kind discriminator, table, field, source,
  -- schema (serialised JSON Schema), and configuration overrides.
  notify_payload := json_build_object(
    'kind', '${EXTRACT_PAYLOAD_KIND}',
    'table', '${escapeSqlString(sanitized)}',
    'field', '${escapeSqlString(fieldName)}',
    'value', NEW.${fieldName}::text,
    'source', left(source_content, 4000),
    'schema', ${schemaLiteral},
    'prompt', ${promptLiteral},
    'systemPrompt', ${systemPromptLiteral},
    'model', ${modelLiteral},
    'temperature', ${temperatureLiteral},
    'maxTokens', ${maxTokensLiteral}
  )::text;
  PERFORM pg_notify('sovrium_ai_compute', notify_payload);

  RETURN NEW;`
}

const buildExtractTriggerSql = (field: AiExtractField, sanitized: string): readonly string[] => {
  const fieldName = field.name
  const properties = resolveExtractProperties(field.schema)
  const functionBody = `${buildExtractGuardSql(fieldName, field.sourceFields)}

${buildExtractNotifySql(field, sanitized, fieldName, properties)}`

  return buildAiComputeTriggerStatements({
    sanitized,
    fieldName,
    kindSlug: 'extract',
    computeOn: field.computeOn,
    functionBody,
    sourceExpr: buildSourceContentExpr(field.sourceFields),
  })
}

export const generateAiExtractTriggers = (table: Table): readonly string[] => {
  const aiExtractFields = table.fields.filter(
    (field): field is AiExtractField => field.type === 'ai-extract'
  )

  if (aiExtractFields.length === 0) return []

  const sanitized = sanitizeTableName(table.name)
  return aiExtractFields.flatMap((field) => buildExtractTriggerSql(field, sanitized))
}
