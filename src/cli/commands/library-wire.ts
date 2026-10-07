/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The text half of `sovrium library add`: the fragment bytes, and the ONE line
 * a YAML root gains.
 *
 * Pure string functions, no I/O, so every wiring decision is testable without a
 * filesystem.
 *
 * ─── THE ROOT IS NEVER RE-SERIALISED ────────────────────────────────────────
 *
 * An operator's `app.yaml` carries comments, ordering and quoting that a parse
 * and a stringify would all lose. So the root is edited as TEXT: exactly one
 * `- $ref: ./library/<kind>/<name>.yaml` line is inserted at the end of the
 * target key's block sequence, or the key is appended at the end of the file
 * when it is absent. Every other byte is left where it was.
 *
 * ─── WHEN IT DOES NOT GUESS ─────────────────────────────────────────────────
 *
 * A target key whose value is written on its own line — a non-empty flow
 * sequence (`components: [a, b]`), a `$ref` to another file, an anchor or an
 * alias — is not a block sequence a line can be appended to. Appending there would corrupt the
 * document, so the plan says `unwirable` and the caller prints the line for the
 * operator to place by hand. The same answer is given for anything this reader
 * cannot place with certainty: a key declared twice, CRLF line endings, or a
 * root written as one flow mapping.
 *
 * The one inline value it does rewrite is the EMPTY flow sequence: `key: []`
 * holds nothing to lose, so the `[]` is dropped (a trailing comment is kept) and
 * the item goes on the line below, exactly as under a bare `key:`.
 */

/** The outcome of planning one insertion into a YAML root. */
export type YamlWirePlan =
  | { readonly kind: 'insert'; readonly text: string; readonly line: string }
  | { readonly kind: 'already-wired' }
  | { readonly kind: 'unwirable'; readonly reason: string }

/** `connection/qonto` → the manual address `library/connection-qonto`. */
export const libraryArticleAddress = (id: string): string => `library/${id.replace('/', '-')}`

/** The provenance line every fragment opens with. */
export const provenanceHeader = (id: string, version: string): string =>
  `sovrium-library: ${id}@${version}`

/**
 * A YAML fragment: the provenance comment, then the item, block-style.
 *
 * `Bun.YAML.stringify` leaves a trailing space after every key whose value is a
 * nested block (`props: `); those are trimmed so the file an operator opens is
 * clean. The trim cannot change meaning — a trailing space after a colon is
 * never part of a value.
 */
export const renderYamlFragment = (header: string, value: unknown): string => {
  const body = Bun.YAML.stringify(value, null, 2)
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
  return `# ${header}\n${body.endsWith('\n') ? body : `${body}\n`}`
}

/** A TypeScript fragment: the provenance comment, then a default export. */
export const renderTsFragment = (header: string, binding: string, value: unknown): string =>
  `// ${header}\n\nconst ${binding} = ${JSON.stringify(value, null, 2)}\n\nexport default ${binding}\n`

/** `hero-home` → `heroHome`: the binding a TypeScript fragment exports. */
export const bindingName = (name: string): string =>
  name.replace(/-([a-z0-9])/g, (_match, next: string) => next.toUpperCase())

/** The line a YAML root gains, at the given indentation. */
export const refLine = (indent: number, refPath: string): string =>
  `${' '.repeat(indent)}- $ref: ${refPath}`

const indentOf = (line: string): number => line.length - line.trimStart().length

const isBlankOrComment = (line: string): boolean => {
  const trimmed = line.trim()
  return trimmed === '' || trimmed.startsWith('#')
}

/** The top-level line declaring `key`, when there is exactly one. */
const findKeyLine = (
  lines: readonly string[],
  key: string
): { readonly index: number; readonly count: number } => {
  const pattern = new RegExp(`^${key}\\s*:`)
  const matches = lines.flatMap((line, index) => (pattern.test(line) ? [index] : []))
  return { index: matches[0] ?? -1, count: matches.length }
}

/** What follows the colon on the key's line, comments removed. */
const inlineValue = (keyLine: string): string =>
  keyLine
    .slice(keyLine.indexOf(':') + 1)
    .replace(/\s#.*$/, '')
    .trim()

/** `key: []  # note` → `key:  # note`: the empty flow sequence removed, the comment kept. */
const dropEmptyFlowSequence = (keyLine: string): string =>
  keyLine.replace(/:\s*\[\s*\]/, ':').trimEnd()

/** Index of the first line after `from` that is neither blank nor a comment. */
const nextContentIndex = (lines: readonly string[], from: number): number =>
  lines.findIndex((line, index) => index > from && !isBlankOrComment(line))

/**
 * The last line belonging to the block sequence that starts after `keyIndex`
 * with items at `itemIndent`.
 */
const lastLineOfSequence = (
  lines: readonly string[],
  keyIndex: number,
  itemIndent: number
): number => {
  const end = lines.findIndex((line, index) => {
    if (index <= keyIndex || isBlankOrComment(line)) return false
    const indent = indentOf(line)
    return indent < itemIndent || (indent === itemIndent && !line.trimStart().startsWith('-'))
  })
  const stop = end === -1 ? lines.length : end
  return lines.reduce(
    (last, line, index) =>
      index > keyIndex && index < stop && !isBlankOrComment(line) ? index : last,
    keyIndex
  )
}

/** Append `key:` and its one item at the end of the document. */
const appendKey = (rootText: string, key: string, line: string): YamlWirePlan => {
  const base = rootText.endsWith('\n') ? rootText : `${rootText}\n`
  const separator = base.endsWith('\n\n') || base === '\n' ? '' : '\n'
  return { kind: 'insert', text: `${base}${separator}${key}:\n${line}\n`, line }
}

const insertAt = (lines: readonly string[], after: number, line: string): YamlWirePlan => ({
  kind: 'insert',
  text: [...lines.slice(0, after + 1), line, ...lines.slice(after + 1)].join('\n'),
  line,
})

/** Why the document as a whole cannot be edited line-wise, if it cannot. */
const documentRefusal = (rootText: string, lines: readonly string[]): string | undefined => {
  if (rootText.includes('\r')) return 'the file uses CRLF line endings'
  const first = lines.find((line) => !isBlankOrComment(line))
  if (first !== undefined && /^[{[]/.test(first.trim())) return 'the file is one flow collection'
  return undefined
}

/** Place the line under a key declared on its own line, with nothing inline. */
const planUnderKey = (lines: readonly string[], index: number, refPath: string): YamlWirePlan => {
  const first = nextContentIndex(lines, index)
  const firstLine = first === -1 ? undefined : lines[first]
  // `key:` with nothing indented under it is an empty value: the item goes
  // right below — unless the sequence is written indentless, at column 0.
  if (firstLine === undefined || indentOf(firstLine) === 0)
    return firstLine?.startsWith('-') === true
      ? insertAt(lines, lastLineOfSequence(lines, index, 0), refLine(0, refPath))
      : insertAt(lines, index, refLine(2, refPath))
  if (!firstLine.trimStart().startsWith('-'))
    return { kind: 'unwirable', reason: 'it holds a mapping, not a sequence' }
  const itemIndent = indentOf(firstLine)
  return insertAt(lines, lastLineOfSequence(lines, index, itemIndent), refLine(itemIndent, refPath))
}

/**
 * Plan the insertion of one `- $ref:` line under `key`.
 *
 * @param rootText - The root config's bytes, exactly as read.
 * @param key - `components`, `connections` or `automations`.
 * @param refPath - `./library/<kind>/<name>.yaml`, relative to the root.
 */
export const planYamlWire = (rootText: string, key: string, refPath: string): YamlWirePlan => {
  const lines = rootText.split('\n')
  if (lines.some((line) => line.trim() === `- $ref: ${refPath}`)) return { kind: 'already-wired' }

  const refusal = documentRefusal(rootText, lines)
  if (refusal !== undefined) return { kind: 'unwirable', reason: refusal }

  const { index, count } = findKeyLine(lines, key)
  if (count > 1) return { kind: 'unwirable', reason: `\`${key}\` is declared more than once` }
  if (index === -1) return appendKey(rootText, key, refLine(2, refPath))

  const keyLine = lines[index] ?? ''
  const inline = inlineValue(keyLine)
  if (/^\[\s*\]$/.test(inline))
    return insertAt(
      lines.map((line, at) => (at === index ? dropEmptyFlowSequence(line) : line)),
      index,
      refLine(2, refPath)
    )
  return inline === ''
    ? planUnderKey(lines, index, refPath)
    : {
        kind: 'unwirable',
        reason: `\`${key}\` is written as \`${inline}\`, not as a block sequence`,
      }
}
