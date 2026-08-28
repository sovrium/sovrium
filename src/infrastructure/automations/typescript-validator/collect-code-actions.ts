/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The config walk that finds every `code` action body, split out of `layer.ts`
 * so it can be imported WITHOUT loading `typescript`.
 *
 * WHY THE SPLIT IS LOAD-BEARING, not tidiness. `layer.ts` imports the whole
 * `typescript` compiler; that import alone costs ~85 ms of module load before a
 * single config is examined. `sovrium validate` completes in ~0.22 s, so paying
 * it unconditionally would have made the deploy gate ~40% slower for the large
 * majority of configs — the ones with no code actions at all, which have nothing
 * for the type-checker to do.
 *
 * Callers therefore run this walk FIRST and import the validator only when it
 * returns a non-empty list. That is why this module must stay free of any
 * `typescript` import, direct or transitive: adding one silently re-imposes the
 * cost the split exists to avoid, and nothing would fail to tell you.
 *
 * Deliberately NOT re-exported from `./index`. That barrel pulls in `./layer`,
 * so reaching this through it would load the compiler and defeat the gate; the
 * cheap path must import this module by its own path.
 */

/** One `code` action body, located well enough to name in an error message. */
export interface CodeActionEntry {
  readonly automationId: string
  readonly actionIndex: number
  readonly code: string
}

/**
 * Walk the app config collecting every `runTypescript` (or legacy `run`-on-
 * `code`) action body alongside its automation id + positional index. Index is
 * 1-based for human-friendly error messages (`action #1`, not `action #0`).
 *
 * Pure and total: any shape it does not recognise contributes nothing rather
 * than throwing, so it is safe to run against a raw, undecoded config.
 */
export const collectCodeActions = (root: unknown): ReadonlyArray<CodeActionEntry> => {
  const automations = (root as { readonly automations?: ReadonlyArray<unknown> } | undefined)
    ?.automations
  if (!Array.isArray(automations)) return []
  return automations.flatMap((automation, automationOffset) => {
    if (typeof automation !== 'object' || automation === undefined || automation === null) {
      return []
    }
    const auto = automation as Record<string, unknown>
    const { name } = auto as { readonly name?: unknown }
    const automationId = typeof name === 'string' ? name : `automation-${String(automationOffset)}`
    const { actions } = auto as { readonly actions?: unknown }
    if (!Array.isArray(actions)) return []
    return actions.flatMap((action, actionIndex): ReadonlyArray<CodeActionEntry> => {
      if (typeof action !== 'object' || action === undefined || action === null) return []
      const a = action as Record<string, unknown>
      if (a['type'] !== 'code') return []
      const { props } = a as { readonly props?: unknown }
      if (typeof props !== 'object' || props === undefined || props === null) return []
      const { code } = props as { readonly code?: unknown }
      if (typeof code !== 'string' || code === '') return []
      return [{ automationId, actionIndex: actionIndex + 1, code }]
    })
  })
}
