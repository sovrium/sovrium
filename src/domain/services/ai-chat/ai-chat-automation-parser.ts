/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { normaliseSeparators } from './ai-chat-parsing'

export interface AutomationCandidate {
  readonly name: string
  readonly triggerType: string
}

export type AutomationIntent =
  | {
      readonly matched: 'found'
      readonly automation: AutomationCandidate
    }
  | {
      readonly matched: 'unknown'
    }

const TRIGGER_VERB_RE = /\b(run|trigger|execute|start|launch|kick off)\b/i

const messageReferencesAutomation = (
  normalisedMessage: string,
  automation: AutomationCandidate
): boolean => {
  const exact = automation.name.toLowerCase()
  const spaced = normaliseSeparators(automation.name)
  return normalisedMessage.includes(exact) || normalisedMessage.includes(spaced)
}

export const parseAutomationIntent = (
  message: string,
  automations: ReadonlyArray<AutomationCandidate>
): AutomationIntent | undefined => {
  if (!TRIGGER_VERB_RE.test(message)) return undefined

  const normalised = normaliseSeparators(message)
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
