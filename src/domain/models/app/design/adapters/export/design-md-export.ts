/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { DESIGN_MD_SECTIONS } from '@/domain/models/api/admin/design-system/adapter-design-md'
import {
  colorsLines,
  componentsLines,
  dosAndDontsLines,
  elevationLines,
  layoutLines,
  overviewLines,
  shapesLines,
  typographyLines,
} from './design-md-body-export'
import {
  designMdComponents,
  designMdTokenGroups,
  type DesignMdExportInput,
} from './design-md-values-export'

/**
 * A DESIGN.md: the file design agents read to stay on an app's design system.
 *
 * YAML front matter holds the tokens (contract: `adapter-design-md.ts`), then
 * the eight sections in the format's order. Each section closes with a
 * narrative block, empty when generated: what a person writes inside one is
 * carried into the next export by {@link carryNarrativeSlots}, and everything
 * outside is rewritten.
 *
 * ─── DETERMINISTIC ─────────────────────────────────────────────────────────
 *
 * No clock, no engine version and no path: the same config writes the same
 * bytes, so a committed DESIGN.md only changes when the design does. The
 * bundle's `adapters/design-md/DESIGN.md` is this text too.
 *
 * ─── HAND-SERIALISED YAML ──────────────────────────────────────────────────
 *
 * The domain reaches no YAML library, and the front matter needs none: every
 * string is double-quoted with its quotes and backslashes escaped, every
 * number is bare, and a key is quoted only when YAML would read it otherwise.
 */

/** The first line under the front matter, which marks a DESIGN.md this command wrote. */
export const DESIGN_MD_GENERATED_MARKER =
  '<!-- sovrium:generated design-md. Regenerate with sovrium design-system --format design-md --output DESIGN.md. Write by hand only inside the sovrium:narrative blocks. -->'

/** The prefix a generated DESIGN.md is recognised by. */
export const DESIGN_MD_GENERATED_PREFIX = '<!-- sovrium:generated design-md'

/** The line that opens a section's narrative block. */
export const narrativeBeginLine = (section: string): string =>
  `<!-- sovrium:narrative:begin section="${section}" -->`

/** The line that closes every narrative block. */
export const NARRATIVE_END_LINE = '<!-- sovrium:narrative:end -->'

/** A YAML double-quoted string. */
export const yamlString = (value: string): string =>
  `"${value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t')}"`

/** The plain words YAML reads as something other than a string key. */
const YAML_RESERVED = /^(?:true|false|null|yes|no|on|off|y|n|~)$/i

/** A YAML key: bare when YAML reads it back as the same string, quoted otherwise. */
const yamlKey = (key: string): string =>
  /^[A-Za-z_][A-Za-z0-9_-]*$/.test(key) && !YAML_RESERVED.test(key) ? key : yamlString(key)

/** A scalar value: a number bare, a string double-quoted. */
const yamlScalar = (value: string | number): string =>
  typeof value === 'number' ? String(value) : yamlString(value)

/** A mapping of scalars, indented: `{}` when empty. */
const yamlMapping = (
  key: string,
  entries: readonly (readonly [string, string | number])[],
  indent: string
): readonly string[] =>
  entries.length === 0
    ? [`${indent}${yamlKey(key)}: {}`]
    : [
        `${indent}${yamlKey(key)}:`,
        ...entries.map(([name, value]) => `${indent}  ${yamlKey(name)}: ${yamlScalar(value)}`),
      ]

/** A mapping of mappings (typography roles, components). */
const yamlNested = (
  key: string,
  entries: readonly (readonly [string, Readonly<Record<string, string | number | undefined>>])[]
): readonly string[] =>
  entries.length === 0
    ? [`${yamlKey(key)}: {}`]
    : [
        `${yamlKey(key)}:`,
        ...entries.flatMap(([name, value]) =>
          yamlMapping(
            name,
            Object.entries(value).filter(
              (entry): entry is [string, string | number] => entry[1] !== undefined
            ),
            '  '
          )
        ),
      ]

/** The front matter's description: the app's own, else what the system is. */
const descriptionOf = (input: DesignMdExportInput): string =>
  input.description !== undefined && input.description.trim().length > 0
    ? input.description.trim()
    : `The design system of ${input.appName}, exported from its Sovrium config.`

/** The YAML front matter, between its two `---` lines. */
const frontMatter = (input: DesignMdExportInput): string => {
  const groups = designMdTokenGroups(input)
  return [
    '---',
    `name: ${yamlString(input.appName)}`,
    `description: ${yamlString(descriptionOf(input))}`,
    ...yamlMapping('colors', Object.entries(groups.colors as Record<string, string>), ''),
    ...yamlNested(
      'typography',
      Object.entries(groups.typography as Record<string, Record<string, string | number>>)
    ),
    ...yamlMapping('rounded', Object.entries(groups.rounded as Record<string, string>), ''),
    ...yamlMapping('spacing', Object.entries(groups.spacing as Record<string, string>), ''),
    ...yamlNested('components', designMdComponents(groups)),
    '---',
  ].join('\n')
}

/** One section: heading, generated body, then its empty narrative block. */
const section = (id: string, heading: string, body: readonly string[]): string =>
  [`## ${heading}`, '', ...body, '', narrativeBeginLine(id), NARRATIVE_END_LINE].join('\n')

/** The generated body of each section, keyed by the format's section id. */
const sectionBodies = (
  input: DesignMdExportInput
): Readonly<Record<(typeof DESIGN_MD_SECTIONS)[number]['id'], readonly string[]>> => ({
  overview: overviewLines(input),
  colors: colorsLines(input),
  typography: typographyLines(input),
  layout: layoutLines(input),
  elevation: elevationLines(input),
  shapes: shapesLines(input),
  components: componentsLines(
    input,
    designMdComponents(designMdTokenGroups(input)).map(([name]) => name)
  ),
  'dos-and-donts': dosAndDontsLines(),
})

/**
 * The DESIGN.md of an app: front matter, the generated marker, the title and
 * the eight sections, each closed by an empty narrative block.
 */
export const renderDesignMd = (input: DesignMdExportInput): string => {
  const bodies = sectionBodies(input)
  return `${[
    frontMatter(input),
    '',
    DESIGN_MD_GENERATED_MARKER,
    '',
    `# Design System: ${input.appName}`,
    ...DESIGN_MD_SECTIONS.flatMap(({ id, heading }) => ['', section(id, heading, bodies[id])]),
  ].join('\n')}\n`
}

/** The outcome of carrying the narrative blocks of one DESIGN.md into another. */
export type NarrativeCarry =
  | { readonly _tag: 'Carried'; readonly text: string }
  | {
      readonly _tag: 'NarrativeMarkerError'
      /** The section whose block is missing, duplicated or left open. */
      readonly section: string
      readonly problem: 'missing' | 'duplicated' | 'unclosed'
    }

/** Every narrative block of a text: its section id and what is written inside it. */
const NARRATIVE_BLOCK =
  /<!-- sovrium:narrative:begin section="([^"]+)" -->\n([\s\S]*?)<!-- sovrium:narrative:end -->/g

/** The section ids of every narrative opener in a text, closed or not. */
const openedSections = (text: string): readonly string[] =>
  [...text.matchAll(/<!-- sovrium:narrative:begin section="([^"]+)" -->/g)].map(
    (match) => match[1] ?? ''
  )

/** The first marker problem of `previous` against the sections `rendered` has, if any. */
const markerProblem = (
  previous: string,
  blocks: readonly (readonly [string, string])[],
  wanted: readonly string[]
): Extract<NarrativeCarry, { _tag: 'NarrativeMarkerError' }> | undefined => {
  const opened = openedSections(previous)
  const duplicated = opened.find((id, index) => opened.indexOf(id) !== index)
  if (duplicated !== undefined) {
    return { _tag: 'NarrativeMarkerError', section: duplicated, problem: 'duplicated' }
  }
  const unclosed = opened.find((id) => !blocks.some(([closed]) => closed === id))
  if (unclosed !== undefined) {
    return { _tag: 'NarrativeMarkerError', section: unclosed, problem: 'unclosed' }
  }
  const missing = [...wanted, ...opened].find((id) => !opened.includes(id) || !wanted.includes(id))
  return missing === undefined
    ? undefined
    : { _tag: 'NarrativeMarkerError', section: missing, problem: 'missing' }
}

/**
 * Copy what is written inside each narrative block of `previous` into the
 * block of the same section in `rendered`.
 *
 * Refused, rather than guessed, when a block of `previous` is missing,
 * duplicated or left open, or names a section `rendered` does not have: any of
 * those would drop text someone wrote.
 */
export const carryNarrativeSlots = (previous: string, rendered: string): NarrativeCarry => {
  const blocks = [...previous.matchAll(NARRATIVE_BLOCK)].map(
    (match) => [match[1] ?? '', match[2] ?? ''] as const
  )
  const problem = markerProblem(previous, blocks, openedSections(rendered))
  if (problem !== undefined) return problem
  const written = new Map(blocks)
  return {
    _tag: 'Carried',
    text: rendered.replace(NARRATIVE_BLOCK, (_block, id: string) =>
      [narrativeBeginLine(id), `${written.get(id) ?? ''}${NARRATIVE_END_LINE}`].join('\n')
    ),
  }
}
