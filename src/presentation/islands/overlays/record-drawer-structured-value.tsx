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
      <span className="text-muted-foreground">{name}</span>
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

/** One `term → value` pair of a key-value block: the term above, the value under it. */
function TermPairs({ entries }: { readonly entries: ReadonlyArray<readonly [string, unknown]> }) {
  return (
    <dl className="flex flex-col gap-3">
      {entries.map(([name, val]) => (
        <div
          key={name}
          className="flex flex-col gap-0.5"
        >
          <dt className="text-muted-foreground text-xs font-medium">{name}</dt>
          <dd className="text-foreground text-sm break-words whitespace-pre-wrap">
            {formatScalar(val)}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * An object as a key-value block: each key a term over its value, and a key
 * holding an object of its own a titled group of those — a form's section and
 * the answers under it. The plain pairs come first, then the groups, each in
 * its own order.
 */
function KeyValueBlock({ data }: { readonly data: unknown }): ReactElement {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return <div className="flex flex-col gap-1">{renderObjectPairs(data)}</div>
  }
  const entries = Object.entries(data as RawRecord)
  const isGroup = (val: unknown): val is RawRecord =>
    typeof val === 'object' && val !== null && !Array.isArray(val)
  const pairs = entries.filter(([, val]) => !isGroup(val))
  const groups = entries.filter((entry): entry is [string, RawRecord] => isGroup(entry[1]))
  return (
    <div className="flex flex-col gap-3">
      {pairs.length > 0 && <TermPairs entries={pairs} />}
      {groups.map(([title, group]) => (
        <div
          key={title}
          role="group"
          aria-label={title}
          className="flex flex-col gap-1"
        >
          <p className="text-foreground text-sm font-medium">{title}</p>
          <TermPairs entries={Object.entries(group)} />
        </div>
      ))}
    </div>
  )
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
  if (renderAs === 'key-value') return <KeyValueBlock data={data} />
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
