/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { lazy, Suspense, useState } from 'react'
import { computeAiChatToolDecisionClasses } from '@/presentation/design/ai-chat-composition-classes'
import {
  computeTraceCollapsibleContentClasses,
  computeTraceDescriptionClasses,
  computeTraceLineClasses,
} from '@/presentation/design/trace-default-classes'
import { TraceTrigger } from './trace-trigger'
import type { ChatLabels, ChatToolLine } from './types'
import type { ReactElement } from 'react'

/**
 * A tool the agent called, as a Trace line (`trace-parts.tsx` draws the rest
 * of the trace): its name and where it stands, Approve and Deny while it waits
 * for the reader, and a trigger that opens it onto what the call was given and
 * what it returned (`tool-card.tsx`, loaded the first time a line is opened).
 */

/** The words a tool line reads, in the page language. */
export type ToolLineLabels = Pick<
  ChatLabels,
  | 'approve'
  | 'deny'
  | 'awaitingApproval'
  | 'denied'
  | 'failed'
  | 'running'
  | 'closed'
  | 'input'
  | 'output'
  | 'truncated'
>

/** What a line needs to offer the reader a decision on its held call. */
export interface DecisionProps {
  readonly labels: ToolLineLabels
  /** A request is in flight: the decision cannot be sent twice. */
  readonly busy: boolean
  readonly onDecide: (approvalId: string, decision: 'approve' | 'reject') => void
}

/**
 * Where a tool stands, in words: none once done, and none for a call held
 * without the id to decide it by.
 */
const stateWords = (tool: ChatToolLine, labels: ToolLineLabels): string | undefined =>
  tool.state === 'pending-approval'
    ? tool.approvalId === undefined
      ? undefined
      : labels.awaitingApproval
    : tool.state === 'done'
      ? undefined
      : labels[tool.state]

/** A line's `data-status`: unset once it has settled. */
const STATUS: Partial<Record<ChatToolLine['state'], string>> = {
  running: 'running',
  failed: 'error',
  'pending-approval': 'pending',
}

/** A wrench: a tool the agent called. */
const TOOL_GLYPH =
  'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z'

/** The card an open line shows, loaded the first time a reader opens one. */
const ToolCard = lazy(() => import('./tool-card'))

/** Approve and Deny, inside the line of a call held for the reader (shadcn's Confirmation). */
const HeldDecision = ({
  approvalId,
  labels,
  busy,
  onDecide,
}: DecisionProps & { readonly approvalId: string }): ReactElement => (
  <span className="flex gap-1.5">
    <button
      type="button"
      data-testid="chat-approve"
      disabled={busy}
      onClick={() => onDecide(approvalId, 'approve')}
      className={computeAiChatToolDecisionClasses('default')}
    >
      {labels.approve}
    </button>
    <button
      type="button"
      data-testid="chat-deny"
      disabled={busy}
      onClick={() => onDecide(approvalId, 'reject')}
      className={computeAiChatToolDecisionClasses('outline')}
    >
      {labels.deny}
    </button>
  </span>
)

/** One tool the agent called: its name, its state, the decision while it is held, and its card. */
export const ToolLine = ({
  tool,
  labels,
  busy,
  onDecide,
}: DecisionProps & { readonly tool: ChatToolLine }): ReactElement => {
  const [open, setOpen] = useState(false)
  const { approvalId } = tool
  const held = tool.state === 'pending-approval' && approvalId !== undefined
  const words = stateWords(tool, labels)
  return (
    <div
      data-slot="trace-line"
      data-status={STATUS[tool.state]}
      data-testid="chat-tool"
      data-tool-name={tool.name}
      data-tool-state={tool.state}
      aria-busy={tool.state === 'running' ? true : undefined}
      className={computeTraceLineClasses()}
    >
      <TraceTrigger
        open={open}
        onToggle={() => setOpen(!open)}
        glyph={TOOL_GLYPH}
        title={tool.name}
        shimmer={tool.state === 'running'}
      >
        {words !== undefined && (
          <span
            data-slot="trace-description"
            className={computeTraceDescriptionClasses()}
          >
            {words}
          </span>
        )}
      </TraceTrigger>
      {held && (
        <HeldDecision
          approvalId={approvalId}
          labels={labels}
          busy={busy}
          onDecide={onDecide}
        />
      )}
      {open && (
        <div
          data-slot="trace-collapsible-content"
          className={computeTraceCollapsibleContentClasses()}
        >
          <Suspense fallback={null}>
            <ToolCard
              tool={tool}
              labels={labels}
            />
          </Suspense>
        </div>
      )}
    </div>
  )
}
