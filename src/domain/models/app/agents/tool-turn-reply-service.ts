/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * User-facing reply text when every tool the model requested in a turn was
 * blocked by RBAC. Surfaced verbatim so the caller learns the request was
 * denied rather than receiving an empty reply.
 */
const RBAC_DENIED_REPLY =
  'I cannot complete that request — you do not have permission to access the requested data.'

/**
 * Reply text for a turn that EXECUTED tools but settled without any assistant
 * prose — the model kept requesting tools until the iteration budget ran out
 * or the follow-up provider call failed.
 *
 * Deliberately not a fabricated answer: it reports what is actually known —
 * that the lookups ran and no summary came back — and points at the `actions[]`
 * that accompany it, which carry the real record of what happened. An empty
 * assistant bubble would read as a turn that silently did nothing, hiding work
 * that in fact executed against the operator's data.
 */
const NO_SUMMARY_REPLY =
  'I completed the requested lookups, but the assistant did not return a final summary. The actions taken are listed alongside this reply.'

/**
 * The reply of a turn that called tools: the model's final answer, else the
 * denial when the turn ended on refused calls, else a note that the lookups
 * ran without a summary — never an empty bubble for work that did run.
 */
export const toolTurnReply = (
  reply: string,
  results: ReadonlyArray<{ readonly outcome: string }>
): string => {
  if (reply.length > 0) return reply
  return results.at(-1)?.outcome === 'denied' ? RBAC_DENIED_REPLY : NO_SUMMARY_REPLY
}
