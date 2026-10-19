/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A message's tool calls, one collapsed row each: the tool's name and a
 * one-line summary of what it was given, opened on demand to show the input
 * and the output in full.
 *
 * Collapsed by default because a transcript is read for what was SAID; the
 * arguments of every call, open, push the conversation off the screen. The
 * stored payload is opaque JSON, so the reader tolerates both spellings the
 * model layers write — `name`/`toolName`, `input`/`args`/`arguments`,
 * `output`/`result` — and an argument string that is itself JSON.
 */

import { type ReactElement, useCallback, useState } from 'react'
import { conversationCaptions, recordedCallParts } from './admin-agent-conversations-captions'

/**
 * A call the engine recorded for a turn it ran: what ran, how it ended, on
 * which table and how many rows — never its input or output.
 */
interface RecordedCall {
  readonly outcome: string
  readonly table?: string | undefined
  readonly rowCount?: number | undefined
}

/** One call, as the row draws it. */
interface ToolCallView {
  readonly name: string
  readonly input: unknown
  readonly output: unknown
  /** Set for a call stored in the engine's shape, read as one sentence. */
  readonly recorded?: RecordedCall | undefined
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** A JSON string parsed, anything else as it came. */
const parsed = (value: unknown): unknown => {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value) as unknown
  } catch {
    return value
  }
}

const firstDefined = (record: Readonly<Record<string, unknown>>, keys: readonly string[]) =>
  keys.map((key) => record[key]).find((value) => value !== undefined)

/** The calls a stored `toolCalls` payload holds — none for anything unreadable. */
function toolCallsOf(payload: unknown): readonly ToolCallView[] {
  const items = Array.isArray(payload) ? payload : isRecord(payload) ? [payload] : []
  return items.filter(isRecord).map((call) => {
    const fn = isRecord(call['function']) ? call['function'] : {}
    const name = firstDefined(call, ['name', 'toolName']) ?? fn['name']
    return {
      name: typeof name === 'string' && name.length > 0 ? name : 'tool',
      input: parsed(firstDefined(call, ['input', 'args', 'arguments']) ?? fn['arguments']),
      output: parsed(firstDefined(call, ['output', 'result'])),
      recorded: recordedOf(call),
    }
  })
}

/** The recorded shape of a call, when it carries one (`outcome`). */
function recordedOf(call: Readonly<Record<string, unknown>>): RecordedCall | undefined {
  const { outcome, table, tableLabel, rowCount } = call
  if (typeof outcome !== 'string') return undefined
  const label = typeof tableLabel === 'string' ? tableLabel : table
  return {
    outcome,
    table: typeof label === 'string' ? label : undefined,
    rowCount: typeof rowCount === 'number' ? rowCount : undefined,
  }
}

/** The disclosure's chevron, at the row's end, turned down when the row is open. */
function Chevron({ open }: { readonly open: boolean }): ReactElement {
  return (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={
        open
          ? 'text-muted-foreground ml-auto shrink-0 rotate-90'
          : 'text-muted-foreground ml-auto shrink-0'
      }
    >
      <path d="m4.5 2.5 3.5 3.5-3.5 3.5" />
    </svg>
  )
}

/** A wrench: the row is a tool the agent called. */
function Wrench(): ReactElement {
  return (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-muted-foreground shrink-0"
    >
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z" />
    </svg>
  )
}

/** What a closed row says: the recorded sentence, or the tool and its input. */
function CallSummary({ call }: { readonly call: ToolCallView }): ReactElement {
  if (call.recorded !== undefined) {
    const { before, tool, after } = recordedCallParts({ name: call.name, ...call.recorded })
    return (
      <span className="text-muted-foreground min-w-0 truncate">
        {before}
        <code className="text-foreground font-mono">{tool}</code>
        {after}
      </span>
    )
  }
  return (
    <>
      <span className="text-foreground shrink-0 font-mono font-medium">{call.name}</span>
      <span className="text-muted-foreground min-w-0 truncate font-mono">
        {inputSummary(call.input)}
      </span>
    </>
  )
}

const MAX_SUMMARY = 80

/** A value as one short phrase. */
const short = (value: unknown): string =>
  typeof value === 'string' ? value : value === undefined ? '' : JSON.stringify(value)

/** `orderId: A-12, limit: 5` — the input on one line, cut to fit. */
function inputSummary(input: unknown): string {
  const text = isRecord(input)
    ? Object.entries(input)
        .map(([key, value]) => `${key}: ${short(value)}`)
        .join(', ')
    : short(input)
  return text.length > MAX_SUMMARY ? `${text.slice(0, MAX_SUMMARY - 1)}…` : text
}

const pretty = (value: unknown): string =>
  typeof value === 'string' ? value : (JSON.stringify(value, undefined, 2) ?? '')

/** One labelled block of an opened call. */
function CallPart({ label, value }: { readonly label: string; readonly value: unknown }) {
  if (value === undefined) return undefined
  return (
    <div className="flex flex-col gap-1">
      <span className="text-foreground-subtle text-xs font-medium">{label}</span>
      <pre className="bg-muted overflow-x-auto rounded-md p-2 font-mono text-xs whitespace-pre-wrap">
        {pretty(value)}
      </pre>
    </div>
  )
}

/** One call: a disclosure row, closed until the reader opens it. */
function ToolCallRow({ call }: { readonly call: ToolCallView }): ReactElement {
  const [open, setOpen] = useState(false)
  const toggle = useCallback(() => setOpen((was) => !was), [])
  const captions = conversationCaptions()
  return (
    <div
      data-testid="tool-call"
      className="border-border bg-background rounded-lg border text-base"
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={toggle}
        className="hover:bg-muted/50 flex w-full min-w-0 items-center gap-2 rounded-lg px-3 py-2 text-left"
      >
        <Wrench />
        <CallSummary call={call} />
        <Chevron open={open} />
      </button>
      {open ? (
        <div className="border-border flex flex-col gap-2 border-t p-3">
          <CallPart
            label={captions.outcome}
            value={call.recorded?.outcome}
          />
          <CallPart
            label={captions.input}
            value={call.input}
          />
          <CallPart
            label={captions.output}
            value={call.output}
          />
        </div>
      ) : undefined}
    </div>
  )
}

/** Every call a message made, or nothing. */
export function ToolCalls({ payload }: { readonly payload: unknown }): ReactElement | undefined {
  const calls = toolCallsOf(payload)
  if (calls.length === 0) return undefined
  return (
    <div className="flex w-full flex-col gap-1.5">
      {calls.map((call, index) => (
        <ToolCallRow
          key={`${call.name}-${index}`}
          call={call}
        />
      ))}
    </div>
  )
}
