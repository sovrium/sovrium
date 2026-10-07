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
 * Every predicate here reads the ENVIRONMENT, and that is what decides the
 * home. `src/domain/models/app/<slug>/`
 * may not reach `src/domain/models/process-env/**` — the boundary keeps
 * `process.env` parsers out of the feature models, and out of the island tree
 * that reads them (standing rule S4). `presentation-render` is granted both,
 * because the SSR tree legitimately reads the environment at render time.
 *
 * So the predicate stays pure and testable where it is — `isAiProviderConfigured`
 * over an env snapshot — and the composition sits beside the one pass that
 * spends it, next to `visibility-filter.ts`, which already composes
 * `isCapabilityMet` the same way.
 */

import { RUNTIME_CAPABILITIES } from '@/domain/models/app/pages/components/visibility'
import { isAiProviderConfigured } from '@/domain/models/process-env/ai/ai-providers'
import type { App } from '@/domain/models/app'
import type { RuntimeCapability } from '@/domain/models/app/pages/components/visibility'

/**
 * Whether one runtime capability can actually RUN for this app on this host.
 *
 * The `ai` row is the provider half alone, not a conjunction with
 * `appRequiresAi(app)`, which would keep the Welcome composer dark on an app
 * that declares no AI even with a provider configured. Every app carries the
 * built-in System Agent, so a configured provider is all a chat needs to run.
 *
 * `appRequiresAi` still gates the boot-time checks (`collectAiProviderPhases`,
 * the eco-routing and speech validators): an app declaring no AI gets no new
 * startup warning just because the System Agent exists.
 */
const RUNTIME_PREDICATES: Readonly<
  Record<
    RuntimeCapability,
    (app: App, env: Readonly<Record<string, string | undefined>>) => boolean
  >
> = {
  ai: (_app, env) => isAiProviderConfigured(env),
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
 * not per node of the recursion.
 */
export const resolveRuntimeCapabilities = (
  app: App,
  env: Readonly<Record<string, string | undefined>>
): readonly RuntimeCapability[] =>
  RUNTIME_CAPABILITIES.filter((capability) => RUNTIME_PREDICATES[capability](app, env))
