/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ChangeEvent, type ReactElement, useCallback } from 'react'
import { useAgentConversationString as useWord } from './admin-agent-conversations-strings'

/**
 * The control above the conversation list: the agent filter. The search box is
 * the page's own, in its toolbar row.
 */

/**
 * The agent filter above the conversation list. Defaults to
 * "All agents" (value `''`); selecting an agent narrows the merged list to
 * that agent's conversations. Hidden when there are fewer than two agents to
 * choose between. Mirrors the native-select pattern used elsewhere.
 *
 * Campaign 4A made the agent a URL segment, so the surface now mounts this
 * island with a SINGLE-element `agentNames` and the `< 2` guard hides the
 * control on every real render. It is kept rather than deleted because it is the
 * one code path: the island still filters by agent internally, and a future
 * merged view (or a spec mounting several names) gets the control back for free
 * instead of needing it rebuilt.
 */
export function AgentFilter({
  agent,
  onAgent,
  agentNames,
}: {
  readonly agent: string
  readonly onAgent: (value: string) => void
  readonly agentNames: ReadonlyArray<string>
}): ReactElement | null {
  const handleChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => onAgent(event.target.value),
    [onAgent]
  )
  const words = {
    agent: useWord('agent', 'Agent'),
    filter: useWord('filterByAgent', 'Filter by agent'),
    all: useWord('allAgents', 'All agents'),
  }
  if (agentNames.length < 2) return null
  return (
    <label className="text-md flex items-center gap-2">
      <span className="text-foreground-subtle text-sm">{words.agent}</span>
      <select
        aria-label={words.filter}
        value={agent}
        onChange={handleChange}
        className="border-border bg-background text-foreground text-md flex-1 rounded-md border px-2 py-1"
      >
        <option value="">{words.all}</option>
        {agentNames.map((name) => (
          <option
            key={name}
            value={name}
          >
            {name}
          </option>
        ))}
      </select>
    </label>
  )
}
