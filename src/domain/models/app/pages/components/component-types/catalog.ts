/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Which component-type categories the catalog publishes, and which it refuses.
 *
 * ─── WHY THIS IS A DOMAIN MODULE ───────────────────────────────────────────
 *
 * Everything here is a FACT ABOUT THE SCHEMA — which categories exist, which
 * types each holds, and which two types may never be drawn. None of it is a
 * decision about a surface, so none of it belongs to whichever surface happens
 * to read it. It lived in the admin console's builder tree until the console
 * became configuration, at which point a config file would have had to import
 * an application use-case to ask the domain about itself.
 *
 * ─── THE TYPE LISTS ARE DERIVED, NOT COPIED ────────────────────────────────
 *
 * Each category's membership is read from the OWN per-category barrel
 * (`component-types/<category>/index.ts`) by pulling every `*TypeLiteral`
 * export and reading its literal. A category therefore gains a type the moment
 * the schema does, and {@link catalogedTypesOf} reports any type in a
 * published category that has no specimen — so a new component-type surfaces
 * on the page as a gap rather than silently not existing.
 *
 * The brief asked for `allComponents` (`component-types/index.ts`) to be
 * exported for this. It was tried and rejected on measurement: `allComponents`
 * is a FLAT list whose only category information is source comments, so it
 * cannot answer "what is in `form-controls`" — the one question a per-category
 * route has to ask. The per-category barrels are already public, carry the
 * partition, and are read the same one-hop way (`.ast.literal`, no union
 * walk). Measured equal to `allComponents`' own comment blocks at the time —
 * the per-category figures are deliberately not restated here, because they
 * move with every catalogue change and a stale count in a rationale reads as a
 * measurement. Re-measure with `catalogedTypesOf` if you need them. Exporting
 * `allComponents` with no consumer would also have failed Knip.
 *
 * ─── TWO REFUSALS, BOTH SAFETY PROPERTIES ──────────────────────────────────
 *
 * A category absent from {@link CATALOG_COMPONENT_CATEGORIES}, and a type named
 * in {@link EXCLUDED_TYPES}. Neither is a filter that may be generalised away:
 * each exists because rendering the thing would break [internal ref] A3's specimen
 * bound inside a preview frame.
 */

import * as aiTypes from './ai'
import * as contentTypes from './content'
import * as dataTypes from './data'
import * as displayTypes from './display'
import * as feedbackTypes from './feedback'
import * as formControlTypes from './form-controls'
import * as interactiveTypes from './interactive'
import * as layoutTypes from './layout'
import * as navigationTypes from './navigation'
import * as overlayTypes from './overlays'
import * as specialtyTypes from './specialty'
import * as structuralTypes from './structural'

/**
 * The component-type categories the catalog publishes a route for.
 *
 * ─── `editors` NO LONGER EXISTS TO EXCLUDE ─────────────────────────────────
 *
 * There used to be a fifteenth category holding `schema-json-editor`,
 * `schema-yaml-editor`, `schema-form-editor` and `schema-ai-agent`, refused
 * here because their SSR placeholders shipped a live Submit button and a
 * textbox whose island POSTed into the records API — [internal ref] A3 clause 2 on
 * the markup, clause 3 on the wire, and the config-editing plane [internal ref] D3
 * relocated to paid Cloud, re-admitted through a door marked "design".
 *
 * The refusal held, and then the four types were DELETED outright. A category
 * that cannot be drawn because it is empty needs no exclusion, so the entry is
 * gone rather than kept as a tombstone. What replaces it is the decode-time
 * refusal in `retired-types.ts`, which is where an author who writes one of
 * those names now meets the answer.
 *
 * ─── AND THE LIST IS NOW COMPLETE BUT FOR THE TWO EXCLUSIONS ──────────────
 *
 * Twelve of fourteen. What is left unlisted is `custom` (renders the
 * operator's own HTML, so there is no generic specimen) and `modules` (shared
 * prop bags that render nothing of their own). Neither is a schedule, which is
 * why they are named together in the kit's one closing note rather than left
 * to read as gaps — a reader who saw them beside unbuilt categories would
 * reasonably wait for them.
 *
 * The ORDER is the reading order of the approved mockup, not alphabetical: what
 * a reader clicks, what they fill in, what they read data from, what holds it
 * together, then the content and the chrome. This list is the ONLY place that
 * order lives. `design-system-catalog-coverage.ts` used to restate it — that
 * module was deleted in `ebde3f4038` when the console became configuration, and
 * the sentence pointing at it survived the module by two waves, telling every
 * reader to go and reconcile this list against a file that is not there.
 */
export const CATALOG_COMPONENT_CATEGORIES = [
  'interactive',
  'form-controls',
  'data',
  'layout',
  'content',
  'display',
  'navigation',
  'overlays',
  'feedback',
  'structural',
  'specialty',
  'ai',
] as const

/** One of the published component-type categories. */
export type CatalogComponentCategory = (typeof CATALOG_COMPONENT_CATEGORIES)[number]

/**
 * Types inside a PUBLISHED category that the catalog reports rather than draws.
 *
 * `form` (category `data`) — emits `<button type="submit">` unconditionally
 * (`crud-form-renderer.tsx`, create AND update branches), and `data` is a route
 * `[internal ref]` sweeps for A3 clause 2. Drawing it would put a live
 * write control inside a preview frame. Same class as `editors` above: a safety
 * exclusion. Do not delete this as dead weight — the catalog would go red on
 * 022, but only after someone had shipped a submit button into the console.
 *
 * ─── ONE SENTENCE, BECAUSE THERE IS NOW ONE TYPE ───────────────────────────
 *
 * Two entries stood here while `data-form` was a second registered literal, and
 * they were deliberately NOT the same string: the kit index is a card grid
 * where a refused type's reason is all the card carries, so two cards printing
 * one sentence left a reader unable to tell which type it was about. C3 merged
 * the two literals, and the sentence below names BOTH of the merged type's
 * modes rather than picking one — a reader who arrives with a table-bound form
 * and reads only "the fields you declare on it" has been told about a different
 * component than the one they hold.
 *
 * The invariant that forced the split survives the merge and is what stops the
 * duplication coming back: `[internal ref]` asserts no two refused
 * types share a sentence, for the reason `-065` already asserts it inside the
 * `data` route. One sentence written once and pasted across N types goes false
 * on all N together, and no reader can tell which one it stopped describing.
 */
export const EXCLUDED_TYPES: Readonly<Record<string, string>> = {
  form: 'Renders a live submit control — over the fields you declare on it, or writing a record back to the table it binds; a preview frame may carry no write path (ADR-022 A3 clause 2).',
}

/**
 * One line per catalogued type: what the type is FOR.
 *
 * ─── WHY A SENTENCE, AND WHY IT LIVES HERE ─────────────────────────────────
 *
 * The kit index used to carry a meta line of AXIS COUNTS — `7 variants · used
 * on 3 pages` — and that line was empty on more than half the grid, because
 * most types declare neither a variant union nor a size union and are used
 * nowhere in a given app. Where it did appear it answered "how many shapes does
 * this have", which is not the question an author opens a catalogue with. The
 * question is *when would I reach for this rather than the one below it*, and
 * only a sentence answers it. The counts are not lost: they moved to the type
 * page, beside the axes they count.
 *
 * It lives in the DOMAIN, beside the category partition, for the reason this
 * module's header gives for the partition itself — it is a fact about the
 * schema rather than a decision about a surface. The kit index reads it through
 * the component-types route; a second surface asking the same question gets the
 * same answer instead of writing its own.
 *
 * ─── IT IS AUTHORED, WHICH IS WHY THE TEST BESIDE IT IS LOAD-BEARING ───────
 *
 * Everything else in this module is DERIVED from the barrels, so a new type
 * appears without anyone editing anything. This map cannot be: no sentence is
 * derivable from a schema. That makes it the one place here that can go stale
 * in both directions — a new type with no sentence, and a sentence for a type
 * that has left the catalogue — so `catalog.test.ts` fails on either, and on a
 * line too short to be a sentence, a line that only restates the type name, and
 * two types sharing a line. A generic "A component of the kit." on every row
 * satisfies a presence check and teaches nothing, which is exactly what the
 * distinctness clause exists to refuse.
 *
 * ─── HOUSE STYLE FOR A LINE ────────────────────────────────────────────────
 *
 * Present tense, one sentence, no marketing. Say what the type is for and how
 * it differs from its nearest sibling — `dialog` and `drawer` are both overlays
 * and their lines have to be tellable apart at a glance. Name the config key an
 * author would reach for where one decides the behaviour (`href`, `dataSource`,
 * `agents[]`), because that is the sentence doing a second job.
 */
export const COMPONENT_TYPE_PURPOSES: Readonly<Record<string, string>> = {
  // interactive
  alert: 'A message the reader must see before going on: what changed, what it costs, what to do.',
  badge: 'A short status word pinned to a thing, never a sentence.',
  button: 'One action, stated as a verb. A link when href is set, a button otherwise.',
  'button-group': 'Several exclusive actions of equal weight, joined so they read as one control.',
  link: 'Navigation inside a run of text, underlined so it reads as a link at a glance.',
  'theme-toggle': 'The one control that flips the colour scheme and remembers the choice.',

  // form-controls
  checkbox: 'A yes or no the reader sets, with room for several in a list.',
  'code-editor':
    'Source text the reader edits, highlighted by language and indented to your width.',
  'date-picker': "A calendar date, typed or picked, in the reader's locale.",
  'date-range-picker':
    'A period rather than a date: two months side by side, and presets that resolve against today.',
  field: 'A labelled control with its help and its error, laid out the same way everywhere.',
  input: 'A single line of text, typed by the reader.',
  'input-group': 'One input with a fixed prefix, suffix or action fused to its edge.',
  'radio-group': 'One choice among a few, all visible at once.',
  'rich-text-editor': 'Formatted prose, written in place, with only the marks you allow.',
  'record-picker': 'One row of another table, found by typing its name and linked.',
  select: 'One choice among many, folded until opened.',
  slider: 'A number in a range, dragged rather than typed.',
  switch: 'A setting that applies as soon as it flips.',
  textarea: 'Several lines of text, growing with what is written.',
  toggle: 'A pressed or released button that holds its state.',
  'toggle-group': 'A row of toggles where one, or several, stay pressed.',

  // data
  calendar: 'Records on a month or week grid, placed by their date field.',
  chart: 'A figure over rows: bars, lines, areas or a donut, one series per colour.',
  'filter-bar':
    'One set of conditions, published to every data component bound to the same channel.',
  form: 'The fields you declare, written to the table it binds or posted to an endpoint you name.',
  gallery: 'Records as cards with an image, in a responsive grid.',
  graph:
    'Nodes in ordered columns with the edges between them: the things the system read `dataSource` names, laid out left to right by kind, so an operator can follow a path rather than look a pair up.',
  kanban: 'Records as cards in columns, one column per value of a select field.',
  kpi: 'One number that matters, with its label and its movement.',
  list: 'Records as rows with a title, a subtitle and a trailing value.',
  matrix:
    'Two sets of things crossed, each intersection a glyph rather than a word: rows and columns are nodes of the graph `dataSource` names, and a cell is the edge between them.',
  table:
    'The records of a table as a grid — sorting, filtering, grouping, selection, paging — or the rows you write in the config.',

  // layout
  card: 'A bounded surface for one thing, on the page background.',
  container: 'A box that gives its children padding and a width.',
  flex: 'Children in a row or a column, spaced by one gap.',
  grid: 'Children in equal columns, collapsing to one on a narrow screen.',
  sidebar: 'The left rail: grouped navigation with an active entry.',
  'split-pane': 'Two panels side by side with a draggable divider.',

  // content
  audio: 'An audio file with play, progress and duration.',
  code: 'Source text in a monospace block, highlighted by language.',
  icon: "One glyph from the app's icon set, sized and coloured by the text around it.",
  iframe: 'Another page embedded at a fixed height.',
  image: 'A picture with its alt text, lazy unless it is above the fold.',
  kbd: 'The keys a reader is meant to press, drawn as keycaps.',
  'qr-code': 'A value drawn as a scannable code.',
  'search-input': 'Search within the page, or filter a bound list as you type.',
  text: 'A run of prose at one step of the type scale.',
  toc: 'The headings of the page as a list that follows the reader.',
  video: 'A video file with a poster, play and progress.',

  // display
  accordion: 'Stacked sections that open one at a time.',
  avatar: 'A person or a thing as a small round mark: a picture, initials, or nothing at all.',
  'description-list': 'Pairs of a term and its detail, read down rather than across.',
  'empty-state': 'What a view says when it has nothing to show, and what to do about it.',
  'list-item': 'One row of a list: a leading mark, a title, a subtitle, a trailing value.',
  marquee: 'A strip of logos or words that scrolls sideways.',
  'record-field': 'One field of one record, drawn read-only in its own format.',
  'scroll-area': 'A region that scrolls inside the page with a thin scrollbar.',
  swatch: 'One colour drawn as a filled square with its value and its name.',
  tabs: 'A short list of views, one visible at a time.',
  timeline:
    'Events on a line: declared in the config, or every record of a table between two dates.',

  // navigation
  breadcrumb: 'Where the reader is, as a path they can climb back up.',
  'command-palette': 'Search everything from anywhere, opened with a keyboard shortcut.',
  'context-menu': 'Actions on the thing under the pointer, on right click.',
  'dropdown-menu': 'Actions gathered behind one button, opened on click.',
  menubar: 'A row of menus, as in a desktop application.',
  'navigation-menu': 'The top navigation of a site, with menus that open on hover.',
  pagination: 'Move between pages of a long list.',

  // overlays
  'alert-dialog': 'A confirmation for an action that loses data.',
  dialog: 'A focused task over the page, dismissed by the overlay or a button.',
  drawer: 'A panel that slides in from an edge and keeps the page visible behind it.',
  'hover-card': 'A preview that opens when the pointer rests on a name.',
  popover: 'A small panel anchored to its trigger.',
  toast: 'A short confirmation that leaves on its own.',
  tooltip: 'One line of help on hover or focus.',

  // feedback
  progress: 'How far a known task has run.',
  skeleton: 'The shape of content that is still loading.',
  spinner: 'Waiting, when nothing else can be shown.',

  // structural
  divider: 'A hairline between two things that are not the same thing.',
  spacer: 'Empty room, sized from the spacing ladder.',

  // specialty
  comments: 'The thread of comments on a record, with replies, sorting and a composer.',
  'field-specimen': 'One field type drawn in every state the console documents it in.',
  'file-upload': 'Files into a bucket, dropped or picked.',
  'language-switcher': 'Change the language of the page.',
  'number-input': 'A number, typed or stepped one unit at a time.',
  preview:
    'One option of one type, drawn at the value you name, so a setting can be seen rather than described.',
  'reorderable-list': 'Rows the reader can drag into a new order.',
  specimen: 'One component drawn as an exhibit, framed and labelled for the catalogue.',
  'time-picker': 'A time of day, typed or picked.',

  // ai
  'ai-chat': 'A thread with an agent declared in agents[].',
}

/**
 * The floor a purpose line must clear to be a sentence rather than a label.
 *
 * Exported because the test beside this file and the kit index's own criterion
 * both read it: a floor written down twice is a floor that drifts, and the E2E
 * side of this contract lives in another tree.
 */
export const MINIMUM_PURPOSE_LENGTH = 24

/** What a catalogued type is for, in one line. `undefined` for anything else. */
export const purposeOfComponentType = (type: string): string | undefined =>
  COMPONENT_TYPE_PURPOSES[type]

/** Human-readable heading for each published category. */
export const CATALOG_CATEGORY_TITLES: Readonly<Record<CatalogComponentCategory, string>> = {
  interactive: 'Interactive',
  'form-controls': 'Form controls',
  data: 'Data',
  layout: 'Layout',
  content: 'Content',
  display: 'Display',
  navigation: 'Navigation',
  overlays: 'Overlays',
  feedback: 'Feedback',
  structural: 'Structural',
  specialty: 'Specialty',
  ai: 'AI',
}

/** A schema module namespace, as imported above. */
type TypeLiteralModule = Readonly<Record<string, unknown>>

/** Read the string a `Schema.Literal('x')` accepts, or `undefined`. */
function literalOf(value: unknown): string | undefined {
  const ast = (value as { ast?: { literal?: unknown } } | undefined)?.ast
  return typeof ast?.literal === 'string' ? ast.literal : undefined
}

/**
 * Every component-type literal a category's barrel exports.
 *
 * Sorted so the page order is stable across builds; the SPECIMEN order is
 * owned by the specimen table, which is where reading order belongs.
 */
function typeLiteralsOf(module: TypeLiteralModule): readonly string[] {
  return Object.entries(module)
    .filter(([name]) => name.endsWith('TypeLiteral'))
    .map(([, value]) => literalOf(value))
    .filter((literal): literal is string => literal !== undefined)
    .toSorted((a, b) => a.localeCompare(b))
}

const CATEGORY_MODULES: Readonly<Record<CatalogComponentCategory, TypeLiteralModule>> = {
  interactive: interactiveTypes,
  'form-controls': formControlTypes,
  data: dataTypes,
  layout: layoutTypes,
  content: contentTypes,
  display: displayTypes,
  navigation: navigationTypes,
  overlays: overlayTypes,
  feedback: feedbackTypes,
  structural: structuralTypes,
  specialty: specialtyTypes,
  ai: aiTypes,
}

/** Every component-type the schema places in a published category. */
export function catalogedTypesOf(category: CatalogComponentCategory): readonly string[] {
  return typeLiteralsOf(CATEGORY_MODULES[category])
}

/** Whether a string names a published component-type category. */
export const isCatalogComponentCategory = (value: string): value is CatalogComponentCategory =>
  (CATALOG_COMPONENT_CATEGORIES as readonly string[]).includes(value)
