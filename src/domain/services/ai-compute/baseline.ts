/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */



export type AiComputeKind =
  | 'ai-summary'
  | 'ai-categorize'
  | 'ai-tag'
  | 'ai-translate'
  | 'ai-extract'
  | 'ai-sentiment'
  | 'ai-generate'

export const DEFAULT_SUMMARY_CAP = 200

const EXTRACT_EXCERPT_CAP = 500

const btrim = (value: string): string => value.replace(/^[\s]+|[\s]+$/g, '')

const left = (value: string, n: number): string => value.slice(0, Math.max(0, n))

export const isSourceEmpty = (source: string | null | undefined): boolean =>
  source === null || source === undefined || btrim(source) === ''


export const computeAiSummaryBaseline = (
  source: string,
  config: { readonly maxLength?: number }
): string => left(btrim(source), config.maxLength ?? DEFAULT_SUMMARY_CAP)


export const computeAiTranslateBaseline = (source: string): string => btrim(source)


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


const BILLING_CONTENT_RE = /(charge|refund|invoic|payment|subscrip|bill|pric)/
const BILLING_CATEGORY_RE = /(bill|pay|financ)/
const TECH_CONTENT_RE = /(crash|error|bug|down|500|server|api|broken|fail)/
const TECH_CATEGORY_RE = /(tech|bug|error|issue)/

export const computeAiCategorizeBaseline = (
  source: string,
  config: { readonly categories: readonly string[] }
): string | null => {
  if (isSourceEmpty(source)) return null
  const lowerContent = source.toLowerCase()
  const { categories } = config

  const direct = categories.find((c) => lowerContent.includes(c.toLowerCase()))
  if (direct !== undefined) return direct

  if (BILLING_CONTENT_RE.test(lowerContent)) {
    const billing = categories.find((c) => BILLING_CATEGORY_RE.test(c.toLowerCase()))
    if (billing !== undefined) return billing
  }

  if (TECH_CONTENT_RE.test(lowerContent)) {
    const tech = categories.find((c) => TECH_CATEGORY_RE.test(c.toLowerCase()))
    if (tech !== undefined) return tech
  }

  return categories.length > 0 ? categories[0]! : null
}


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


const POSITIVE_RE =
  /(love|great|amazing|wonderful|excellent|awesome|outstanding|fantastic|good|happy|perfect|best|delight)/
const NEGATIVE_RE =
  /(terrible|awful|bad|horrible|worst|hate|disappoint|broken|slow|lost|urgent|angry|frustrat|poor|fail)/

export interface SentimentBaseline {
  readonly label: 'positive' | 'negative' | 'neutral' | 'mixed'
  readonly score: number
  readonly explanation: string
}

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


interface ExtractProperty {
  readonly name: string
  readonly scalarKind: 'numeric' | 'other'
}

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


const SOURCE_CHANGED_KINDS: ReadonlySet<AiComputeKind> = new Set([
  'ai-summary',
  'ai-translate',
  'ai-extract',
  'ai-sentiment',
  'ai-generate',
])

const isExplicitUserValue = (kind: AiComputeKind, value: unknown): boolean => {
  if (value === null || value === undefined) return false
  if (kind === 'ai-tag') {
    return Array.isArray(value) ? value.length > 0 : true
  }
  if (kind === 'ai-extract' || kind === 'ai-sentiment') {
    return true
  }
  if (typeof value === 'string') return value !== ''
  return true
}

export type BaselineGuardDecision =
  | { readonly kind: 'preserve' }
  | { readonly kind: 'compute' }

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

  if (SOURCE_CHANGED_KINDS.has(kind)) {
    if (sourceChanged !== true) return { kind: 'preserve' }
    const userEditedColumn = incoming !== undefined && incoming !== old
    if (userEditedColumn && isExplicitUserValue(kind, incoming)) return { kind: 'preserve' }
    return { kind: 'compute' }
  }

  return isExplicitUserValue(kind, incoming) ? { kind: 'preserve' } : { kind: 'compute' }
}
