/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The five reads that describe **this operator's** design system, as opposed to
 * what the engine can draw: their tokens, their sentences, which layers they
 * authored, what their exports weigh, and where their pages write a type.
 *
 * ─── EVERY ANSWER IS A FUNCTION OF THE `App`, AND THAT IS THE WHOLE POINT ───
 *
 * `design-system-schema.ts` beside this one projects the component REGISTRY —
 * the same eighty-five rows on every instance, invariant for a given build.
 * Nothing here is: the token rows move when the operator edits `design`,
 * the guidance rows are their sentences, the export sizes are the bytes their
 * config produces, and the usage counts walk their `pages[]`.
 *
 * That difference is why these are endpoints at all. A console page transcribed
 * into declarative config renders literals and envelopes; it cannot count,
 * filter, introspect or split a string. So each fact here either arrives
 * pre-computed over the wire or it needs a TypeScript builder, and [internal ref]
 * leaves only the first.
 *
 * ─── AND EVERY ANSWER IS DERIVED FROM ONE SOURCE ───────────────────────────
 *
 * Tokens and exports both read `buildDesignSystem(app)`, the same generator the
 * two export routes serve, so a figure printed beside a download cannot describe
 * a different system than the download hands over. Guidance reads the config
 * positions directly rather than the projected document, because the document
 * merges and re-keys — and a reader who wants to CHANGE a sentence needs the
 * line they wrote, not where it landed.
 *
 * @see src/domain/models/api/admin/design-system/facets.ts
 */

import { splitGuidanceLine } from '@/domain/models/app/design/guidance-line'
import { buildDesignSystem } from './design-system'
import { imageryLines, markMisuseLines } from './design-system-brand-facet'
import { renderDesignSystemMarkdown } from './design-system-markdown'
import { voicePreviewOf } from './design-system-voice-preview'
import type {
  DesignSystemExportRow,
  DesignSystemExportsResponse,
  GuidanceKind,
  GuidanceListResponse,
  GuidanceRow,
} from '@/domain/models/api/admin/design-system/facets'
import type { App } from '@/domain/models/app'

/** The length of an array-shaped value, and zero for anything else. */
export const sized = (value: unknown): number => (Array.isArray(value) ? value.length : 0)

/** The keys of a record-shaped value, and the empty list for anything else. */
export const keysOf = (record: unknown): readonly string[] =>
  typeof record === 'object' && record !== null && !Array.isArray(record)
    ? Object.keys(record as Readonly<Record<string, unknown>>)
    : []

export { designTokenFacet, typeLadderFacet } from './design-system-token-facet'

// ---------------------------------------------------------------------------
// The declared guidance, split into the two registers
// ---------------------------------------------------------------------------

/** The five moments the tone map covers, in the order the schema declares them. */
const TONE_MOMENTS = ['empty', 'loading', 'error', 'success', 'destructive'] as const

/** A declared line, addressed and labelled, before its two registers are split. */
type DeclaredLine = {
  readonly kind: GuidanceKind
  readonly path: string
  readonly label: string
  readonly line: string
  readonly pairsWith?: string
  /** Imagery rows only — see `verdictOf` in `design-system-brand-facet.ts`. */
  readonly verdict?: 'prefer' | 'never'
}

/**
 * The ordinal a `path` already carries, when it addresses an ARRAY entry.
 *
 * A single STATIC literal, never built from input (`sovrium/no-dynamic-regexp`).
 */
const PATH_ORDINAL = /\[(\d+)\]$/

/**
 * One row per declared line, with the instruction and reason split apart and an
 * ORDINAL beside the address.
 *
 * WHY THE ORDINAL IS PUBLISHED. A config page has no arithmetic and no list
 * counter: a row template that wants to print `01` beside a principle, or stamp
 * `data-design-principle="0"` so the nth one is addressable, cannot derive the
 * position it is at. Parsing it out of `path` in the browser is the same
 * duplication the instruction/reason split is already server-side to avoid —
 * and it is not even always derivable, since a `components[x].guidance.usage`
 * address carries no trailing index at all.
 *
 * So the ordinal is the entry's index WITHIN ITS KIND, which is the sequence a
 * reader sees. Where the address does carry one — `design.principles[0]` — the
 * two agree by construction, and the address's own number is preferred so a
 * row's ordinal survives a sibling being filtered out by `splitGuidanceLine`.
 */
const splitRows = (declared: readonly DeclaredLine[]): readonly GuidanceRow[] => {
  // Split FIRST, number second: a line whose instruction is empty is dropped,
  // and numbering before the drop would leave a gap in the sequence a reader
  // sees.
  const surviving = declared.flatMap(({ line, ...rest }) => {
    const { instruction, rationale } = splitGuidanceLine(line)
    return instruction.length === 0
      ? []
      : [{ ...rest, instruction, ...(rationale === undefined ? {} : { reason: rationale }) }]
  })

  return surviving.map((row, position) => {
    const addressed = PATH_ORDINAL.exec(row.path)?.[1]
    const index =
      addressed === undefined
        ? surviving.slice(0, position).filter((earlier) => earlier.kind === row.kind).length
        : Number(addressed)
    return {
      ...row,
      index,
      // The literal a page PRINTS. One-based and zero-padded, because a config
      // page can neither add one nor pad — the two operations that stand
      // between a zero-based index and the label a reader sees.
      ordinal: String(index + 1).padStart(2, '0'),
    }
  })
}

/** A voice block's lines, addressed under `base` and attributed to `prefix`. */
const voiceLines = (
  voice: Readonly<Record<string, unknown>> | undefined,
  base: string,
  prefix: 'voice' | 'zone.voice',
  label: string
): readonly DeclaredLine[] => {
  if (voice === undefined) return []
  const at = (kind: string, path: string, line: string): DeclaredLine => ({
    kind: `${prefix}.${kind}` as GuidanceKind,
    path,
    label,
    line,
  })
  const list = (key: 'personality' | 'prefer' | 'avoid'): readonly DeclaredLine[] =>
    (Array.isArray(voice[key]) ? (voice[key] as readonly unknown[]) : []).flatMap((entry, index) =>
      typeof entry === 'string' ? [at(key, `${base}.${key}[${index}]`, entry)] : []
    )
  const tone = (voice['tone'] ?? {}) as Readonly<Record<string, unknown>>

  return [
    // `personality` has no zone form — a zone that is a different personality is
    // a different app — so the base voice is the only place it can appear.
    ...(prefix === 'voice' ? list('personality') : []),
    ...(typeof voice['pronoun'] === 'string'
      ? [at('pronoun', `${base}.pronoun`, voice['pronoun'])]
      : []),
    ...list('prefer'),
    ...list('avoid'),
    ...TONE_MOMENTS.flatMap((moment) =>
      typeof tone[moment] === 'string'
        ? [{ ...at('tone', `${base}.tone.${moment}`, tone[moment]), label: moment }]
        : []
    ),
  ]
}

/** The house principles, each addressed by its index in the declared array. */
const principleLines = (design: Readonly<Record<string, unknown>>): readonly DeclaredLine[] =>
  (Array.isArray(design['principles']) ? (design['principles'] as readonly unknown[]) : []).flatMap(
    (line, index) =>
      typeof line === 'string'
        ? [{ kind: 'principle' as const, path: `design.principles[${index}]`, label: '', line }]
        : []
  )

/** What each colour role is for, plus the role it is meant to sit against. */
const colorRoleLines = (design: Readonly<Record<string, unknown>>): readonly DeclaredLine[] => {
  const roles = (design['colorRoles'] ?? {}) as Readonly<
    Record<string, { readonly usage?: string; readonly pairsWith?: string }>
  >
  return Object.entries(roles).flatMap(([name, role]) =>
    typeof role?.usage === 'string'
      ? [
          {
            kind: 'colorRole' as const,
            path: `design.colorRoles.${name}.usage`,
            label: name,
            line: role.usage,
            ...(typeof role.pairsWith === 'string' ? { pairsWith: role.pairsWith } : {}),
          },
        ]
      : []
  )
}

/**
 * A template's three registers, which are three KINDS rather than three fields.
 *
 * `usage`, `when` and `dont` answer three different questions and the Components
 * page draws them under three headings, so a row shape carrying two empty
 * sentences would need a filter in the page to avoid drawing blank ones.
 */
const componentLines = (components: App['components']): readonly DeclaredLine[] =>
  (components ?? []).flatMap((component) =>
    (['usage', 'when', 'dont'] as const).flatMap((register) => {
      const line = component.guidance?.[register]
      return typeof line === 'string'
        ? [
            {
              kind: `component.${register}` as GuidanceKind,
              path: `components[${component.name}].guidance.${register}`,
              label: component.name,
              line,
            },
          ]
        : []
    })
  )

/** Each zone's voice override, kept out of the house rules it does not govern. */
const zoneLines = (design: Readonly<Record<string, unknown>>): readonly DeclaredLine[] =>
  (Array.isArray(design['zones']) ? (design['zones'] as readonly unknown[]) : []).flatMap(
    (zone, index) => {
      const entry = zone as { readonly zone?: string; readonly voice?: Record<string, unknown> }
      return voiceLines(entry.voice, `design.zones[${index}].voice`, 'zone.voice', entry.zone ?? '')
    }
  )

/** Every sentence the app declares, addressed by its config position. */
const declaredLines = (app: App): readonly DeclaredLine[] => {
  const design = (app.design ?? {}) as Readonly<Record<string, unknown>>
  const voice = design['voice'] as Readonly<Record<string, unknown>> | undefined
  return [
    ...principleLines(design),
    ...voiceLines(voice, 'design.voice', 'voice', ''),
    ...colorRoleLines(design),
    ...componentLines(app.components),
    ...zoneLines(design),
    ...imageryLines(design),
    ...markMisuseLines(design),
  ]
}

/**
 * Every declared sentence, split into the register a reader obeys and the reason
 * the same line gave for it.
 *
 * The split is server-side and has to be: `design.voice.prefer` is an array of
 * bare strings, a config page has no string operations at all, and publishing
 * the raw line for a renderer to split would duplicate a quote-aware parser into
 * the presentation layer where the second copy would drift from the first.
 */
export const guidanceFacet = (
  app: App,
  kind?: GuidanceKind,
  label?: string
): GuidanceListResponse => {
  const rows = splitRows(declaredLines(app))
  // Two independent narrowings that COMPOSE, and neither is a lookup: an
  // unknown `label` answers zero rows rather than 404, because whether a
  // component or a colour role exists is the config's question and answering it
  // twice would let two endpoints disagree. `kind` is different — its set is
  // closed and named in the contract, so a typo there is a 400 at the validator.
  const items = rows
    .filter((row) => kind === undefined || row.kind === kind)
    .filter((row) => label === undefined || row.label === label)
  return { items, total: items.length, voicePreview: [voicePreviewOf(app)] }
}

// ---------------------------------------------------------------------------
// What each export weighs
// ---------------------------------------------------------------------------

/** How many lines of a document to hand back as its excerpt. */
const EXCERPT_LINES = 8

/**
 * A measured document: the bytes it serves, and an opening a reader can read.
 *
 * ─── THE SIZE IS THE WIRE FORM; THE EXCERPT IS THE READABLE ONE ────────────
 *
 * `bytes` and `lines` always measure the SERVED text — that is the whole point
 * of the ledger, and an admin design system facets spec re-derives both from the
 * endpoint's own response.
 *
 * The excerpt is a separate question, and for the JSON export it has to be.
 * `c.json` emits a MINIFIED document, so a prefix of the served bytes is one
 * truncated line — which tells a reader nothing about the document's shape, and
 * the shape is the entire reason there is an excerpt here rather than a link.
 * `readable` is therefore the form a person is shown, defaulting to the served
 * text for any document that already has newlines in it, so markdown keeps the
 * strict prefix property `FACETS-007` asserts on it.
 *
 * The split is not new — it is what the console has always shown. It lived in a
 * TypeScript builder that prettified the JSON for display and measured the
 * compact form beside it (`design-system-agents-surface.ts`, which says so).
 * Publishing it is what lets a config page draw the same card.
 */
const measure = (
  text: string,
  readable: string = text
): { readonly bytes: number; readonly lines: number; readonly excerpt: string } => ({
  bytes: new TextEncoder().encode(text).length,
  lines: text.split('\n').length,
  excerpt: readable.split('\n').slice(0, EXCERPT_LINES).join('\n'),
})

/**
 * Both exports, measured against the bytes their own routes serve.
 *
 * Every figure is taken from the SAME builder the download serves, in the same
 * request. A figure typed beside a link is documentation that drifts silently —
 * "11.2 KB · 178 lines · 13 sections" is right for one app and wrong on every
 * other instance, with nothing to ever say so.
 */
export const exportsFacet = (app: App): DesignSystemExportsResponse => {
  const document = buildDesignSystem(app)
  const markdown = renderDesignSystemMarkdown(document, buildDesignSystem(app, 'dark'), app.name)

  const items: readonly DesignSystemExportRow[] = [
    {
      format: 'json',
      href: '/api/admin/design-system.json',
      // Measured compact (what `c.json` serves), SHOWN indented (what a reader
      // can tell a token tree from a prose brief by). One line of minified JSON
      // is not an excerpt of anything.
      ...measure(JSON.stringify(document), JSON.stringify(document, undefined, 2)),
      // No `sections`: a JSON document has GROUPS, not sections, and a count
      // invented for it would put a false parallel on the page.
    },
    {
      format: 'md',
      href: '/api/admin/design-system.md',
      ...measure(markdown),
      sections: markdown.split('\n').filter((line) => line.startsWith('## ')).length,
    },
  ]
  return { items, total: items.length }
}
