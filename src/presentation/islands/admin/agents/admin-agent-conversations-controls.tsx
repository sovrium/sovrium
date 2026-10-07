/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ChangeEvent, type ReactElement, useCallback } from 'react'
import type { NewConversationState } from './admin-agent-conversations-state'

/**
 * The controls above the conversation list: starting a conversation, the
 * agent filter and the search field.
 */

/**
 * The "New conversation" trigger + agent picker. The
 * "New conversation" button opens an "Agent" combobox; picking an agent
 * opens the composer in the thread column. The picker only renders once the
 * compose flow is active so the empty starting state is a single clean CTA.
 */
export function NewConversation({
  state,
  agentNames,
  onStart,
  onPickAgent,
}: {
  readonly state: NewConversationState
  readonly agentNames: ReadonlyArray<string>
  readonly onStart: () => void
  readonly onPickAgent: (value: string) => void
}): ReactElement {
  const handlePick = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => onPickAgent(event.target.value),
    [onPickAgent]
  )
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={onStart}
        className="text-foreground-muted border-border-strong/40 bg-background-subtle hover:bg-background-subtle/70 text-md inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 font-medium transition-colors"
      >
        <span
          aria-hidden="true"
          className="text-lg leading-none"
        >
          +
        </span>
        New conversation
      </button>
      {state.active ? (
        <label className="text-md flex items-center gap-2">
          <span className="text-foreground-subtle text-sm">Agent</span>
          <select
            aria-label="Agent"
            value={state.agent}
            onChange={handlePick}
            className="border-border bg-background text-foreground text-md flex-1 rounded-md border px-2 py-1"
          >
            <option value="">Choose an agent…</option>
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
      ) : undefined}
    </div>
  )
}

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
  hidden,
}: {
  readonly agent: string
  readonly onAgent: (value: string) => void
  readonly agentNames: ReadonlyArray<string>
  /** Hidden while the "New conversation" picker is open, so only one "Agent"-ish combobox exists. */
  readonly hidden: boolean
}): ReactElement | null {
  const handleChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => onAgent(event.target.value),
    [onAgent]
  )
  if (agentNames.length < 2 || hidden) return null
  return (
    <label className="text-md flex items-center gap-2">
      <span className="text-foreground-subtle text-sm">Agent</span>
      <select
        aria-label="Filter by agent"
        value={agent}
        onChange={handleChange}
        className="border-border bg-background text-foreground text-md flex-1 rounded-md border px-2 py-1"
      >
        <option value="">All agents</option>
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

/** The search box above the conversation list. */
export function ListSearch({
  search,
  onSearch,
}: {
  readonly search: string
  readonly onSearch: (value: string) => void
}): ReactElement {
  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => onSearch(event.target.value),
    [onSearch]
  )
  return (
    <div className="relative">
      <svg
        aria-hidden="true"
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-foreground-subtle pointer-events-none absolute top-2.5 left-2.5"
      >
        <circle
          cx="7"
          cy="7"
          r="4.2"
        />
        <path d="m10.3 10.3 3.2 3.2" />
      </svg>
      <input
        type="search"
        value={search}
        onChange={handleChange}
        placeholder="Search conversations…"
        aria-label="Search conversations"
        className="border-border bg-background-raised focus:border-border-strong focus:ring-focus-ring/30 text-md w-full rounded-md border py-1.5 pr-3 pl-8 transition-colors focus:ring-2 focus:outline-none"
      />
    </div>
  )
}
