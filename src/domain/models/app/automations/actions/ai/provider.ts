/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { SUPPORTED_AI_PROVIDERS } from '@/domain/models/env/ai/ai-providers'

/**
 * Values accepted for back-compat only, kept out of {@link SUPPORTED_AI_PROVIDERS}.
 *
 * `custom` was in the original hand-written literal and names no provider the
 * engine supports — `openai-compatible` is what it meant. Dropping it would
 * turn a config that boots today into one that fails to boot, over a field
 * that has never changed behaviour, so it stays accepted and undocumented.
 */
const DEPRECATED_AI_ACTION_PROVIDERS = ['custom'] as const

/**
 * The optional, advisory `props.provider` shared by `ai/generate`,
 * `ai/classify` and `ai/extract`.
 *
 * ── Why optional ────────────────────────────────────────────────────────────
 *
 * It was REQUIRED, and no handler has ever read it: the provider is resolved
 * once from the `AI_PROVIDER` environment variable through `AiService`, and
 * every `ai/*` action goes to that provider whatever it declares. So the field
 * obliged every config author to write a value that changed nothing — and a
 * value that could contradict the deployment without any warning. Making it
 * optional removes the obligation without breaking a config that already sets
 * it, which is why the field is kept rather than deleted.
 *
 * ── Why the literal is DERIVED ──────────────────────────────────────────────
 *
 * The hand-written list was `('openai' | 'anthropic' | 'ollama' | 'custom')`
 * while `AI_PROVIDER` accepts six values — `anthropic`, `openai`, `mistral`,
 * `google`, `ollama`, `openai-compatible` (plus the `gemini` alias). One of the
 * hand-written four (`custom`) was not a provider the engine supports at all,
 * and `mistral`, `google` and `openai-compatible` could not be named. An author
 * was therefore required to pick from a list that was wrong in both directions.
 * Spreading {@link SUPPORTED_AI_PROVIDERS} makes that class of drift
 * unrepresentable: adding a provider to the env-side list adds it here.
 *
 * ── Advisory, not an override ───────────────────────────────────────────────
 *
 * Declaring `provider` does NOT select a provider for this action. A real
 * per-action override is a separate, deliberate feature — it needs credential
 * resolution per provider, not just a label — and is explicitly not this. Until
 * it lands the field is documentation of intent, and the published description
 * says so, so an author is not misled by the field's mere existence.
 */
export const AiActionProviderSchema = Schema.optional(
  Schema.Literals([...SUPPORTED_AI_PROVIDERS, ...DEPRECATED_AI_ACTION_PROVIDERS]).pipe(
    Schema.annotate({
      identifier: 'AiActionProvider',
      title: 'AI Action Provider (advisory)',
      description:
        'Advisory only — records which LLM provider this action was written for. The provider actually used is resolved from the AI_PROVIDER environment variable; this value does not override it.',
    })
  )
)
