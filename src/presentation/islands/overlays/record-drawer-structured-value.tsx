/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A record drawer's structured value ([internal ref] CAP-3): a field
 * with a non-`text` `renderAs` renders a read-only block — json, list,
 * key-value or code — instead of an editable text input, so nested data reads
 * readably rather than mangling to `[object Object]` under `String(value)`.
 */

import type { ReactElement } from 'react'

type RawRecord = Record<string, unknown>

/** Parse a JSON string into its structured value; leave non-JSON / non-string untouched. */
function coerceStructured(value: unknown): unknown {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

/** Render a leaf readably; serialize a nested object/array instead of `[object Object]`. */
function formatScalar(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

/** One labelled `name: value` line inside a list item or a key-value block. */
function PairLine({
  name,
  value,
}: {
  readonly name: string
  readonly value: unknown
}): ReactElement {
  return (
    <span className="text-foreground text-sm">
      <span className="text-foreground-muted">{name}</span>
      {`: ${formatScalar(value)}`}
    </span>
  )
}

/** Labelled key/value lines of one object (a list item or a key-value object). */
function renderObjectPairs(value: unknown): ReactElement[] {
  if (typeof value !== 'object' || value === null) {
    return [
      <span
        key="_scalar"
        className="text-foreground text-sm"
      >
        {formatScalar(value)}
      </span>,
    ]
  }
  return Object.entries(value as RawRecord).map(([key, val]) => (
    <PairLine
      key={key}
      name={key}
      value={val}
    />
  ))
}

const PRE_CLASS = 'text-foreground overflow-auto text-sm'

/** Array-of-objects → a readable `<ul>` list, one labelled item per element. */
function StructuredList({ data }: { readonly data: unknown }): ReactElement {
  if (!Array.isArray(data)) {
    return <pre className={PRE_CLASS}>{JSON.stringify(data, undefined, 2)}</pre>
  }
  return (
    <ul className="flex flex-col gap-2">
      {data.map((item, index) => (
        <li
          key={index}
          className="border-border flex flex-col gap-1 rounded border p-2"
        >
          {renderObjectPairs(item)}
        </li>
      ))}
    </ul>
  )
}

/** Render a field value via its `renderAs` selector. */
export function StructuredValue({
  renderAs,
  value,
}: {
  readonly renderAs: string
  /** The stored value; a JSON string is parsed into the structure it holds. */
  readonly value: unknown
}): ReactElement {
  const data = coerceStructured(value)
  if (renderAs === 'list') return <StructuredList data={data} />
  if (renderAs === 'key-value') {
    return <div className="flex flex-col gap-1">{renderObjectPairs(data)}</div>
  }
  if (renderAs === 'code') {
    return (
      <pre className={PRE_CLASS}>
        {typeof data === 'string' ? data : JSON.stringify(data, undefined, 2)}
      </pre>
    )
  }
  // `json` (and any future structured default): pretty-print as indented JSON.
  return <pre className={PRE_CLASS}>{JSON.stringify(data, undefined, 2)}</pre>
}
