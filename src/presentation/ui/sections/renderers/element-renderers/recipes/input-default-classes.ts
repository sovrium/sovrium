/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Re-export shim for the `input` prestyled-by-default recipe.
 *
 * The implementation moved to `@/presentation/utils/design/input-default-classes`
 * so the hand-rolled auth island can consume it without crossing the
 * island→component boundary (`[internal ref]` forbids
 * `presentation-island` → `presentation-component`, but allows
 * `presentation-island` → `presentation-util`). This shim keeps the existing
 * element-renderers / component-registry import sites stable — mirroring how
 * `forms-default-classes.ts` re-exports `form-layout-classes.ts`.
 */

export {
  computeInputDefaultClasses,
  type InputDefaultClassesInput,
  type InputState,
} from '@/presentation/utils/design/input-default-classes'
