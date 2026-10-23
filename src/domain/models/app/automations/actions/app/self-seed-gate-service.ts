/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  SOVRIUM_SELF_SEED_VAR,
  selfSeedGateAllows,
  type SelfSeedGate,
} from '@/domain/models/process-env/self-seed'
import type { App } from '@/domain/models/app'

/**
 * The boot half of the `app/seed` switch: which automations the server does
 * not schedule at all, because they hold an `app/seed` step whose mode
 * `SOVRIUM_SELF_SEED` does not allow.
 *
 * An automation is withheld WHOLE — none of its triggers is armed, it is absent
 * from every listing, and it can be triggered by nobody — rather than
 * scheduled and failed at its first run: a customer app built from a template
 * that ships a nightly reset must neither wipe itself nor collect a failed run
 * every night. That is why the step's `mode` is literal: it is read here,
 * before any run exists.
 *
 * "Holds" means at any depth: the automation's own steps, and the steps nested
 * in a `path` branch (`props.paths[].actions`) or a `loop` (`props.actions`).
 */

type RawRecord = Readonly<Record<string, unknown>>

const isRecord = (value: unknown): value is RawRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** The mode of every `app/seed` step reachable from `value`; only step-nesting keys are followed. */
const seedModesIn = (value: unknown): readonly string[] => {
  if (Array.isArray(value)) return value.flatMap(seedModesIn)
  if (!isRecord(value)) return []
  const props = isRecord(value['props']) ? value['props'] : {}
  const self =
    value['type'] === 'app' && value['operator'] === 'seed' ? [String(props['mode'] ?? '')] : []
  const nested = [value['actions'], value['paths'], props['actions'], props['paths']].flatMap(
    seedModesIn
  )
  return [...self, ...nested]
}

/**
 * The modes of the `app/seed` steps an automation holds, at any depth, in the
 * order they appear; empty when it holds none.
 */
export const appSeedModesOf = (automation: unknown): readonly string[] =>
  isRecord(automation) ? seedModesIn(automation['actions']) : []

/** An automation the server does not schedule, and the modes the switch refused. */
export interface WithheldSelfSeedAutomation {
  readonly automation: string
  readonly refusedModes: readonly string[]
}

/**
 * The one line the server prints at boot for an automation it does not
 * schedule. It names the automation and the variable, and says what would
 * schedule it.
 */
export const selfSeedBootNotice = (
  withheld: WithheldSelfSeedAutomation,
  gate: SelfSeedGate
): string => {
  const modes = withheld.refusedModes.map((mode) => `'${mode}'`).join(', ')
  const reason =
    gate === 'off'
      ? `${SOVRIUM_SELF_SEED_VAR} is not set on this host`
      : `${SOVRIUM_SELF_SEED_VAR} allows only 'if-empty' and 'upsert' unless it is set to reset`
  return (
    `Automation '${withheld.automation}' is not scheduled: its app/seed step asks for mode ${modes}, ` +
    `and ${reason}.`
  )
}

/**
 * The app with every automation the switch withholds taken out, and those
 * automations with the modes refused. An app with nothing withheld is
 * returned as it came.
 */
export const withholdSelfSeedAutomations = <T extends App>(
  app: T,
  gate: SelfSeedGate
): { readonly app: T; readonly withheld: readonly WithheldSelfSeedAutomation[] } => {
  const automations = app.automations ?? []
  const verdicts = automations.map((automation) => ({
    automation,
    refusedModes: appSeedModesOf(automation).filter((mode) => !selfSeedGateAllows(gate, mode)),
  }))
  const withheld = verdicts
    .filter((verdict) => verdict.refusedModes.length > 0)
    .map((verdict) => ({
      automation: verdict.automation.name,
      refusedModes: [...new Set(verdict.refusedModes)],
    }))
  if (withheld.length === 0) return { app, withheld }
  const kept = verdicts
    .filter((verdict) => verdict.refusedModes.length === 0)
    .map((verdict) => verdict.automation)
  return { app: { ...app, automations: kept }, withheld }
}
