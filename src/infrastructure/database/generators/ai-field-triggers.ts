/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


export const AI_COMPUTE_FIELD_TYPES = [
  'ai-categorize',
  'ai-summary',
  'ai-tag',
  'ai-translate',
  'ai-extract',
  'ai-sentiment',
  'ai-generate',
] as const

export const isAiComputeFieldType = (type: string): boolean =>
  (AI_COMPUTE_FIELD_TYPES as readonly string[]).includes(type)

export const escapeSqlString = (value: string): string => value.replace(/'/g, "''")

export type ComputeOn = 'create' | 'update' | 'both' | 'manual' | undefined

export const buildSourceContentExpr = (sourceFields: readonly string[]): string =>
  sourceFields.map((sf) => `COALESCE(NEW.${sf}::text, '')`).join(" || ' ' || ")

export const buildSourceChangedExpr = (sourceFields: readonly string[]): string =>
  sourceFields.map((sf) => `NEW.${sf} IS DISTINCT FROM OLD.${sf}`).join(' OR ')

export const resolveTriggerTiming = (computeOn: ComputeOn): string => {
  const fireInsert = computeOn === 'create' || computeOn === 'both' ? 'BEFORE INSERT' : undefined
  const fireUpdate = computeOn === 'update' || computeOn === 'both' ? 'BEFORE UPDATE' : undefined
  if (fireInsert && fireUpdate) return 'BEFORE INSERT OR UPDATE'
  return fireInsert ?? fireUpdate ?? 'BEFORE INSERT'
}

export const sqlTextLiteral = (value: string | undefined): string =>
  value !== undefined ? `'${escapeSqlString(value)}'` : `NULL::text`

export const sqlNumberLiteral = (value: number | undefined, pgType: string): string =>
  value !== undefined ? `${value}` : `NULL::${pgType}`

export const buildTextArrayLiteral = (values: readonly string[]): string => {
  const escaped = values.map((v) => `'${escapeSqlString(v)}'`).join(',')
  return `ARRAY[${escaped}]::text[]`
}

export const buildAiComputeTriggerStatements = (params: {
  readonly sanitized: string
  readonly fieldName: string
  readonly kindSlug: string
  readonly computeOn: ComputeOn
  readonly functionBody: string
  readonly sourceExpr: string
}): readonly string[] => {
  const { sanitized, fieldName, kindSlug, computeOn, functionBody, sourceExpr } = params
  const functionName = `compute_${sanitized}_${fieldName}_${kindSlug}`
  const triggerName = `trigger_${sanitized}_${fieldName}_ai_${kindSlug}`
  const triggerTiming = resolveTriggerTiming(computeOn)

  const functionSql = `CREATE OR REPLACE FUNCTION ${functionName}()
RETURNS TRIGGER AS $$
DECLARE
  source_content text := ${sourceExpr};
  notify_payload text;
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
