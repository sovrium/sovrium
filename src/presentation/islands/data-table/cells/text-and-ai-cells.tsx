/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The read-only cells of the field types that would otherwise print through
 * TanStack's `String(value)` passthrough: the two text types, a signature (an
 * object, so `[object Object]`), every AI type, and a type the schema does not
 * know.
 *
 * An AI field is drawn as the value it OUTPUTS — a summary is text, a category a
 * pill, tags are chips, a sentiment its label, an extraction its JSON — and
 * carries the same visible `AI` mark the record drawer draws, so a reader can
 * tell a value a model wrote from one a person typed.
 */

import { EMPTY_VALUE, isMissing } from '../cell-empty'
import {
  ArrayChipsCell,
  JsonPreviewCell,
  StatusPillCell,
  type CellFieldOptions,
} from '../cell-renderers'

type CellProps = { readonly value: unknown; readonly fieldOptions?: CellFieldOptions }

/** The two-line clamp a long text takes; the full text rides on `title`. */
const CLAMPED_TEXT = 'line-clamp-2 whitespace-normal break-words'

/** A `single-line-text` value: the text it is. */
export function TextCell({ value }: CellProps): React.ReactNode {
  return isMissing(value) ? EMPTY_VALUE : String(value)
}

/**
 * A `long-text` value, clamped to two lines so one note cannot grow a row, with
 * the whole text on hover (`title`) and for a screen reader (it is all there).
 */
export function LongTextCell({ value }: CellProps): React.ReactNode {
  if (isMissing(value)) return EMPTY_VALUE
  const text = String(value)
  return (
    <span
      title={text}
      className={CLAMPED_TEXT}
    >
      {text}
    </span>
  )
}

/** A stored JSON value, parsed when a dialect handed it back as text. */
function parsedJson(value: unknown): unknown {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return value
  try {
    return JSON.parse(trimmed) as unknown
  } catch {
    return value
  }
}

/** One readable string key of an object value, or `undefined`. */
function stringKey(value: unknown, key: string): string | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const read = (value as Readonly<Record<string, unknown>>)[key]
  return typeof read === 'string' && read.length > 0 ? read : undefined
}

/**
 * A `signature` value — `{ image, signerName, signedAt, statement, method }`.
 * A record read mints no download URL for the image, so the cell says who
 * signed, with the instant on hover; never the object spelled out.
 */
export function SignatureCell({ value }: CellProps): React.ReactNode {
  if (isMissing(value)) return EMPTY_VALUE
  const signature = parsedJson(value)
  const signer = stringKey(signature, 'signerName')
  if (signer === undefined) return EMPTY_VALUE
  const signedAt = stringKey(signature, 'signedAt')
  return <span {...(signedAt !== undefined && { title: signedAt })}>{`Signed by ${signer}`}</span>
}

/** A value of a type the schema does not name: its text, or its JSON preview. */
export function UnknownValueCell({ value }: CellProps): React.ReactNode {
  if (isMissing(value)) return EMPTY_VALUE
  return typeof value === 'object' ? <JsonPreviewCell value={value} /> : String(value)
}

/** The visible mark beside a value an AI field wrote — text, as the drawer draws it. */
function AiValueMark(): React.ReactNode {
  return (
    <span
      data-ai-value=""
      className="border-border text-muted-foreground shrink-0 rounded border px-1 text-xs font-medium"
    >
      AI
    </span>
  )
}

/** An AI value and its mark; nothing at all when the model has written nothing yet. */
function AiValue({
  value,
  children,
}: {
  readonly value: unknown
  readonly children: React.ReactNode
}) {
  if (isMissing(value)) return EMPTY_VALUE
  return (
    <span className="inline-flex max-w-full min-w-0 items-center gap-1.5">
      {children}
      <AiValueMark />
    </span>
  )
}

/** `ai-summary`, `ai-generate`, `ai-translate`: text, clamped like a long text. */
export function AiTextCell({ value }: CellProps): React.ReactNode {
  return (
    <AiValue value={value}>
      <LongTextCell value={value} />
    </AiValue>
  )
}

/** `ai-categorize`: the one category, as a select option's pill. */
export function AiCategoryCell({ value, fieldOptions }: CellProps): React.ReactNode {
  return (
    <AiValue value={value}>
      <StatusPillCell
        value={value}
        {...(fieldOptions !== undefined && { fieldOptions })}
      />
    </AiValue>
  )
}

/** `ai-tag`: one chip per tag. */
export function AiTagsCell({ value, fieldOptions }: CellProps): React.ReactNode {
  return (
    <AiValue value={value}>
      <ArrayChipsCell
        value={value}
        {...(fieldOptions !== undefined && { fieldOptions })}
      />
    </AiValue>
  )
}

/** `ai-sentiment` (`{ label, score, explanation }`): the label as a pill, the reason on hover. */
export function AiSentimentCell({ value }: CellProps): React.ReactNode {
  const sentiment = parsedJson(value)
  const label = typeof sentiment === 'string' ? sentiment : stringKey(sentiment, 'label')
  if (label === undefined) return EMPTY_VALUE
  const explanation = stringKey(sentiment, 'explanation')
  return (
    <AiValue value={label}>
      <span {...(explanation !== undefined && { title: explanation })}>
        <StatusPillCell value={label} />
      </span>
    </AiValue>
  )
}

/** `ai-extract`: the extracted structure, previewed as a `json` value is. */
export function AiExtractCell({ value }: CellProps): React.ReactNode {
  return (
    <AiValue value={value}>
      <JsonPreviewCell value={parsedJson(value)} />
    </AiValue>
  )
}
