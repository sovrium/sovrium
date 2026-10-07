/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The registry of `ai-*` field `type` literals — the domain's answer to "does
 * this column go to a model?".
 *
 * ── WHY IT LIVES IN THE DOMAIN ─────────────────────────────────────────────
 *
 * Besides the PL/pgSQL trigger emitter
 * (`infrastructure/database/generators/ai-field-triggers.ts`), its callers
 * include pure config predicates — `appRequiresAi`, and through it the
 * AI-disabled startup warning and the `local-only` eco-routing gate — and a
 * domain predicate may not import infrastructure.
 *
 * Which field types name a model is a property of the SCHEMA, not of the
 * dialect that happens to implement them. The trigger module re-exports both
 * names, so there is exactly one list.
 *
 * Extend it when a new `ai-*` kind gains a field schema.
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

/**
 * True when `type` is one of the `ai-*` field types backed by a compute trigger.
 */
export const isAiComputeFieldType = (type: string): boolean =>
  (AI_COMPUTE_FIELD_TYPES as readonly string[]).includes(type)
