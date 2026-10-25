/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The `.env.example` document the template renderer edits: sections (a header
 * line naming the section, and what follows it) of text lines and variable
 * groups (the comment lines directly above a run of consecutive `# NAME=`
 * lines). The core reference is parsed into it, each layer of
 * `init-template-env.ts` rewrites it, and it is printed back line for line, so
 * a variable no layer touches keeps the core's exact text; only the section
 * headers are reprinted, in the plain form of {@link headerFor}.
 */

import type { TemplateEnvEntry } from './init-template-manifest'

interface EnvVariable {
  readonly name: string
  readonly line: string
  readonly example: string
  readonly inline: string
}

/** Comment lines directly above a run of consecutive variable lines. */
export interface EnvGroup {
  readonly kind: 'group'
  readonly comment: readonly string[]
  readonly variables: readonly EnvVariable[]
  /** Set on a group this renderer wrote from an entry: the description it carries. */
  readonly generated?: string
}

export type EnvItem = { readonly kind: 'text'; readonly line: string } | EnvGroup

export interface EnvSection {
  readonly title: string
  readonly header: string
  readonly items: readonly EnvItem[]
}

export type EnvDocument = readonly EnvSection[]

const VARIABLE_LINE = /^#?\s?([A-Z][A-Z0-9_]*)=(.*)$/
const HEADER_LINE = /^#\s*──\s+(.+?)\s*─*\s*$/
/**
 * A section header as the rendered file prints it: a plain `# Title` comment
 * under a blank line. No rule characters (terminal-language.md T14), the core
 * reference's own ruled headers included, so the file reads in one style.
 */
const headerFor = (title: string): string => `# ${title}`

const toVariable = (line: string): EnvVariable | undefined => {
  const match = VARIABLE_LINE.exec(line)
  if (!match) return undefined
  const [value = '', ...inline] = (match[2] ?? '').split(/\s+#\s?/)
  return { name: match[1] ?? '', line, example: value.trim(), inline: inline.join(' # ').trim() }
}

/** Add items to the last section (the core's own header lines, before any section, are dropped). */
const appendToLast = (sections: EnvDocument, items: readonly EnvItem[]): EnvDocument => {
  const last = sections.at(-1)
  return last === undefined || items.length === 0
    ? sections
    : [...sections.slice(0, -1), { ...last, items: [...last.items, ...items] }]
}

interface ParseState {
  readonly sections: EnvDocument
  readonly pending: readonly string[]
}

const asText = (lines: readonly string[]): readonly EnvItem[] =>
  lines.map((line) => ({ kind: 'text', line }))

/** A variable line joins the group above it, or opens one under the comment lines just read. */
const parseVariable = (state: ParseState, variable: EnvVariable): ParseState => {
  const section = state.sections.at(-1)
  const last = section?.items.at(-1)
  if (state.pending.length === 0 && last?.kind === 'group' && section !== undefined) {
    const items = [
      ...section.items.slice(0, -1),
      { ...last, variables: [...last.variables, variable] },
    ]
    return { ...state, sections: [...state.sections.slice(0, -1), { ...section, items }] }
  }
  const group: EnvGroup = { kind: 'group', comment: state.pending, variables: [variable] }
  return { sections: appendToLast(state.sections, [group]), pending: [] }
}

const parseLine = (state: ParseState, line: string): ParseState => {
  const header = HEADER_LINE.exec(line)
  if (header) {
    const flushed = appendToLast(state.sections, asText(state.pending))
    return {
      sections: [
        ...flushed,
        { title: header[1] ?? '', header: headerFor(header[1] ?? ''), items: [] },
      ],
      pending: [],
    }
  }
  const variable = toVariable(line)
  if (variable) return parseVariable(state, variable)
  if (line.startsWith('#') && line !== '#') return { ...state, pending: [...state.pending, line] }
  return {
    sections: appendToLast(state.sections, asText([...state.pending, line])),
    pending: [],
  }
}

/** Parse the core text into its sections and its footer. */
export const parseCore = (
  text: string
): { readonly sections: EnvDocument; readonly footer: readonly string[] } => {
  const lines = text.replace(/\n$/, '').split('\n')
  const footerStart = lines.findIndex((line) => line.startsWith('# Full reference'))
  const body = lines.slice(0, footerStart === -1 ? lines.length : footerStart)
  const parsed = body.reduce(parseLine, { sections: [], pending: [] })
  return {
    sections: appendToLast(parsed.sections, asText(parsed.pending)),
    footer: footerStart === -1 ? [] : lines.slice(footerStart),
  }
}

const stripComment = (line: string): string => line.replace(/^# ?/, '')

/** The description a reader takes from a group: its comment, else the variable's inline note. */
const describedAs = (group: EnvGroup, variable: EnvVariable): string =>
  group.comment.length > 0 ? group.comment.map(stripComment).join('\n') : variable.inline

const INLINE_DESCRIPTION_MAX = 60

/** One entry as its own group: a short one-line description inline, a longer one above. */
export const groupFor = (entry: TemplateEnvEntry): EnvGroup => {
  const example = entry.example ?? ''
  const inline =
    !entry.description.includes('\n') && entry.description.length <= INLINE_DESCRIPTION_MAX
  const line =
    inline && entry.description !== ''
      ? `# ${entry.name}=${example}  # ${entry.description}`
      : `# ${entry.name}=${example}`
  const comment =
    inline || entry.description === ''
      ? []
      : entry.description.split('\n').map((text) => (text === '' ? '#' : `# ${text}`))
  return {
    kind: 'group',
    comment,
    variables: [{ name: entry.name, line, example, inline: inline ? entry.description : '' }],
    generated: entry.description,
  }
}

const bareLine = (variable: EnvVariable): EnvVariable => ({
  ...variable,
  line: `# ${variable.name}=${variable.example}`,
  inline: '',
})

/**
 * Merge each run of consecutive written groups sharing one description into a
 * single group, so the description is printed once above the run rather than
 * repeated on every line.
 */
export const mergeRuns = (items: readonly EnvItem[]): readonly EnvItem[] =>
  items.reduce<readonly EnvItem[]>((merged, item) => {
    const previous = merged.at(-1)
    if (
      item.kind !== 'group' ||
      previous?.kind !== 'group' ||
      item.generated === undefined ||
      item.generated === '' ||
      previous.generated !== item.generated
    ) {
      return [...merged, item]
    }
    const comment = item.generated.split('\n').map((text) => (text === '' ? '#' : `# ${text}`))
    const run: EnvGroup = {
      kind: 'group',
      comment,
      variables: [...previous.variables, ...item.variables].map(bareLine),
      generated: item.generated,
    }
    return [...merged.slice(0, -1), run]
  }, [])

interface Found {
  readonly section: number
  readonly index: number
  readonly group: EnvGroup
}

export const findVariable = (sections: EnvDocument, name: string): Found | undefined =>
  sections
    .flatMap((section, at) => section.items.map((item, index) => ({ section: at, index, item })))
    .flatMap(({ section, index, item }) =>
      item.kind === 'group' && item.variables.some((variable) => variable.name === name)
        ? [{ section, index, group: item }]
        : []
    )[0]

const withItems = (
  sections: EnvDocument,
  at: number,
  items: (current: readonly EnvItem[]) => readonly EnvItem[]
): EnvDocument =>
  sections.map((section, index) =>
    index === at ? { ...section, items: items(section.items) } : section
  )

/**
 * Replace one variable, and the description it reads with, by the entry's — in
 * place. Returns `undefined` when no layer has written the variable yet.
 */
export const replaceVariable = (
  sections: EnvDocument,
  entry: TemplateEnvEntry
): EnvDocument | undefined => {
  const found = findVariable(sections, entry.name)
  if (found === undefined) return undefined
  const at = found.group.variables.findIndex((variable) => variable.name === entry.name)
  const current = found.group.variables[at]
  if (
    current !== undefined &&
    current.example === (entry.example ?? '') &&
    describedAs(found.group, current) === entry.description
  ) {
    return sections
  }
  const before = found.group.variables.slice(0, at)
  const after = found.group.variables.slice(at + 1)
  const replacement: readonly EnvItem[] = [
    ...(before.length > 0 ? [{ ...found.group, variables: before }] : []),
    groupFor(entry),
    ...(after.length > 0 ? [{ kind: 'group' as const, comment: [], variables: after }] : []),
  ]
  return withItems(sections, found.section, (items) => [
    ...items.slice(0, found.index),
    ...replacement,
    ...items.slice(found.index + 1),
  ])
}

/** Append groups to the section of that title (before the blank lines closing it), or to a new one. */
export const appendToSection = (
  sections: EnvDocument,
  title: string,
  groups: readonly EnvGroup[]
): EnvDocument => {
  const at = sections.findIndex((section) => section.title === title)
  if (at === -1) {
    return [
      ...sections,
      { title, header: headerFor(title), items: [...groups, { kind: 'text', line: '' }] },
    ]
  }
  return withItems(sections, at, (items) => {
    const trailing = items
      .toReversed()
      .findIndex((item) => item.kind !== 'text' || item.line !== '')
    const cut = trailing === -1 ? 0 : items.length - trailing
    return [...items.slice(0, cut), ...groups, ...items.slice(cut)]
  })
}

export const renderSections = (sections: readonly EnvSection[]): string =>
  sections
    .flatMap((section) =>
      section.items.some((item) => item.kind === 'group')
        ? [
            section.header,
            ...section.items.flatMap((item) =>
              item.kind === 'text'
                ? [item.line]
                : [...item.comment, ...item.variables.map((v) => v.line)]
            ),
          ]
        : []
    )
    .join('\n')
