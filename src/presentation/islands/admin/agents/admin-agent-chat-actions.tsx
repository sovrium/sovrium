/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Action cards for an agent chat turn — the operator-visible record of what the
 * assistant actually DID, rendered from the live `actions[]` the chat endpoint
 * returns alongside `reply`.
 *
 * Rendered from `actions[]` on purpose, never from `ai_messages.tool_calls`:
 * that column is written by nothing (the only INSERT,
 * `ai-memory-repository-live.ts:130-147`, omits it), so a card built over it
 * would be permanently blank. `actions[]` is the live signal and is populated
 * by both the query path and the automation path.
 *
 * [internal ref] A7: status is carried by TYPOGRAPHY, not colour — a failed run takes
 * full foreground contrast while a completed one recedes to muted, so the thing
 * an operator must act on is the thing that stands out. No `success` / `warning`
 * token appears here; both were retired, and re-introducing a green/amber pill
 * would put decorative colour back on an operational surface.
 */

import { type ReactElement } from 'react'

/** The action shape returned by the chat endpoint (`chatActionSchema`). */
export interface ChatTurnAction {
  readonly type: 'query' | 'create' | 'update' | 'delete' | 'automation'
  readonly table?: string
  readonly recordId?: string | number
  readonly description: string
  readonly name?: string
  readonly status?: 'completed' | 'failed' | 'running'
  readonly runId?: string
  readonly duration?: number
}

/**
 * Monochrome inline glyphs — one per action type. No emoji, no icon font.
 *
 * Drawn on the SAME 16-unit grid and at the SAME 1.5 stroke as every other icon
 * in the product, including the lucide set the renderers resolve. They were on a
 * 24 grid at 1.6, rendered down into a 16px box: a glyph a shade heavier than
 * its neighbours and aligned to a different lattice, which is exactly the kind
 * of difference that reads as sloppiness without being nameable.
 *
 * `query` is the reference's own search mark, so it is two shapes rather than
 * one path — hence a fragment per type instead of a path table.
 */
function ActionIcon({ type }: { readonly type: ChatTurnAction['type'] }): ReactElement {
  const shapes: Readonly<Record<ChatTurnAction['type'], ReactElement>> = {
    query: (
      <>
        <circle
          cx="7"
          cy="7"
          r="4.2"
        />
        <path d="m10.3 10.3 3.2 3.2" />
      </>
    ),
    create: <path d="M8 3.5v9M3.5 8h9" />,
    update: <path d="M3.5 13.5H6L14 5.5a1.4 1.4 0 0 0-2-2L4 11.5v2Z" />,
    delete: <path d="M3 4.5h10M6.5 7.5v4M9.5 7.5v4M4.2 4.5l.7 8.5h6.2l.7-8.5M6 4.5V3h4v1.5" />,
    automation: <path d="M8.5 2 3.5 9h4l-.5 5 5-7h-4l.5-5Z" />,
  }
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 shrink-0"
    >
      {shapes[type]}
    </svg>
  )
}

/** The headline for an action — what happened, in the operator's terms. */
function actionTitle(action: ChatTurnAction): string {
  const where = action.table ?? 'the table'
  switch (action.type) {
    case 'query':
      return action.table ? `Queried ${where}` : 'Queried records'
    case 'create':
      return `Created a record in ${where}`
    case 'update':
      return `Updated a record in ${where}`
    case 'delete':
      return `Deleted a record from ${where}`
    case 'automation':
      return `Ran ${action.name ?? 'an automation'}`
  }
}

/**
 * Run-status wording is borrowed from the run-history grid
 * (`automation-runs-surface.ts:83-92`) rather than echoing the raw enum, so an
 * operator reads the same word here and on `/_admin/automations`. One term per
 * concept — `completed` in the payload is "Success" everywhere a human looks.
 */
const RUN_STATUS_LABEL: Readonly<Record<NonNullable<ChatTurnAction['status']>, string>> = {
  completed: 'Success',
  failed: 'Failed',
  running: 'Running',
}

/**
 * The status line for an automation run. Failure keeps its next action — where
 * to go to read the log — because an operator told only "failed" has nowhere to
 * go. Restraint removes ornament, not the sentence that says what happens next.
 */
function AutomationStatus({
  action,
}: {
  readonly action: ChatTurnAction
}): ReactElement | undefined {
  if (action.type !== 'automation' || action.status === undefined) return undefined
  const failed = action.status === 'failed'
  const tone = failed ? 'text-foreground font-medium' : 'text-foreground-muted'
  const duration = typeof action.duration === 'number' ? ` · ${action.duration}s` : ''
  return (
    <p className={`flex flex-wrap items-center gap-2 text-sm ${tone}`}>
      <span>
        {RUN_STATUS_LABEL[action.status]}
        {duration}
      </span>
      {action.runId ? (
        <span className="text-foreground-subtle font-mono">run {action.runId}</span>
      ) : undefined}
      {failed ? (
        <span className="text-foreground-muted">Open Automations to read the run log.</span>
      ) : undefined}
    </p>
  )
}

/** One action card. */
function ActionCard({ action }: { readonly action: ChatTurnAction }): ReactElement {
  return (
    <li className="border-border bg-background-subtle flex items-start gap-3 rounded-md border px-3 py-2">
      <span className="text-foreground-subtle mt-1">
        <ActionIcon type={action.type} />
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-foreground text-sm font-medium">{actionTitle(action)}</p>
        <p className="text-foreground-muted text-sm leading-relaxed">{action.description}</p>
        <AutomationStatus action={action} />
      </div>
    </li>
  )
}

/**
 * The action list under an assistant turn. Renders nothing when the turn took
 * no actions — an empty card rail would imply the assistant tried and failed.
 */
export function ChatTurnActions({
  actions,
}: {
  readonly actions: ReadonlyArray<ChatTurnAction>
}): ReactElement | undefined {
  if (actions.length === 0) return undefined
  return (
    <ul
      aria-label="Actions taken"
      className="mt-2 flex flex-col gap-2"
    >
      {actions.map((action, index) => (
        <ActionCard
          key={`${action.type}-${action.runId ?? action.recordId ?? index}`}
          action={action}
        />
      ))}
    </ul>
  )
}
