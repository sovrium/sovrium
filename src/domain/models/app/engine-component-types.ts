/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The styleable engine component types, re-exported at the app-model root.
 *
 * ## Why this file exists at all
 *
 * The list is DERIVED in `pages/components/component-types/index.ts`, beside
 * the `allComponents` tuple it walks — that is the only place it can be derived
 * without a second source of truth. But `design/components.ts` needs it, and
 * `[internal ref]` gives `domain-model-design` no rule allowing a
 * dependency on `domain-model-page` (`src/domain/models/app/pages/**`). The
 * design models may import `domain-model-app`, which is this directory's ROOT
 * files, and the app root may import every domain model.
 *
 * So the hop lands here rather than widening the boundary rule. Widening it
 * would let any design model reach any page model for any reason, which is a
 * much larger permission than "the design key needs to know which component
 * types exist" — and `[internal ref]` belongs to a different owner besides.
 *
 * Nothing is re-derived here. Adding a component type is still one edit, in
 * `allComponents`.
 */

export {
  ENGINE_COMPONENT_TYPES,
  type EngineComponentType,
} from './pages/components/component-types'
