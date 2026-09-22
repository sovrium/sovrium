/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// The public surface of the action-handler directory. The dispatch table and
// the not-registered fallback live in `registry.ts`; external callers
// (`run-automation.ts`, `run/action-invokers.ts`, `api/mcp/action-call.ts`)
// keep importing from this module path regardless of internal file structure.
export { defaultActionHandlers, missingActionHandler } from './registry'
export { actionKey } from './shared'
export type {
  ActionHandler,
  ActionKey,
  ActionOutcome,
  ActionRunContext,
  AutomationContext,
} from './shared'
