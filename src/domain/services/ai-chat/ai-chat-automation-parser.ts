/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * AI Chat Automation-Trigger Intent Parser
 *
 * Pure domain function that derives a structured {@link AutomationIntent} from
 * a natural-language chat message and the app's automation metadata. It powers
 * `[internal ref]`.
 *
 * Why a route-side parser rather than trusting the AI provider's response:
 * the E2E mock AI server matches seeded responses by literal substring on the
 * whole prompt — the seeded patterns ("weekly-report", "slow", …) do not
 * occur verbatim in the user messages, so the mock returns its default
 * category text. The chat surface therefore owns trigger-intent extraction:
 * it parses the user's request deterministically, runs the manual automation,
 * and formats a human-readable reply itself.
 *
 * This mirrors the sibling {@link import('./ai-chat-query-parser')} and
 * {@link import('./ai-chat-mutation-parser')} modules — a trigger turn is the
 * automation-invoking counterpart of a query/mutation turn. The parser is
 * deliberately structural (it accepts the minimal automation shape it needs)
 * so it stays in the domain layer with no presentation/application dependency.
 *
 * Recognised shapes:
 *  - "Run the weekly report"        → triggers `weekly-report`
 *  - "Run the daily-sync automation" → matches `daily-sync` (so a non-manual
 *    trigger can be detected and politely refused)
 *  - "Run the nonexistent-automation" → trigger verb present but no match →
 *    `{ matched: 'unknown' }` so the route can answer "not found"
 */

import { normaliseSeparators } from './ai-chat-parsing'

/** Minimal automation shape the trigger parser reads. */
export interface AutomationCandidate {
  readonly name: string
  /** Trigger discriminator — only `'manual'` automations are triggerable. */
  readonly triggerType: string
}

/** A parsed automation-trigger intent. */
export type AutomationIntent =
  | {
      /** A declared automation was matched by name. */
      readonly matched: 'found'
      readonly automation: AutomationCandidate
    }
  | {
      /** A trigger verb was present but no declared automation matched. */
      readonly matched: 'unknown'
    }

/**
 * Verbs that signal the user wants to *run* an automation. Kept narrow so a
 * benign mention ("the weekly report looks great") does not accidentally fire
 * a run — the verb must appear as a whole word.
 */
const TRIGGER_VERB_RE = /\b(run|trigger|execute|start|launch|kick off)\b/i

/**
 * Decide whether `message` references `automation` by name. The automation's
 * kebab-case name is normalised to space-separated words so a message that
 * writes the name informally ("the weekly report") still matches the
 * `weekly-report` automation.
 */
const messageReferencesAutomation = (
  normalisedMessage: string,
  automation: AutomationCandidate
): boolean => {
  const exact = automation.name.toLowerCase()
  const spaced = normaliseSeparators(automation.name)
  return normalisedMessage.includes(exact) || normalisedMessage.includes(spaced)
}

/**
 * Parse a chat message for an automation-trigger intent.
 *
 * Resolution:
 *  1. No trigger verb (`run`, `trigger`, …) → `undefined` (not a trigger turn).
 *  2. A declared automation is named in the message → `{ matched: 'found' }`.
 *  3. A trigger verb but no declared automation matched → `{ matched: 'unknown' }`
 *     so the route can answer "automation not found" rather than ignoring the
 *     request.
 *
 * The longest-name-first ordering means "Run the weekly-report-extended"
 * prefers `weekly-report-extended` over a shorter `weekly-report` sibling.
 */
export const parseAutomationIntent = (
  message: string,
  automations: ReadonlyArray<AutomationCandidate>
): AutomationIntent | undefined => {
  if (!TRIGGER_VERB_RE.test(message)) return undefined

  const normalised = normaliseSeparators(message)
  // Of every automation the message references, keep the one with the longest
  // name so "Run the weekly-report-extended" prefers `weekly-report-extended`
  // over a shorter `weekly-report` sibling. A `reduce` (rather than a
  // `sort().find()`) keeps the scan immutable — no array mutation.
  const match = automations
    .filter((automation) => messageReferencesAutomation(normalised, automation))
    .reduce<AutomationCandidate | undefined>(
      (longest, candidate) =>
        longest === undefined || candidate.name.length > longest.name.length ? candidate : longest,
      undefined
    )

  if (match !== undefined) return { matched: 'found', automation: match }
  return { matched: 'unknown' }
}
