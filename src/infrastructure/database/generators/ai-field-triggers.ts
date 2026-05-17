/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Shared building blocks for the per-kind ai-* compute trigger generators
 * (`ai-categorize-triggers.ts`, `ai-summary-triggers.ts`,
 * `ai-translate-triggers.ts`, `ai-extract-triggers.ts`,
 * `ai-sentiment-triggers.ts`, `ai-generate-triggers.ts`).
 *
 * This module is intentionally generator-free: it holds only the SQL-literal
 * helpers, the `source_content` / `source-changed` expression builders, the
 * trigger-timing resolver, the standard 3-statement trigger bundle, and the
 * `AI_COMPUTE_FIELD_TYPES` registry consulted by callers that need to know
 * whether an app schema has *any* ai-compute field (e.g. the server deciding
 * whether to start the `AiComputeListener`). The kind-specific PL/pgSQL lives
 * next to its `generateAi<Kind>Triggers` export in the sibling files above.
 */

/**
 * Field `type` literals that produce a PL/pgSQL compute trigger emitting on the
 * `sovrium_ai_compute` NOTIFY channel. Callers that need to know whether an app
 * schema has *any* such field (e.g. to decide whether to start the
 * `AiComputeListener`) should use {@link isAiComputeFieldType} rather than
 * inlining a growing literal disjunction. Extend this list when a new ai-* kind
 * gains a generator.
 */
export const AI_COMPUTE_FIELD_TYPES = [
  'ai-categorize',
  'ai-summary',
  'ai-translate',
  'ai-extract',
  'ai-sentiment',
  'ai-generate',
] as const

/**
 * True when `type` is one of the ai-* field types backed by a compute trigger.
 */
export const isAiComputeFieldType = (type: string): boolean =>
  (AI_COMPUTE_FIELD_TYPES as readonly string[]).includes(type)

/**
 * Escape single quotes for embedding in SQL literals.
 */
export const escapeSqlString = (value: string): string => value.replace(/'/g, "''")

/**
 * Compute-on setting shared by all AI compute field types.
 */
export type ComputeOn = 'create' | 'update' | 'both' | 'manual' | undefined

/**
 * Build the PL/pgSQL expression that concatenates the configured `sourceFields`
 * into a single `source_content` string. Each field is wrapped in
 * `COALESCE(..., '')` so NULLs become empty strings; segments are joined with
 * single-space separators. Shared by all ai-* trigger generators that read
 * from `sourceFields`.
 */
export const buildSourceContentExpr = (sourceFields: readonly string[]): string =>
  sourceFields.map((sf) => `COALESCE(NEW.${sf}::text, '')`).join(" || ' ' || ")

/**
 * Build the PL/pgSQL boolean expression that is TRUE when *any* configured
 * source field changed value in the current UPDATE statement. Used by the
 * summary/translate/extract/sentiment/generate guards to skip the recompute
 * (and the AI NOTIFY) when an unrelated column was touched.
 */
export const buildSourceChangedExpr = (sourceFields: readonly string[]): string =>
  sourceFields.map((sf) => `NEW.${sf} IS DISTINCT FROM OLD.${sf}`).join(' OR ')

/**
 * Resolve the trigger timing clause from a field's `computeOn` setting.
 * Defaults to `BEFORE INSERT` when omitted (compute-on-create).
 */
export const resolveTriggerTiming = (computeOn: ComputeOn): string => {
  const fireInsert = computeOn === 'create' || computeOn === 'both' ? 'BEFORE INSERT' : undefined
  const fireUpdate = computeOn === 'update' || computeOn === 'both' ? 'BEFORE UPDATE' : undefined
  if (fireInsert && fireUpdate) return 'BEFORE INSERT OR UPDATE'
  return fireInsert ?? fireUpdate ?? 'BEFORE INSERT'
}

/**
 * Render a `text` SQL literal from an optional config override: a quoted,
 * escaped string when set, or a typed `NULL::text` placeholder otherwise.
 * Used by the NOTIFY-payload builders to forward per-field overrides
 * (`prompt` / `systemPrompt` / `model` / …) verbatim.
 */
export const sqlTextLiteral = (value: string | undefined): string =>
  value !== undefined ? `'${escapeSqlString(value)}'` : `NULL::text`

/**
 * Render a numeric SQL literal from an optional config override: the bare
 * number when set, or a typed `NULL::<pgType>` placeholder otherwise.
 */
export const sqlNumberLiteral = (value: number | undefined, pgType: string): string =>
  value !== undefined ? `${value}` : `NULL::${pgType}`

/**
 * Build the standard 3-statement trigger bundle shared by ai-compute field
 * types whose function declares only the common `source_content` /
 * `notify_payload` locals: `CREATE OR REPLACE FUNCTION` body, `DROP TRIGGER IF
 * EXISTS`, and `CREATE TRIGGER` bound to the field's `computeOn` timing.
 *
 * Function name → `compute_<table>_<field>_<kindSlug>`,
 * trigger name → `trigger_<table>_<field>_ai_<kindSlug>`.
 *
 * (The `ai-categorize` generator does not use this helper because its function
 * declares additional locals and uses a legacy `category` function-name slug;
 * the `ai-sentiment` generator likewise declares extra locals and builds its
 * own scaffold.)
 *
 * @param functionBody the PL/pgSQL between `BEGIN` and `END;` (no wrappers)
 * @param sourceExpr the `source_content` initialiser expression
 */
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
