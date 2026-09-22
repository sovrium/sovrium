/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { componentTreeHasType } from './pages/component-tree-has-type'
import { collectActionTypes } from './requires-email'
import { isAiComputeFieldType } from './tables/fields/field-types/ai/ai-field-types'
import type { App } from '.'

/**
 * Page-component `type` literals whose whole purpose is to reach a model.
 *
 * `ai-chat` is the in-page assistant
 * (`pages/components/component-types/ai/ai-chat.ts`). It renders an affordance
 * that cannot answer without a provider, which is what puts it on this list
 * rather than merely near it.
 *
 * A set of one, deliberately. `schema-ai-agent` — the agentic schema editor —
 * was the second member until the config-authoring editors were deleted with
 * the rest of the config-editing plane. The set stays a set because the
 * question it answers is "does ANY component here need a model", and the next
 * such component should join a list rather than replace a comparison.
 */
const AI_COMPONENT_TYPES: ReadonlySet<string> = new Set(['ai-chat'])

/**
 * Determine whether an app configuration declares any surface that needs an AI
 * provider to do its job.
 *
 * Pure predicate over the app schema — it never reads `AI_PROVIDER`,
 * `ECO_AI_PROVIDER_PRECEDENCE` or any other environment variable. It answers
 * only what the app ASKED FOR, so callers can pair it with the environment and
 * decide whether an absent provider is a degradation worth naming.
 *
 * Two callers today, and they need the same answer for the same reason:
 *
 * - the `⚠ AI disabled — AI_PROVIDER not set` startup warning, which must not
 * describe a capability the app never declared;
 * - the `ECO_AI_PROVIDER_PRECEDENCE=local-only` boot gate, which must refuse a
 *   boot only when THIS app would be broken by an unreachable Ollama —
 *   precedence is a host-wide env var, so a plain marketing site sharing the
 * host must still start.
 *
 * Returns `true` when ANY of the following hold:
 * - a table declares an `ai-*` compute field (`ai-summary`, `ai-tag`, …);
 * - `agents[]` is non-empty;
 * - any automation action (including nested in `path`/`loop`) is type `ai`;
 * - any page places an `ai-chat` component, including nested in a container or
 *   reached through a `$ref`.
 *
 * An EMPTY declaration counts as absent, matching `CAPABILITY_PREDICATES` in
 * `domain/models/app/pages/page-requires.ts`: `agents: []` is not "this app has
 * agents".
 */
export const appRequiresAi = (app: App): boolean => {
  const hasAiField = (app.tables ?? []).some((table) =>
    table.fields.some((field) => isAiComputeFieldType(field.type))
  )
  if (hasAiField) return true

  if ((app.agents ?? []).length > 0) return true

  const hasAiAction =
    app.automations?.some((automation) => collectActionTypes(automation.actions).includes('ai')) ??
    false
  if (hasAiAction) return true

  return componentTreeHasType(app, AI_COMPONENT_TYPES)
}
