/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The markdown projection of the design-system document — the one written for a
 * MODEL rather than for a tool.
 *
 * The JSON export is a token document: precise, machine-shaped, and useless as
 * prose. An agent handed only that can pick the right hex and still write
 * off-brand copy, which is the exact gap `design.voice` was added to close. So
 * this projection carries the rules an agent must OBEY — principles, voice,
 * tone per moment, per-token usage — beside the values.
 *
 * ─── llms.txt SHAPE, NOT llms.txt SEMANTICS ─────────────────────────────────
 *
 * llms.txt specifies H2 sections containing FILE LISTS of URL links. This
 * export is not a directory of things to fetch — it is the content itself,
 * written to be pasted into a context window. It therefore takes the llms.txt
 * SHAPE (a single H1, a blockquote summary, flat H2 sections, high density, no
 * chrome) and deliberately not its link semantics.
 *
 * Flat H2s are load-bearing rather than stylistic: depth costs tokens without
 * adding retrievability for a reader that sees the whole file at once.
 *
 * ─── A PROJECTION, NOT A SECOND GENERATOR ───────────────────────────────────
 *
 * Everything here reads the document `buildDesignSystem` returned. Nothing
 * re-reads the app config. That is what makes it impossible for the markdown
 * and the JSON to describe two different design systems.
 */

import { SOVRIUM_EXTENSION_KEY } from '@/domain/models/api/admin/design-system'
import { formatColorValue } from '@/domain/services/design-system/token-values'
import type { DesignSystemDocument } from '@/domain/models/api/admin/design-system'

/** A rendered section: its H2 title and its body lines, or nothing to say. */
interface Section {
  readonly title: string
  readonly lines: readonly string[]
}

/** Pipe is the table's column separator, so an authored one has to be escaped. */
const cell = (text: string | undefined): string => (text ?? '').replace(/\|/g, '\\|')

/** A markdown table with a fixed header. */
const table = (
  headers: readonly string[],
  rows: readonly (readonly string[])[]
): readonly string[] => [
  `| ${headers.join(' | ')} |`,
  `| ${headers.map(() => '---').join(' | ')} |`,
  ...rows.map((row) => `| ${row.map(cell).join(' | ')} |`),
]

/** Drop sections with no rows — an empty H2 is chrome, which this format has none of. */
const renderSections = (sections: readonly Section[]): readonly string[] =>
  sections
    .filter((section) => section.lines.length > 0)
    .flatMap((section) => [`## ${section.title}`, '', ...section.lines, ''])

/** A dimension rendered for a table cell, or an empty cell when it is absent. */
const formatOptionalMeasure = (
  value: { readonly value: number; readonly unit: string } | undefined
): string => (value === undefined ? '' : formatMeasure(value))

/** `{value: 4, unit: 'rem'}` → `4rem`. */
const formatMeasure = (value: { readonly value: number; readonly unit: string }): string =>
  `${value.value}${value.unit}`

/** The colour table, carrying each token's usage rule beside its value. */
const colorSection = (document: Readonly<DesignSystemDocument>): Section => {
  const roles = document.$extensions[SOVRIUM_EXTENSION_KEY].colorRoles ?? {}
  const rows = Object.entries(document.color).map((entry) => [
    entry[0],
    formatColorValue(entry[1].$value),
    entry[1].$description ?? roles[entry[0]]?.usage ?? '',
    roles[entry[0]]?.pairsWith ?? '',
  ])
  return {
    title: 'Colour tokens',
    lines: rows.length === 0 ? [] : table(['Token', 'Value', 'Usage', 'Pairs with'], rows),
  }
}

/** A dimension or duration table. */
const measureSection = (
  title: string,
  tokens: Readonly<
    Record<string, { readonly $value: { readonly value: number; readonly unit: string } }>
  >
): Section => {
  const rows = Object.entries(tokens).map(([name, token]) => [name, formatMeasure(token.$value)])
  return { title, lines: rows.length === 0 ? [] : table(['Token', 'Value'], rows) }
}

/** The font stacks, each rendered in the order a browser would try them. */
const fontSection = (document: Readonly<DesignSystemDocument>): Section => {
  const rows = Object.entries(document.font).map(([name, token]) => [
    name,
    Array.isArray(token.$value) ? token.$value.join(', ') : token.$value,
  ])
  return { title: 'Font families', lines: rows.length === 0 ? [] : table(['Token', 'Stack'], rows) }
}

/** Principles, in the order the author ranked them. */
const principlesSection = (document: Readonly<DesignSystemDocument>): Section => ({
  title: 'Principles',
  lines: (document.$extensions[SOVRIUM_EXTENSION_KEY].principles ?? []).map(
    (principle) => `- ${principle}`
  ),
})

/** Voice: how the app addresses its reader, and what it refuses to say. */
const voiceSection = (document: Readonly<DesignSystemDocument>): Section => {
  const { voice } = document.$extensions[SOVRIUM_EXTENSION_KEY]
  if (!voice) return { title: 'Voice', lines: [] }
  return {
    title: 'Voice',
    lines: [
      ...(voice.pronoun === undefined ? [] : [`- Address the reader as: ${voice.pronoun}`]),
      ...(voice.personality?.length ? [`- Personality: ${voice.personality.join(', ')}`] : []),
      ...(voice.prefer ?? []).map((rule) => `- Prefer: ${rule}`),
      ...(voice.avoid ?? []).map((rule) => `- Avoid: ${rule}`),
    ],
  }
}

/** Tone per moment — the rules that decide how an empty state or an error reads. */
const toneSection = (document: Readonly<DesignSystemDocument>): Section => {
  const tone = document.$extensions[SOVRIUM_EXTENSION_KEY].voice?.tone ?? {}
  const rows = Object.entries(tone).flatMap(([moment, rule]) =>
    rule === undefined ? [] : [[moment, rule]]
  )
  return {
    title: 'Tone by moment',
    lines: rows.length === 0 ? [] : table(['Moment', 'Rule'], rows),
  }
}

/**
 * The type scale, as a ladder read largest-first.
 *
 * A TABLE rather than prose, and ordered rather than sorted: the document's
 * `typography` group is already emitted in ladder order by `buildDesignSystem`,
 * and `Object.entries` preserves it. An alphabetised type scale (`body`,
 * `caption`, `display`, `h1`…) is not a scale — it is a list of sizes with the
 * relationship between them removed, which is the one thing the section exists
 * to show.
 *
 * The `Utility` column is the part an agent acts on. Knowing `h1` is `3rem` is
 * less useful than knowing that writing `text-h1` produces it, with the
 * leading, weight and tracking attached.
 */
const typeScaleSection = (document: Readonly<DesignSystemDocument>): Section => {
  const unmappable = document.$extensions[SOVRIUM_EXTENSION_KEY].unmappable ?? {}

  /**
   * Tracking, from whichever of the two places the document put it.
   *
   * A step whose tracking was declared in `em` has NO `letterSpacing` member in
   * its typography token — DTCG cannot carry the unit — and its raw value sits
   * in `unmappable` instead. Reading only the token would print an empty
   * Tracking cell for a step that is in fact tracked, which is a worse lie than
   * omitting the column: the reader concludes the design has no tracking and
   * writes a heading without it.
   *
   * This stays a pure projection of the document — the fallback reads
   * `$extensions.unmappable`, not the app config — so the markdown still cannot
   * disagree with the JSON.
   */
  const tracking = (
    step: string,
    value: { readonly value: number; readonly unit: string } | undefined
  ): string =>
    value === undefined
      ? (unmappable[`design.typeScale.${step}.letterSpacing`] ?? '')
      : formatMeasure(value)

  const rows = Object.entries(document.typography).map(([step, token]) => [
    step,
    `text-${step}`,
    formatOptionalMeasure(token.$value.fontSize),
    token.$value.lineHeight === undefined ? '' : String(token.$value.lineHeight),
    token.$value.fontWeight === undefined ? '' : String(token.$value.fontWeight),
    tracking(step, token.$value.letterSpacing),
    Array.isArray(token.$value.fontFamily)
      ? token.$value.fontFamily.join(', ')
      : (token.$value.fontFamily ?? ''),
  ])

  return {
    title: 'Type scale',
    lines:
      rows.length === 0
        ? []
        : [
            'Each step emits `--text-{step}` and a matching `text-{step}` utility that carries its leading, weight and tracking.',
            '',
            ...table(['Step', 'Utility', 'Size', 'Leading', 'Weight', 'Tracking', 'Face'], rows),
          ],
  }
}

/**
 * The mark and the rules for placing it.
 *
 * Prose, not a table: five of the six fields are sentences, and a two-column
 * table of one-word keys against paragraph values reads worse than the
 * paragraphs alone. The misuse rules get their own bullets because they are the
 * half a reader is most likely to be looking for.
 */
const logoSection = (document: Readonly<DesignSystemDocument>): Section => {
  const { logo } = document.$extensions[SOVRIUM_EXTENSION_KEY]
  if (!logo) return { title: 'Logo', lines: [] }

  return {
    title: 'Logo',
    lines: [
      `- Mark: \`${logo.src}\` (accessible name: "${logo.alt}")`,
      ...(logo.srcDark === undefined
        ? []
        : [`- Dark mode: \`${logo.srcDark}\` — used when the interface is dark`]),
      ...(logo.clearSpace === undefined ? [] : [`- Clear space: ${logo.clearSpace}`]),
      ...(logo.minWidth === undefined ? [] : [`- Minimum width: ${logo.minWidth}`]),
      ...(logo.misuse ?? []).map((rule) => `- Never: ${rule}`),
    ],
  }
}

/** Imagery and iconography — the register, the photography rules, the icon set. */
const imagerySection = (document: Readonly<DesignSystemDocument>): Section => {
  const { imagery } = document.$extensions[SOVRIUM_EXTENSION_KEY]
  if (!imagery) return { title: 'Imagery', lines: [] }

  return {
    title: 'Imagery',
    lines: [
      ...(imagery.iconSet === undefined
        ? []
        : [
            `- Icons: ${imagery.iconSet} — every icon in the app comes from this set, and no other.`,
          ]),
      ...(imagery.principles ?? []).map((rule) => `- ${rule}`),
      ...(imagery.photography ?? []).map((rule) => `- Photography: ${rule}`),
      ...(imagery.patterns ?? []).map((rule) => `- Pattern: ${rule}`),
    ],
  }
}

/** Per-component usage: what each reusable component is for, and when not to reach for it. */
const componentSection = (document: Readonly<DesignSystemDocument>): Section => {
  const components = document.$extensions[SOVRIUM_EXTENSION_KEY].components ?? {}
  const rows = Object.entries(components).map(([name, guidance]) => [
    name,
    guidance.usage ?? '',
    guidance.when ?? '',
    guidance.dont ?? '',
  ])
  return {
    title: 'Component usage',
    lines: rows.length === 0 ? [] : table(['Component', 'Usage', 'When', 'Do not'], rows),
  }
}

/**
 * The declarations the renderer discards.
 *
 * Printed as prose rather than as a token table, because the point is that an
 * agent must NOT treat these as values to use. Naming the reason is what lets
 * the author delete the line instead of wondering why it does nothing.
 */
const inertSection = (document: Readonly<DesignSystemDocument>): Section => ({
  title: 'Declared but not applied',
  lines: (document.$extensions[SOVRIUM_EXTENSION_KEY].inert ?? []).flatMap((entry) => [
    `- \`${entry.path}\` — declared \`${entry.declared}\`, and inert: ${entry.reason}`,
  ]),
})

/**
 * Values that ship but have no DTCG token form — shadows, `clamp()` steps, a
 * dark palette in a single-mode document. Distinct from the inert list: these
 * DO take effect, so an agent should honour them; they simply have no typed
 * home above.
 */
const unmappableSection = (document: Readonly<DesignSystemDocument>): Section => {
  const unmappable = document.$extensions[SOVRIUM_EXTENSION_KEY].unmappable ?? {}
  const rows = Object.entries(unmappable).map(([path, raw]) => [path, raw])
  return {
    title: 'Values kept outside the token tree',
    lines:
      rows.length === 0
        ? []
        : [
            'These are applied by the app but have no faithful DTCG form, so they are carried verbatim.',
            '',
            ...table(['Declaration', 'Value'], rows),
          ],
  }
}

/**
 * Project the design-system document into an llms.txt-shaped agent brief.
 *
 * @param document - The document `buildDesignSystem` produced.
 * @param appName - The app the document describes, for the mandatory H1.
 * @returns Markdown, ending in a single trailing newline.
 */
export function renderDesignSystemMarkdown(
  document: Readonly<DesignSystemDocument>,
  appName: string
): string {
  const summary =
    `${document.$description} ` +
    'Use these tokens and rules as written — they are this app’s, not your defaults. ' +
    'Everything listed is what the running app emits; anything declared and discarded is named at the end.'

  return [
    `# ${appName} — Design System`,
    '',
    `> ${summary}`,
    '',
    ...renderSections([
      principlesSection(document),
      logoSection(document),
      voiceSection(document),
      toneSection(document),
      colorSection(document),
      typeScaleSection(document),
      measureSection('Spacing tokens', document.spacing),
      measureSection('Radius tokens', document.radius),
      measureSection('Breakpoint tokens', document.breakpoint),
      fontSection(document),
      measureSection('Duration tokens', document.duration),
      imagerySection(document),
      componentSection(document),
      unmappableSection(document),
      inertSection(document),
    ]),
  ]
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd()
    .concat('\n')
}
