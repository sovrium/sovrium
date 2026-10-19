/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useState } from 'react'
import {
  computeTraceClasses,
  computeTraceCollapsibleContentClasses,
  computeTraceLineClasses,
} from '@/presentation/design/trace-default-classes'
import { ToolLine, type DecisionProps, type ToolLineLabels } from './trace-tool-line'
import { TraceTrigger } from './trace-trigger'
import type { ChatLabels, ChatToolLine } from './types'
import type { ReactElement } from 'react'

/**
 * The agent at work, before an answer's bubble, as `trace` lines (shadcn's
 * Trace, drawn inside the chat only): the model's reasoning, collapsed, and a
 * line per tool the agent called (`trace-tool-line.tsx`), saying where it
 * stands in words, with Approve and Deny while a call waits for the reader.
 */

/** The words the lines read, in the page language. */
export type TraceLabels = ToolLineLabels & Pick<ChatLabels, 'reasoning'>

/** A spark: the model thinking. */
const REASONING_GLYPH = 'M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z'

/** An answer that called no tool. */
const NO_TOOLS: readonly ChatToolLine[] = []

/**
 * The model's reasoning: a line closed by default, whose trigger opens it onto
 * what the model thought, muted and ruled off so it never competes with the
 * answer.
 */
const ReasoningLine = ({
  text,
  label,
}: {
  readonly text: string
  readonly label: string
}): ReactElement => {
  const [open, setOpen] = useState(false)
  return (
    <div
      data-slot="trace-line"
      data-testid="chat-reasoning"
      className={computeTraceLineClasses()}
    >
      <TraceTrigger
        open={open}
        onToggle={() => setOpen(!open)}
        glyph={REASONING_GLYPH}
        title={label}
      />
      {open && (
        <div
          data-slot="trace-collapsible-content"
          className={computeTraceCollapsibleContentClasses()}
        >
          {text}
        </div>
      )}
    </div>
  )
}

/**
 * The trace an answer opens with — its reasoning, then a line per tool — or
 * nothing, for an answer that neither reasoned nor called a tool.
 */
export const AnswerTrace = ({
  reasoning = '',
  tools = NO_TOOLS,
  ...decision
}: Omit<DecisionProps, 'labels'> & {
  readonly labels: TraceLabels
  readonly reasoning?: string | undefined
  readonly tools?: readonly ChatToolLine[] | undefined
}): ReactElement | null =>
  reasoning.length === 0 && tools.length === 0 ? null : (
    <div
      data-slot="trace"
      className={computeTraceClasses()}
    >
      {reasoning.length > 0 && (
        <ReasoningLine
          text={reasoning}
          label={decision.labels.reasoning}
        />
      )}
      {tools.map((tool) => (
        <ToolLine
          key={tool.id}
          tool={tool}
          {...decision}
        />
      ))}
    </div>
  )
