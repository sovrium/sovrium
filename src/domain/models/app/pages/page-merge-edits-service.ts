/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The page merge, one matched node at a time: what a drawn node changed on the
 * page node it was matched to, which of those changes the import may write,
 * and how to write them.
 *
 * Every property is compared with the BASELINE — the same tool parser's
 * reading of an unedited export of the config — and only a property that reads
 * differently is an edit at all. An edit is then sorted by what the config
 * says about the node (its node map entry), never by what the drawing says:
 *
 * - a template placement keeps everything but its own `$variable` values, and
 *   a drawn value that is exactly one of its text inputs is that variable;
 * - an island's internals are not read, and a changed one is listed as ignored;
 * - bound text is refused; translated text is written to the default
 *   language's entry for its key, the page keeping the key;
 * - text drawn on a node the config keeps no text on is listed as not read;
 * - a layout value off the token scale is reported with its nearest step;
 * - literal text, a variant, a size and a layout on the scale are written.
 */

import { digestChanges, fillsPlaceholders } from './page-merge-digest-service'
import {
  editedLength,
  resolveLayoutValue,
  utilityOf,
  withLayoutUtility,
  type LayoutProperty,
  type SpacingSteps,
} from './page-merge-layout-service'
import { paintFindings, type PaintTokens } from './page-merge-paint-service'
import { insideVariableEdits } from './page-merge-placement-service'
import { ruleFindings, type RuleReferences } from './page-merge-rules-service'
import {
  translationOutcome,
  type TranslationScope,
  type TranslationWrite,
} from './page-merge-translation-service'
import type { DrawnLayout, DrawnNode } from './page-drawing'
import type { PageDesignTreeNode } from '@/domain/models/api/admin/design-system/page-design-tree'
import type { PageImportReport } from '@/domain/models/api/admin/design-system/page-import-report'
import type { PageNodeMap } from '@/domain/models/api/admin/design-system/page-node-map'

type Node = Readonly<Record<string, unknown>>

/** The report of one page. */
export type PageImportPageReport = PageImportReport['pages'][number]

/** The kit vocabulary: every type a drawing may add, and those whose text is `content`. */
export interface KitVocabulary {
  readonly types: ReadonlySet<string>
  readonly contentTypes: ReadonlySet<string>
}

/** One node map entry. */
export type MergeMapEntry = PageNodeMap['pages'][number]['nodes'][number]

/** A page node of the current config, as the tree and the map describe it. */
export interface CurrentNode {
  readonly id: string
  readonly key?: string | undefined
  readonly type: string
  readonly tree: PageDesignTreeNode
  readonly entry: MergeMapEntry | undefined
  /** The parent's id, or `''` at the top of the page. */
  readonly parent: string
  /** The index among the parent's tree children. */
  readonly index: number
  /** The document order. */
  readonly order: number
}

/** Every finding the report lists for one page, but structure, and the translations to write. */
export interface Findings {
  readonly changes: PageImportPageReport['changes']
  readonly offScale: PageImportPageReport['offScale']
  readonly refused: PageImportPageReport['refused']
  readonly translations: PageImportPageReport['translations']
  readonly ignored: PageImportPageReport['ignored']
  /** The default-language entries the translated edits write. */
  readonly writes: readonly TranslationWrite[]
}

export const NO_FINDINGS: Findings = {
  changes: [],
  offScale: [],
  refused: [],
  translations: [],
  ignored: [],
  writes: [],
}

export const joinFindings = (a: Findings, b: Findings): Findings => ({
  changes: [...a.changes, ...b.changes],
  offScale: [...a.offScale, ...b.offScale],
  refused: [...a.refused, ...b.refused],
  translations: [...a.translations, ...b.translations],
  ignored: [...a.ignored, ...b.ignored],
  writes: [...a.writes, ...b.writes],
})

/** What a node is read against: the spacing scale, the kit, the languages, the templates. */
export interface EditScale {
  readonly spacing: SpacingSteps
  readonly kit: KitVocabulary
  readonly languages?: TranslationScope | undefined
  /** Each template's definition, by name. */
  readonly templates?: ReadonlyMap<string, Node> | undefined
  /** Whether a sample value may stand where the export drew a placeholder (`DrawnPage`). */
  readonly samplesDrawn?: boolean | undefined
  /** The app's colour and type tokens, which a drawn paint is read against. */
  readonly paint?: PaintTokens | undefined
  /** What the config declares that a rule a drawing carries may name. */
  readonly references?: RuleReferences | undefined
  /** The table the page reads, which a visibility rule's field is read against. */
  readonly pageTable?: string | undefined
}

/** What reading one drawn node against its page node found, and how to write it. */
export interface NodeEdits {
  readonly findings: Findings
  readonly apply: (node: Node) => Node
}

const identity = (node: Node): Node => node

const NO_EDITS: NodeEdits = { findings: NO_FINDINGS, apply: identity }

const compose =
  (first: (node: Node) => Node, second: (node: Node) => Node) =>
  (node: Node): Node =>
    second(first(node))

const joinEdits = (edits: readonly NodeEdits[]): NodeEdits =>
  edits.reduce<NodeEdits>(
    (acc, edit) => ({
      findings: joinFindings(acc.findings, edit.findings),
      apply: compose(acc.apply, edit.apply),
    }),
    NO_EDITS
  )

const LAYOUT_PROPERTIES: readonly LayoutProperty[] = [
  'direction',
  'gap',
  'align',
  'justify',
  'padding',
  'width',
]

const sameJson = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)

/** The text property a node's own text sits on: `content`, or its lone string child. */
const textPropertyOf = (node: Node): 'content' | 'children.0' | undefined => {
  if (typeof node['content'] === 'string') return 'content'
  const { children } = node
  return Array.isArray(children) && children.length === 1 && typeof children[0] === 'string'
    ? 'children.0'
    : undefined
}

/** A node's own text, wherever the config keeps it. */
export const textOf = (node: Node): string | undefined => {
  const property = textPropertyOf(node)
  if (property === 'content') return node['content'] as string
  return property === undefined ? undefined : (node['children'] as readonly string[])[0]
}

/**
 * A node with its own text set where the config keeps it, else where its type
 * keeps it: `content` for a type that has one, a lone string child otherwise.
 */
export const withText = (node: Node, text: string, kit: KitVocabulary): Node => {
  const property = textPropertyOf(node)
  if (property === 'children.0') return { ...node, children: [text] }
  if (property === 'content' || kit.contentTypes.has(String(node['type']))) {
    return { ...node, content: text }
  }
  return { ...node, children: [text] }
}

/** A layout value off the scale, or one the vocabulary has no class for. */
const offScaleOf = (
  id: string,
  label: string,
  value: string,
  nearestToken: string | undefined
): PageImportPageReport['offScale'][number] => ({
  node: id,
  property: label,
  value,
  ...(nearestToken === undefined ? {} : { nearestToken }),
})

/** The three readings of one board's layout of a node. */
interface Boards {
  readonly drawn: DrawnLayout | undefined
  readonly baseline: DrawnLayout | undefined
  readonly current: DrawnLayout | undefined
}

/** Where one layout value sits: its node, its board (`undefined` is the base), its property. */
interface LayoutSite {
  readonly id: string
  readonly property: LayoutProperty
  readonly breakpoint: string | undefined
}

const labelOf = ({ property, breakpoint }: LayoutSite): string =>
  breakpoint === undefined ? `layout.${property}` : `responsive.${breakpoint}.${property}`

/** A drawn layout value off the scale, or one the vocabulary has no class for. */
const offScaleEdit = (site: LayoutSite, value: string, nearest: string | undefined): NodeEdits => ({
  findings: { ...NO_FINDINGS, offScale: [offScaleOf(site.id, labelOf(site), value, nearest)] },
  apply: identity,
})

/** One layout property of one board: written on the scale, reported off it. */
const layoutPropertyEdits = (
  site: LayoutSite,
  boards: Boards,
  spacing: SpacingSteps
): NodeEdits => {
  const drawn = boards.drawn?.[site.property]
  const unedited = boards.baseline?.[site.property]
  if (drawn === undefined || sameJson(drawn, unedited)) return NO_EDITS
  const value = editedLength(drawn, unedited)
  const resolved = resolveLayoutValue(site.property, value, spacing)
  const utility = utilityOf(site.property, resolved)
  if (resolved.kind === 'off') return offScaleEdit(site, value.value, resolved.nearestToken)
  if (utility === undefined) return offScaleEdit(site, value.value, undefined)
  return writtenLayoutEdit(site, boards.current?.[site.property], resolved.value, utility)
}

/** A layout value on the scale, written as its utility unless the config already paints it. */
const writtenLayoutEdit = (
  site: LayoutSite,
  before: DrawnLayout[LayoutProperty],
  after: string,
  utility: string
): NodeEdits => {
  if (before?.value === after) return NO_EDITS
  const change = {
    node: site.id,
    property: labelOf(site),
    ...(before === undefined ? {} : { before: before.value }),
    after,
  }
  return {
    findings: { ...NO_FINDINGS, changes: [change] },
    apply: (node) => withLayoutUtility(node, site.property, utility, site.breakpoint),
  }
}

/** A node's paint: what it was drawn with that an unedited export does not draw. */
const paintEdits = (
  { current, drawn, baseline, config }: MatchedSubject,
  scale: EditScale
): NodeEdits => {
  const found = paintFindings(
    { node: current.id, config, drawn: drawn.paint, baseline: baseline.paint },
    scale.paint
  )
  return {
    findings: { ...NO_FINDINGS, changes: found.changes, offScale: found.offScale },
    apply: found.apply,
  }
}

/** One board's layout of one node. */
const layoutEdits = (
  id: string,
  boards: Boards,
  spacing: SpacingSteps,
  breakpoint: string | undefined
): NodeEdits =>
  joinEdits(
    LAYOUT_PROPERTIES.map((property) =>
      layoutPropertyEdits({ id, property, breakpoint }, boards, spacing)
    )
  )

/** One matched node read four ways: its page node, the drawing, the baseline, the config. */
export interface MatchedSubject {
  readonly current: CurrentNode
  readonly drawn: DrawnNode
  readonly baseline: DrawnNode
  readonly config: Node
}

/** The variants a badge's own `variant` takes; any other drawn variant is its tone. */
const BADGE_VARIANTS: ReadonlySet<string> = new Set(['status', 'contrast'])

/**
 * The config property a drawn variant is written to. A tool draws one kit
 * variant, which on a badge is its tone, `badgeVariant`, unless it is one of
 * the badge's own variants.
 */
export const variantPropertyOf = (type: string | undefined, value: string): string =>
  type === 'badge' && !BADGE_VARIANTS.has(value) ? 'badgeVariant' : 'variant'

/** A node's variant and size, as drawn. */
const enumEdits = ({ current, drawn, baseline, config }: MatchedSubject): NodeEdits =>
  joinEdits(
    (['size', 'variant'] as const).map((drawnProperty) => {
      const value = drawn[drawnProperty]
      const property =
        drawnProperty === 'variant' && value !== undefined
          ? variantPropertyOf(current.type, value)
          : drawnProperty
      const before = config[property]
      if (value === undefined || value === baseline[drawnProperty] || value === before) {
        return NO_EDITS
      }
      const change = {
        node: current.id,
        property,
        ...(typeof before === 'string' ? { before } : {}),
        after: value,
      }
      return {
        findings: { ...NO_FINDINGS, changes: [change] },
        apply: (node: Node) => ({ ...node, [property]: value }),
      }
    })
  )

/** A literal text edit, written where the config keeps the text. */
const literalTextEdit = (subject: MatchedSubject, text: string, kit: KitVocabulary): NodeEdits => {
  const before = textOf(subject.config)
  if (before === text) return NO_EDITS
  const change = {
    node: subject.current.id,
    property: 'content',
    ...(before === undefined ? {} : { before }),
    after: text,
  }
  return {
    findings: { ...NO_FINDINGS, changes: [change] },
    apply: (node) => withText(node, text, kit),
  }
}

/**
 * A changed translated text: the page keeps its key, and the text goes to the
 * default language's entry for it, every other language reported as needing
 * translation.
 */
const translationEdit = (
  subject: MatchedSubject,
  edit: { readonly key: string; readonly text: string },
  languages: TranslationScope | undefined
): NodeEdits => {
  const outcome = translationOutcome(
    { key: edit.key, configText: textOf(subject.config), text: edit.text },
    languages
  )
  const report = {
    node: subject.current.id,
    key: edit.key,
    before: subject.baseline.content ?? '',
    after: edit.text,
    ...(outcome.written === undefined ? {} : { written: outcome.written }),
    ...(outcome.needsTranslation === undefined
      ? {}
      : { needsTranslation: outcome.needsTranslation }),
    ...(outcome.reason === undefined ? {} : { reason: outcome.reason }),
  }
  return {
    findings: {
      ...NO_FINDINGS,
      translations: [report],
      writes: outcome.write === undefined ? [] : [outcome.write],
    },
    apply: identity,
  }
}

/** Drawn text on a node the config keeps no text on: listed as not read, never written. */
const unreadTextEdit = (subject: MatchedSubject): NodeEdits => ({
  findings: {
    ...NO_FINDINGS,
    ignored: [
      {
        node: subject.current.id,
        reason:
          'The config keeps no text on this node, so the text drawn in it was not read; add a text node to carry it.',
      },
    ],
  },
  apply: identity,
})

/** A changed bound text: refused, the binding kept. */
const bindingEdit = (subject: MatchedSubject, expression: string): NodeEdits => ({
  findings: {
    ...NO_FINDINGS,
    refused: [
      {
        node: subject.current.id,
        code: 'BINDING_EDIT',
        reason: `This text is filled by ${expression}; change the binding in the config, not its drawn text.`,
      },
    ],
  },
  apply: identity,
})

/** What the config says of a node's text: where it keeps it, and its translation and binding. */
const textSourcesOf = (subject: MatchedSubject) => {
  const kept = textPropertyOf(subject.config)
  const property = kept ?? 'content'
  const { entry } = subject.current
  return {
    kept,
    translation: entry?.translations?.find((candidate) => candidate.property === property),
    binding: entry?.bindings?.find((candidate) => candidate.property === property),
  }
}

/** Whether a bound or translated text shows a sample where the export drew a placeholder. */
const drawsSample = (
  read: { readonly sourced: boolean; readonly unedited: string; readonly text: string },
  scale: EditScale
): boolean =>
  read.sourced && scale.samplesDrawn === true && fillsPlaceholders(read.unedited, read.text)

/**
 * Drawn text on a node the config keeps none on: text the component draws
 * itself is not the page's, and on a node that draws none but a text node,
 * new text has nowhere to go.
 */
const untextedEdits = (subject: MatchedSubject, text: string, scale: EditScale): NodeEdits => {
  if (subject.baseline.content !== undefined) return NO_EDITS
  return scale.kit.contentTypes.has(subject.current.type)
    ? literalTextEdit(subject, text, scale.kit)
    : unreadTextEdit(subject)
}

/**
 * A node's own text: written when literal, refused when bound, written to the
 * default language when translated, and not read on a node keeping none. On a
 * drawing that may show samples, a sample in a bound value's place is no edit.
 */
const textEdits = (subject: MatchedSubject, scale: EditScale): NodeEdits => {
  const text = subject.drawn.content
  const unedited = subject.baseline.content ?? ''
  // A literal's edge space is kept once edited, but a board re-indented around it is no edit.
  if (text === undefined || text.trim() === subject.baseline.content?.trim()) return NO_EDITS
  const { kept, translation, binding } = textSourcesOf(subject)
  if (drawsSample({ sourced: (translation ?? binding) !== undefined, unedited, text }, scale)) {
    return NO_EDITS
  }
  if (translation !== undefined) {
    return translationEdit(subject, { key: translation.key, text }, scale.languages)
  }
  if (binding !== undefined) return bindingEdit(subject, binding.expression)
  return kept === undefined
    ? untextedEdits(subject, text, scale)
    : literalTextEdit(subject, text, scale.kit)
}

/** One placement variable set to a drawn value, unless the config already holds it. */
const variableEdit = (subject: MatchedSubject, name: string, value: string): NodeEdits => {
  const own = (subject.config['vars'] ?? {}) as Readonly<Record<string, unknown>>
  if (String(own[name]) === value) return NO_EDITS
  const change = {
    node: subject.current.id,
    property: `vars.${name}`,
    ...(own[name] === undefined ? {} : { before: String(own[name]) }),
    after: value,
  }
  return {
    findings: { ...NO_FINDINGS, changes: [change] },
    apply: (node: Node) => ({
      ...node,
      vars: { ...((node['vars'] as Node | undefined) ?? {}), [name]: value },
    }),
  }
}

/** The variables a tool draws as the placement's own properties, as changed. */
const drawnVariables = ({ drawn, baseline }: MatchedSubject): ReadonlyMap<string, string> =>
  new Map(
    Object.entries(drawn.vars ?? {})
      .filter(([name, value]) => value !== baseline.vars?.[name])
      .toSorted(([a], [b]) => a.localeCompare(b))
  )

/**
 * A template placement's own variables, the one thing inside it a drawing may
 * change: those the tool draws as the placement's properties, then those an
 * edit inside it rewrote as exactly one text input.
 */
const variableEdits = (
  subject: MatchedSubject,
  inside: readonly { readonly name: string; readonly after: string }[]
): NodeEdits => {
  const drawn = drawnVariables(subject)
  const fromInside = inside.filter((edit) => !drawn.has(edit.name))
  return joinEdits([
    ...[...drawn].map(([name, value]) => variableEdit(subject, name, value)),
    ...fromInside.map((edit) => variableEdit(subject, edit.name, edit.after)),
  ])
}

/** Whether anything a placement draws, but its own variables and its inside, reads differently. */
const placementEdited = ({ drawn, baseline }: MatchedSubject): boolean =>
  !sameJson(
    [drawn.content, drawn.variant, drawn.size, drawn.layout],
    [baseline.content, baseline.variant, baseline.size, baseline.layout]
  )

/** The placement's values given as a list or an object: read-only, they have no one drawn text. */
const structuredInputsOf = (placement: Node): readonly string[] =>
  Object.entries((placement['vars'] ?? {}) as Readonly<Record<string, unknown>>)
    .filter(([, value]) => typeof value === 'object' && value !== null)
    .map(([name]) => name)
    .toSorted()

/** Why an edit inside a placement is refused, naming any structured input it draws from. */
const placementRefusalReason = (subject: MatchedSubject): string => {
  const provenance = subject.current.entry?.provenance
  const source = `the ${provenance?.kind ?? 'template'} "${provenance?.name ?? ''}"`
  const structured = structuredInputsOf(subject.config)
  return structured.length === 0
    ? `This node is drawn from ${source}, which every page placing it shares; change it there.`
    : `This node is drawn from ${source} and from the structured value of its input ${structured.join(', ')}, which a drawing cannot change; change the template, or that value in the config.`
}

/** The edits a template placement carries: its own variables, or a refusal. */
const placementEdits = (subject: MatchedSubject, templates: EditScale['templates']): NodeEdits => {
  const refusal = {
    node: subject.current.id,
    code: 'TEMPLATE_EDIT_OUT_OF_SCOPE' as const,
    reason: placementRefusalReason(subject),
  }
  const provenance = subject.current.entry?.provenance
  const template = provenance?.kind === 'template' ? templates?.get(provenance.name) : undefined
  const inside = insideVariableEdits(
    { baseline: subject.baseline.inside, drawn: subject.drawn.inside },
    subject.config,
    template
  )
  return joinEdits([
    placementEdited(subject) || inside === undefined
      ? { findings: { ...NO_FINDINGS, refused: [refusal] }, apply: identity }
      : NO_EDITS,
    variableEdits(subject, inside ?? []),
  ])
}

/** The baseline of a page node the baseline drawing lacks: its own tree node. */
export const treeAsDrawn = (tree: PageDesignTreeNode): DrawnNode => ({
  id: tree.id,
  type: tree.type,
  variant: tree.variant,
  size: tree.size,
  layout: tree.layout,
  responsive: tree.responsive,
  content: tree.content,
  children: [],
})

/** Whether an island draws inside what an unedited export does, prototype layer set aside. */
const sameInside = ({ drawn, baseline }: MatchedSubject): boolean =>
  digestChanges({ baseline: baseline.inside, drawn: drawn.inside })?.length === 0

/** An island's edit: its internals are listed as not read, never written. */
const islandEdits = (subject: MatchedSubject): NodeEdits => {
  const { current, drawn, baseline } = subject
  return sameInside(subject) && drawn.content === baseline.content
    ? NO_EDITS
    : {
        findings: {
          ...NO_FINDINGS,
          ignored: [
            { node: current.id, reason: "An island's internals are never read; only its box is." },
          ],
        },
        apply: identity,
      }
}

/**
 * Every edit one matched drawn node carries.
 *
 * @param subject - the page node, the drawn node, its baseline and its config entry.
 * @param scale - the declared spacing steps and the kit vocabulary.
 */
export const nodeEdits = (subject: MatchedSubject, scale: EditScale): NodeEdits => {
  const { current, drawn, baseline } = subject
  if (current.entry?.provenance !== undefined) return placementEdits(subject, scale.templates)
  const island = current.entry?.island !== undefined || current.tree.locked === 'island'
  const rules = ruleFindings(
    { node: current.id, entry: current.entry, drawn: drawn.rules, baseline: baseline.rules },
    { references: scale.references, pageTable: scale.pageTable }
  )
  const ruled: NodeEdits = {
    findings: {
      ...NO_FINDINGS,
      changes: rules.changes,
      refused: rules.refused,
      ignored: rules.ignored,
    },
    apply: rules.apply,
  }
  // A rebound node draws a sample of its new binding, which is no copy.
  const text = island ? islandEdits(subject) : rules.rebound ? NO_EDITS : textEdits(subject, scale)
  const breakpoints = [
    ...new Set([...Object.keys(drawn.responsive ?? {}), ...Object.keys(baseline.responsive ?? {})]),
  ].toSorted()
  return joinEdits([
    text,
    ruled,
    enumEdits(subject),
    paintEdits(subject, scale),
    layoutEdits(
      current.id,
      { drawn: drawn.layout, baseline: baseline.layout, current: current.tree.layout },
      scale.spacing,
      undefined
    ),
    ...breakpoints.map((breakpoint) =>
      layoutEdits(
        current.id,
        {
          drawn: drawn.responsive?.[breakpoint],
          baseline: baseline.responsive?.[breakpoint],
          current: current.tree.responsive?.[breakpoint],
        },
        scale.spacing,
        breakpoint
      )
    ),
  ])
}

/**
 * The layout of a node a drawing ADDED, as utility classes, and every value
 * off the scale it was drawn with.
 */
export const addedLayout = (id: string, drawn: DrawnNode, spacing: SpacingSteps): NodeEdits => {
  const boards: readonly (readonly [string | undefined, DrawnLayout | undefined])[] = [
    [undefined, drawn.layout],
    ...Object.entries(drawn.responsive ?? {}).toSorted(([a], [b]) => a.localeCompare(b)),
  ]
  const edits = joinEdits(
    boards.map(([breakpoint, layout]) =>
      layoutEdits(
        id,
        { drawn: layout, baseline: undefined, current: undefined },
        spacing,
        breakpoint
      )
    )
  )
  // A new node's layout is part of the addition the report names, not a change.
  return { findings: { ...edits.findings, changes: [] }, apply: edits.apply }
}
