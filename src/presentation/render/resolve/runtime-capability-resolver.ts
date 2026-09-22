/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Which capabilities can actually RUN for a given app on a given deployment.
 *
 * ─── WHY THIS LIVES IN `render/resolve/` AND NOT BESIDE `page-requires.ts` ──
 *
 * Every predicate here is a CONJUNCTION of an app half and an ENV half, and
 * that second half is what decides the home. `src/domain/models/app/<slug>/`
 * may not reach `src/domain/models/process-env/**` — the boundary keeps
 * `process.env` parsers out of the feature models, and out of the island tree
 * that reads them (standing rule S4). `presentation-render` is granted both,
 * because the SSR tree legitimately reads the environment at render time.
 *
 * So the two halves stay pure and separately testable where they are —
 * `appRequiresAi` over the decoded config, `isAiProviderConfigured` over an env
 * snapshot — and the composition sits beside the one pass that spends it, next
 * to `visibility-filter.ts`, which already composes `isCapabilityMet` the same
 * way.
 */

import { RUNTIME_CAPABILITIES } from '@/domain/models/app/pages/components/visibility'
import { appRequiresAi } from '@/domain/models/app/requires-ai'
import { isAiProviderConfigured } from '@/domain/models/process-env/ai/ai-providers'
import type { App } from '@/domain/models/app'
import type { RuntimeCapability } from '@/domain/models/app/pages/components/visibility'

/**
 * Whether one runtime capability can actually RUN for this app on this host.
 *
 * Every predicate is a CONJUNCTION of an app half and an env half, and both are
 * pure reads of their argument. That is the whole distinction the key exists
 * for: the app half alone is `visibility.declares`, and the env half alone
 * would render a composer for an app that declares no agent.
 *
 * The `ai` row is the conjunction `collectAiProviderPhases` already computes to
 * decide whether to print the `AI disabled` startup warning — the "inert vs
 * active" signal of [internal ref]. It is reused here rather than restated so a
 * component gated on `runtime: ai` and the warning an operator reads at boot
 * can never come to disagree.
 *
 * @see src/infrastructure/server/startup-degradation-phases.ts — the same conjunction
 */
const RUNTIME_PREDICATES: Readonly<
  Record<
    RuntimeCapability,
    (app: App, env: Readonly<Record<string, string | undefined>>) => boolean
  >
> = {
  ai: (app, env) => appRequiresAi(app) && isAiProviderConfigured(env),
}

/**
 * The runtime capabilities that hold for this app on this host, as a resolved
 * list.
 *
 * ─── WHY A RESOLVED LIST RATHER THAN AN AMBIENT READ ───────────────────────
 *
 * `isAiProviderConfigured` takes its snapshot as an argument precisely "so it
 * stays trivially testable", and resolving here preserves that: the gate in the
 * renderer receives facts rather than reaching for `process.env` mid-render.
 * The precedent for the cheaper alternative exists — `isAiDisabled()` in
 * `ai-chat-component.tsx` reads `process.env` directly — and it is defensible;
 * it is not preferred, because a gate reading ambient state cannot be
 * unit-tested per case.
 *
 * The shape mirrors `grantedCapabilities`, which a mount already passes for the
 * same reason: the layer above holds a fact the renderer does not.
 *
 * ─── WHICH APP ─────────────────────────────────────────────────────────────
 *
 * The HOST app, never a mounted preset. A console asking its own preset whether
 * the operator declares AI would answer about the console. The env half is
 * process-wide and so identical either way.
 *
 * Called ONCE PER REQUEST, at the filter-pipeline entry — not per component and
 * not per node of the recursion. `appRequiresAi` walks the whole component tree.
 */
export const resolveRuntimeCapabilities = (
  app: App,
  env: Readonly<Record<string, string | undefined>>
): readonly RuntimeCapability[] =>
  RUNTIME_CAPABILITIES.filter((capability) => RUNTIME_PREDICATES[capability](app, env))
