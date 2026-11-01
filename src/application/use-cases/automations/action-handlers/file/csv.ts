/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { parse } from 'csv-parse/sync'
import { escapeCsvCell } from '@/domain/kernel/format/csv-format'

/**
 * The CSV codec of the `file:*` actions — RFC 4180 via `csv-parse`, plus the
 * three decisions a parser cannot make for you: which byte encoding the
 * document is in, how many leading lines to drop, and which delimiter it uses.
 */

/** The delimiters `FileParseCsvActionSchema` accepts, in tie-break order. */
const DELIMITER_CANDIDATES: readonly string[] = [',', ';', '\t', '|']

/**
 * Escape a value for CSV output, through the kernel's one CSV cell escaper.
 *
 * The quoting decision is driven by the delimiter ACTUALLY in use, not by a
 * fixed character class: a value containing the active delimiter MUST be quoted
 * or it silently splits into two fields on re-read. The rest of the set is RFC
 * 4180's mandatory minimum (`"`, CR, LF) — nothing else is quoted, so a `;`
 * inside a comma-delimited file stays bare, which is legal and lossless. A text
 * value starting with a formula character gains a leading `'`; a number does
 * not.
 */
export const csvCell = (value: unknown, delimiter: string = ','): string =>
  escapeCsvCell(value, { delimiter })

/**
 * Decode CSV bytes as UTF-8, falling back to windows-1252 when the document is
 * not valid UTF-8 — what Excel FR still emits by default.
 *
 * This is an automatic FALLBACK rather than a declared `encoding` property on
 * purpose. An accented windows-1252 byte (0x80-0xFF) is never a valid
 * standalone UTF-8 sequence, so a fatal UTF-8 decode separates the two
 * encodings on its own: valid UTF-8 can never be mistaken for Latin-1, and the
 * operator never has to declare which one they were handed.
 */
export const decodeCsvBytes = (bytes: Uint8Array): string => {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('windows-1252').decode(bytes)
  }
}

/** First line with non-whitespace content, or `undefined` for a blank document. */
const firstNonBlankLine = (text: string): string | undefined => {
  const nl = text.indexOf('\n')
  const line = (nl === -1 ? text : text.slice(0, nl)).replace(/\r$/, '')
  if (line.trim() !== '') return line
  return nl === -1 ? undefined : firstNonBlankLine(text.slice(nl + 1))
}

/**
 * Drop the first `count` non-blank PHYSICAL lines — that, and nothing else, is
 * what `skipRows` means. Header handling stays orthogonal (see `csvRows`), so
 * asking to skip a preamble can never silently change the output shape.
 *
 * The remainder is returned verbatim rather than re-joined, so a quoted field
 * further down keeps its exact bytes, CRLF included.
 */
export const dropLeadingLines = (text: string, count: number): string => {
  if (count <= 0) return text
  const nl = text.indexOf('\n')
  if (nl === -1) return ''
  const remaining = text.slice(0, nl).trim() === '' ? count : count - 1
  return dropLeadingLines(text.slice(nl + 1), remaining)
}

interface CountState {
  readonly inQuotes: boolean
  readonly count: number
}

/** Occurrences of `target` in `line` that sit outside any quoted field. */
const countOutsideQuotes = (line: string, target: string): number =>
  Array.from(line).reduce<CountState>(
    (state, ch) => {
      if (ch === '"') return { inQuotes: !state.inQuotes, count: state.count }
      if (!state.inQuotes && ch === target) return { ...state, count: state.count + 1 }
      return state
    },
    { inQuotes: false, count: 0 }
  ).count

/**
 * Detect the field delimiter by COUNT, not by first match.
 *
 * Counting is the whole point: a `;`-delimited French export whose header
 * legitimately contains one comma (`ville, pays`) must still read as
 * semicolon-delimited. First-match-wins collapsed it into a single column.
 * Occurrences inside quotes do not count; ties fall back to comma.
 *
 * ORDERING CONTRACT: `text` must ALREADY have had `skipRows` applied. A
 * preamble line such as `# Export CRM` contains none of the four candidates, so
 * sampling the raw document would fall through to the comma default and
 * mis-parse the real header underneath it. Taking post-skip text is therefore
 * deliberate, not an accident of call order — hence this takes the DOCUMENT and
 * picks its own sample line rather than trusting the caller to pass the right
 * one.
 */
export const autoDelimiter = (text: string): string => {
  const sample = firstNonBlankLine(text)
  if (sample === undefined) return ','
  const best = DELIMITER_CANDIDATES.map((d) => ({ d, n: countOutsideQuotes(sample, d) })).reduce(
    (a, b) => (b.n > a.n ? b : a)
  )
  return best.n > 0 ? best.d : ','
}

/**
 * Parse a whole CSV DOCUMENT into raw cell rows, or `undefined` when it is
 * malformed beyond recovery (an unterminated quote is the only case
 * `csv-parse` still refuses under `relax_quotes`).
 *
 * Document-level parsing is the point: a quoted field may contain the record
 * separator itself, so splitting on newlines BEFORE parsing — as the previous
 * hand-rolled codec did — tears a multi-line notes column into malformed rows.
 *
 * `trim: true` implements RFC 4180 §2.5 as the spec intends: whitespace is
 * trimmed around UNQUOTED fields only, leaving quoted content verbatim, so
 * `"  007  "` survives intact while `  008  ` is still tidied to `008`.
 */
export const parseCsvDocument = (
  text: string,
  delimiter: string
): ReadonlyArray<ReadonlyArray<string>> | undefined => {
  try {
    return parse(text, {
      delimiter,
      bom: true,
      trim: true,
      skip_empty_lines: true,
      relax_column_count: true,
      relax_quotes: true,
    }) as ReadonlyArray<ReadonlyArray<string>>
  } catch {
    return undefined
  }
}
