/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The single source of truth for "may this automation run right now?".
 *
 * ## Why this file exists
 *
 * An automation has TWO independent off-switches:
 *
 *   - `enabled: false` in the app CONFIG — the author's decision, changeable
 * only by editing config ([internal ref] D2: the Admin Space never edits config).
 *   - an OPERATIONAL pause — the operator's decision, held as a row in
 *     `system.automation_pauses`, keyed by automation NAME, settable and
 *     clearable from the console at runtime and surviving a restart.
 *
 * Before this module, the config half was re-implemented as a bare
 * `automation.enabled === false` at **twelve** separate sites spread across
 * the application, presentation and infrastructure layers. Adding a second
 * off-switch to twelve hand-written copies is how a gate gets missed — and a
 * pause that is honoured at eleven sites out of twelve is WORSE than no pause,
 * because the console then reports "Paused" while the automation still fires
 * on the twelfth path.
 *
 * So: every gate calls this one predicate, and the console's displayed state
 * comes from {@link resolveAutomationOperationalState} — the *same* function.
 * `state === 'active'` is not merely documented to agree with
 * `isAutomationOperationallyEnabled`; it is defined as it. The two cannot
 * drift, because there is only one decision.
 *
 * ## Why the predicate is pure and synchronous
 *
 * The pause state lives in the database, but eleven of the twelve call sites
 * are pure synchronous functions of the in-memory config — four `.filter()`
 * predicates, five `(app, name)` resolvers, and two inline guards. Making the
 * predicate return an `Effect` would force `Effect.filter` into every one of
 * those and rewrite otherwise-untouched code.
 *
 * Instead each ENTRY POINT loads the paused-name set once, then threads it in.
 * The predicate stays pure, trivially unit-testable, and free of a DB
 * round-trip per automation.
 *
 * ## What is deliberately NOT gated here
 *
 * `registerCronAutomations` (`infrastructure/scheduling/register-cron-automations.ts`)
 * decides which cron automations are ARMED at boot, and it reads config only.
 * It is intentionally left out of this predicate. Gating registration would
 * create an obligation to RE-register on resume; if that hook were ever
 * missed, a resumed cron automation would stay silently dead until the next
 * restart — a wrong answer. Gating only at fire time
 * (`run-cron-automation.ts`) means a paused cron job still wakes the scheduler
 * and is then dropped: wasteful, but never wrong, and self-correcting the
 * instant the pause is lifted. Prefer the failure mode that is cheap and loud
 * over the one that is silent and wrong.
 */

/**
 * The operator-visible state of an automation.
 *
 * Exactly one of three values — the console's State column renders this
 * directly, and the Pause/Resume row actions gate on it:
 *
 *   - `'active'`   — runs normally. Offers Pause.
 *   - `'paused'`   — operationally paused. Offers Resume.
 *   - `'disabled'` — `enabled: false` in config. Offers NEITHER control,
 *                    because neither would do anything: only a config edit can
 *                    bring it back.
 */
export type AutomationOperationalState = 'active' | 'paused' | 'disabled'

/**
 * The shape every call site can supply — the config automation carries far
 * more, but only these two fields participate in the decision. Structural, so
 * a `.filter()` over `app.automations` passes its element straight in.
 */
export interface AutomationOperationalInput {
  readonly name: string
  readonly enabled?: boolean | undefined
}

/**
 * Resolve an automation's operator-visible state.
 *
 * PRECEDENCE: config `disabled` outranks an operational `paused`. When an
 * automation is both paused and config-disabled, it reports `'disabled'` —
 * the stronger, less-reversible statement, and the one whose remedy (edit the
 * config) is the only one that can actually help.
 *
 * The pause row is NOT cleared when config disables an automation, and that is
 * deliberate: if the author later re-enables it in config, the automation
 * returns to `'paused'` rather than silently resuming. An operator who paused
 * something during an incident does not expect a config deploy to un-pause it.
 */
export const resolveAutomationOperationalState = (
  automation: AutomationOperationalInput,
  pausedNames: ReadonlySet<string>
): AutomationOperationalState =>
  automation.enabled === false ? 'disabled' : pausedNames.has(automation.name) ? 'paused' : 'active'

/**
 * May this automation produce a run right now?
 *
 * THE gate. Every one of the eleven routed call sites reduces to this call,
 * replacing its bare `automation.enabled === false` check:
 *
 *   Resolvers (fail `AutomationNotFound` → 404):
 *     - application/use-cases/automations/run-automation.ts        (webhook)
 *     - application/use-cases/automations/run-manual-automation.ts (manual)
 *     - application/use-cases/automations/replay-automation-run.ts (replay)
 *     - application/use-cases/automations/run-cron-automation.ts   (cron, scheduled)
 *     - application/use-cases/automations/run-cron-automation.ts   (cron, on-demand)
 *
 *   Boolean `.filter()` predicates (exclude from the matched set):
 *     - application/use-cases/automations/trigger-record-event.ts
 *     - application/use-cases/automations/trigger-form-submission.ts
 *     - application/use-cases/automations/trigger-auth-event.ts
 *     - application/use-cases/automations/trigger-comment-event.ts
 *
 *   Presentation-layer gates:
 *     - presentation/api/routes/automations/webhook-handler.ts      (HTTP entry, 404)
 *     - presentation/api/routes/tables/record/record-update-handler.ts (fast path)
 *
 * ANTI-ENUMERATION: because a paused automation and a config-disabled one both
 * return `false` here, and every call site already treats `false` exactly as it
 * treated `enabled === false`, the two off-states are externally
 * indistinguishable — same 404, same silent filter-out, at the same layer.
 * That preserves the property `[internal ref]` established, and
 * it is the reason the webhook HTTP gate must be routed through here too: that
 * gate runs BEFORE auth and rate-limiting, so leaving it on the bare config
 * check would let a paused automation answer `401` where a disabled one
 * answers `404` — an oracle telling an attacker the automation exists.
 *
 * IN-FLIGHT RUNS: this predicate is consulted at dispatch/resolve time only —
 * never inside the run loop. Pausing an automation stops NEW runs; a run
 * already executing is not cancelled and finishes normally.
 */
export const isAutomationOperationallyEnabled = (
  automation: AutomationOperationalInput,
  pausedNames: ReadonlySet<string>
): boolean => resolveAutomationOperationalState(automation, pausedNames) === 'active'
