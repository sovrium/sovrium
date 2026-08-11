/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable unicorn/no-null -- `null` is the contractual empty-source
   baseline value: it maps to SQL NULL on write (mirroring the PG trigger's
   `NEW.field = NULL` empty branch), so the baseline functions return `null`
   (not `undefined`) to clear the column. */

/**
 * Shared deterministic AI-compute **baseline** logic (Phase 2, [internal ref]).
 *
 * An AI-compute field is two-phase: a synchronous deterministic baseline
 * (this module) plus an async best-effort refinement (Stage B). The baseline
 * is computed locally with zero network calls, is always type-valid, and is
 * the FINAL value when the AI provider is disabled/unreachable.
 *
 * This module is the SINGLE SOURCE OF TRUTH for the deterministic transform.
 * It reproduces — byte-for-byte for representative inputs — the PL/pgSQL the
 * Postgres trigger generators emit
 * (`infrastructure/database/generators/ai-{summary,categorize,…}-triggers.ts`).
 * The PG triggers keep their inline SQL (synchronous BEFORE-trigger placement
 * is unchanged); a co-located unit test asserts TS↔SQL parity for the simple
 * kinds. The SQLite write path has no procedural language, so it consults
 * these TS functions directly in an in-process pre-insert hook.
 *
 * Pure functions only — no Effect, no I/O. Each `computeAi<Kind>Baseline`
 * takes the already-concatenated `source` string (the caller joins the
 * configured `sourceFields` the same way the PG `source_content` local does:
 * `COALESCE(field, '')` segments joined by single spaces) plus the per-field
 * config, and returns the baseline value (or `null` on empty source).
 */

/**
 * The AI-compute field `type` literals that carry a deterministic baseline.
 */
export type AiComputeKind =
  | 'ai-summary'
  | 'ai-categorize'
  | 'ai-tag'
  | 'ai-translate'
  | 'ai-extract'
  | 'ai-sentiment'
  | 'ai-generate'

/**
 * Default placeholder character cap for ai-summary (mirrors
 * `DEFAULT_PLACEHOLDER_CAP` in `ai-summary-triggers.ts`).
 */
export const DEFAULT_SUMMARY_CAP = 200

/**
 * Excerpt cap for non-numeric ai-extract properties (mirrors the
 * `left(btrim(source_content), 500)` literal in `ai-extract-triggers.ts`).
 */
const EXTRACT_EXCERPT_CAP = 500

/** PL/pgSQL `btrim` trims leading/trailing ASCII spaces, tabs, CR, LF. */
const btrim = (value: string): string => value.replace(/^[\s]+|[\s]+$/g, '')

/** PL/pgSQL `left(text, n)` — first `n` characters (n may exceed length). */
const left = (value: string, n: number): string => value.slice(0, Math.max(0, n))

/** True when the concatenated source content is empty after trimming. */
export const isSourceEmpty = (source: string | null | undefined): boolean =>
  source === null || source === undefined || btrim(source) === ''

// ── ai-summary ──────────────────────────────────────────────────────────────

/**
 * ai-summary baseline: a trimmed excerpt of the source content capped at
 * `maxLength` (or {@link DEFAULT_SUMMARY_CAP}). Mirrors
 * `NEW.field = left(btrim(source_content), cap)`.
 */
export const computeAiSummaryBaseline = (
  source: string,
  config: { readonly maxLength?: number }
): string => left(btrim(source), config.maxLength ?? DEFAULT_SUMMARY_CAP)

// ── ai-translate ──────────────────────────────────────────────────────────────

/**
 * ai-translate baseline: the trimmed (untranslated) source content. Mirrors
 * `NEW.field = btrim(source_content)`.
 */
export const computeAiTranslateBaseline = (source: string): string => btrim(source)

// ── ai-generate ──────────────────────────────────────────────────────────────

/**
 * ai-generate baseline: the field `prompt` template with each `{{fieldName}}`
 * placeholder replaced by the matching source-field value. Mirrors the
 * `replace(replace(prompt, '{{f1}}', v1), '{{f2}}', v2)` chain.
 *
 * Takes the resolved `sourceValues` map (column name → value, NULL → '') so
 * the substitution matches the PG `COALESCE(NEW.<sf>::text, '')` semantics.
 */
export const computeAiGenerateBaseline = (
  prompt: string,
  sourceFields: readonly string[],
  sourceValues: Readonly<Record<string, unknown>>
): string =>
  sourceFields.reduce((acc, sf) => {
    const raw = sourceValues[sf]
    const replacement = raw === null || raw === undefined ? '' : String(raw)
    return acc.split(`{{${sf}}}`).join(replacement)
  }, prompt)

// ── ai-categorize ──────────────────────────────────────────────────────────────

/** Billing-vocabulary signal regex (mirrors the PL/pgSQL `~` test). */
const BILLING_CONTENT_RE = /(charge|refund|invoic|payment|subscrip|bill|pric)/
/** Billing-category-name match regex. */
const BILLING_CATEGORY_RE = /(bill|pay|financ)/
/** Technical-issue-vocabulary signal regex. */
const TECH_CONTENT_RE = /(crash|error|bug|down|500|server|api|broken|fail)/
/** Technical-category-name match regex. */
const TECH_CATEGORY_RE = /(tech|bug|error|issue)/

/**
 * ai-categorize baseline: pick one category from the configured `categories`
 * by deterministic keyword matching against the lowercased source content.
 * Mirrors the four-step PL/pgSQL selection:
 *   1) exact category-keyword appearance, 2) billing heuristic,
 *   3) technical heuristic, 4) fallback to the first category.
 * Returns `null` when the source content is empty.
 */
export const computeAiCategorizeBaseline = (
  source: string,
  config: { readonly categories: readonly string[] }
): string | null => {
  if (isSourceEmpty(source)) return null
  const lowerContent = source.toLowerCase()
  const { categories } = config

  // 1) exact keyword appearance of a category name in the content
  const direct = categories.find((c) => lowerContent.includes(c.toLowerCase()))
  if (direct !== undefined) return direct

  // 2) billing heuristic
  if (BILLING_CONTENT_RE.test(lowerContent)) {
    const billing = categories.find((c) => BILLING_CATEGORY_RE.test(c.toLowerCase()))
    if (billing !== undefined) return billing
  }

  // 3) technical heuristic
  if (TECH_CONTENT_RE.test(lowerContent)) {
    const tech = categories.find((c) => TECH_CATEGORY_RE.test(c.toLowerCase()))
    if (tech !== undefined) return tech
  }

  // 4) fallback to first configured category
  return categories.length > 0 ? categories[0]! : null
}

// ── ai-tag ──────────────────────────────────────────────────────────────

/**
 * ai-tag baseline: every configured tag whose lowercased text appears in the
 * lowercased source content, falling back to the first tag when none match,
 * truncated to `maxTags`. Returns `[]` when the source content is empty.
 * Mirrors the `FOREACH tag … position(lower(tag) in lower_content) > 0` loop.
 */
export const computeAiTagBaseline = (
  source: string,
  config: { readonly tags: readonly string[]; readonly maxTags?: number }
): readonly string[] => {
  if (isSourceEmpty(source)) return []
  const lowerContent = source.toLowerCase()
  const matched = config.tags.filter((tag) => lowerContent.includes(tag.toLowerCase()))
  const chosen = matched.length === 0 && config.tags.length > 0 ? [config.tags[0]!] : [...matched]
  return config.maxTags !== undefined ? chosen.slice(0, config.maxTags) : chosen
}

// ── ai-sentiment ──────────────────────────────────────────────────────────────

/** Positive-vocabulary signal regex (mirrors the PL/pgSQL `~` test). */
const POSITIVE_RE =
  /(love|great|amazing|wonderful|excellent|awesome|outstanding|fantastic|good|happy|perfect|best|delight)/
/** Negative-vocabulary signal regex. */
const NEGATIVE_RE =
  /(terrible|awful|bad|horrible|worst|hate|disappoint|broken|slow|lost|urgent|angry|frustrat|poor|fail)/

/** The structured ai-sentiment baseline object shape. */
export interface SentimentBaseline {
  readonly label: 'positive' | 'negative' | 'neutral' | 'mixed'
  readonly score: number
  readonly explanation: string
}

/**
 * ai-sentiment baseline: a `{ label, score, explanation }` object picked by a
 * coarse positive/negative keyword heuristic over the source content. Mirrors
 * the PL/pgSQL `has_positive`/`has_negative` branch. Returns `null` when the
 * source content is empty.
 */
export const computeAiSentimentBaseline = (source: string): SentimentBaseline | null => {
  if (isSourceEmpty(source)) return null
  const lower = source.toLowerCase()
  const hasPositive = POSITIVE_RE.test(lower)
  const hasNegative = NEGATIVE_RE.test(lower)
  const explanation = 'Deterministic placeholder based on keyword analysis of the source text.'
  if (hasPositive && hasNegative) return { label: 'mixed', score: 0.5, explanation }
  if (hasPositive) return { label: 'positive', score: 0.9, explanation }
  if (hasNegative) return { label: 'negative', score: 0.9, explanation }
  return { label: 'neutral', score: 0.5, explanation }
}

// ── ai-extract ──────────────────────────────────────────────────────────────

/** A derived target property for ai-extract baseline construction. */
interface ExtractProperty {
  readonly name: string
  readonly scalarKind: 'numeric' | 'other'
}

/**
 * Map a JSON-Schema-ish property definition to the coarse placeholder kind
 * (mirrors `classifyExtractProperty` in `ai-extract-triggers.ts`): `'numeric'`
 * for declared `number`/`integer`, `'other'` otherwise.
 */
const classifyExtractProperty = (def: unknown): 'numeric' | 'other' => {
  const typeName =
    typeof def === 'string'
      ? def
      : def !== null && typeof def === 'object'
        ? (def as Record<string, unknown>)['type']
        : undefined
  return typeName === 'number' || typeName === 'integer' ? 'numeric' : 'other'
}

/**
 * Resolve the target properties from an ai-extract `schema` (mirrors
 * `resolveExtractProperties`): JSON-Schema `{ properties: {…} }` or the
 * shorthand map `{ foo: 'string' }` (reserved `type` key dropped).
 */
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

/**
 * ai-extract baseline: a schema-shaped object — one key per derived property,
 * numeric properties → `null`, others → a trimmed source excerpt capped at
 * 500 chars. Mirrors the `jsonb_build_object(...)` placeholder. Returns `null`
 * when the source content is empty; `{}` when no property names can be derived.
 */
export const computeAiExtractBaseline = (
  source: string,
  config: { readonly schema: Readonly<Record<string, unknown>> }
): Record<string, unknown> | null => {
  if (isSourceEmpty(source)) return null
  const properties = resolveExtractProperties(config.schema)
  if (properties.length === 0) return {}
  const excerpt = left(btrim(source), EXTRACT_EXCERPT_CAP)
  return Object.fromEntries(
    properties.map((p) => [p.name, p.scalarKind === 'numeric' ? null : excerpt])
  )
}

// ── override guard ──────────────────────────────────────────────────────────────

/**
 * The set of AI-compute kinds whose UPDATE guard skips recompute when no
 * source field changed (summary/translate/extract/sentiment/generate). For
 * categorize and tag the PG trigger has no source-changed gate — they
 * preserve an explicit value and otherwise (re)compute.
 */
const SOURCE_CHANGED_KINDS: ReadonlySet<AiComputeKind> = new Set([
  'ai-summary',
  'ai-translate',
  'ai-extract',
  'ai-sentiment',
  'ai-generate',
])

/**
 * True when an incoming user value should be honoured as an explicit override
 * on INSERT (the kind-specific "non-empty"/"non-null" test the PG INSERT guard
 * encodes). string-valued kinds treat `''` as not-set; jsonb-array (tag) and
 * jsonb-object (extract/sentiment) kinds treat any non-null/non-empty value as
 * an override.
 *
 * Exported because the write-phase status signal needs the SAME notion of "the
 * user really supplied this" that the baseline guard uses. Re-stating the test
 * there would let the two drift, and a drift would show up as a status row that
 * describes a value nobody computed.
 */
export const isExplicitUserValue = (kind: AiComputeKind, value: unknown): boolean => {
  if (value === null || value === undefined) return false
  if (kind === 'ai-tag') {
    return Array.isArray(value) ? value.length > 0 : true
  }
  if (kind === 'ai-extract' || kind === 'ai-sentiment') {
    // The PG guard is `NEW.field IS NOT NULL` — any non-null jsonb is an override.
    return true
  }
  // string kinds (summary/translate/generate/categorize): non-empty string
  if (typeof value === 'string') return value !== ''
  return true
}

/** Decision returned by {@link applyBaselineGuard}. */
export type BaselineGuardDecision =
  | { readonly kind: 'preserve' } // honour the incoming/old value, do NOT compute
  | { readonly kind: 'compute' } // (re)compute the baseline from source

/**
 * Reproduce the per-kind PL/pgSQL override guard in pure TS so the SQLite
 * in-process hook makes the SAME preserve-vs-compute decision the PG trigger
 * makes. (For the empty-source case the caller still writes the kind's
 * empty-baseline — `null` for most, `[]` for tag — by calling the matching
 * `computeAi*Baseline`, which already returns the empty value.)
 *
 * - INSERT: preserve when the incoming value is an explicit user value
 *   ({@link isExplicitUserValue}); otherwise compute.
 * - UPDATE: for source-changed kinds, preserve (no recompute) when NO source
 *   field changed; otherwise, if the user changed the column directly in this
 *   statement to an explicit value, preserve; otherwise compute. For
 *   categorize/tag (no source-changed gate) the INSERT rule applies: preserve
 *   an explicit incoming value, else compute.
 *
 * @param op       the write operation
 * @param kind     the AI-compute field kind
 * @param incoming the value the user supplied for the field in this write
 * @param old      the previously-stored value (UPDATE only; ignored on INSERT)
 * @param sourceChanged whether any configured source field changed this UPDATE
 */
export const applyBaselineGuard = (params: {
  readonly op: 'insert' | 'update'
  readonly kind: AiComputeKind
  readonly incoming: unknown
  readonly old?: unknown
  readonly sourceChanged?: boolean
}): BaselineGuardDecision => {
  const { op, kind, incoming, old, sourceChanged } = params

  if (op === 'insert') {
    return isExplicitUserValue(kind, incoming) ? { kind: 'preserve' } : { kind: 'compute' }
  }

  // UPDATE
  if (SOURCE_CHANGED_KINDS.has(kind)) {
    if (sourceChanged !== true) return { kind: 'preserve' }
    // User edited the column directly in this same statement to an explicit value.
    const userEditedColumn = incoming !== undefined && incoming !== old
    if (userEditedColumn && isExplicitUserValue(kind, incoming)) return { kind: 'preserve' }
    return { kind: 'compute' }
  }

  // categorize / tag: preserve an explicit incoming value, else recompute.
  return isExplicitUserValue(kind, incoming) ? { kind: 'preserve' } : { kind: 'compute' }
}
