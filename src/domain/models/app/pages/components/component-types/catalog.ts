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
 * ─── THERE IS NO `editors` CATEGORY ────────────────────────────────────────
 *
 * Config-authoring editor types do not exist ([internal ref] D3 puts the
 * config-editing plane in paid Cloud, and [internal ref] A3 forbids a live submit path
 * in the console), so there is no category to exclude. An author who writes one
 * of their names meets the decode-time refusal in `retired-types.ts`.
 *
 * ─── THE LIST IS COMPLETE BUT FOR THE TWO EXCLUSIONS ──────────────────────
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
 * order lives; nothing else restates it.
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
 * an admin design system spec sweeps for A3 clause 2. Drawing it would put a live
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
 * duplication coming back: an admin design system spec asserts no two refused
 * types share a sentence, for the reason `-065` already asserts it inside the
 * `data` route. One sentence written once and pasted across N types goes false
 * on all N together, and no reader can tell which one it stopped describing.
 */
export const EXCLUDED_TYPES: Readonly<Record<string, string>> = {
  form: 'Renders a live submit control — over the fields you declare on it, or writing a record back to the table it binds; a preview frame may carry no write path (ADR-022 A3 clause 2).',
  questionnaire:
    'Submits each answer through the form it names; a preview frame may carry no write path (ADR-022 A3 clause 2).',
}

/**
 * One line per catalogued type: what the type is FOR.
 *
 * ─── WHY A SENTENCE, AND WHY IT LIVES HERE ─────────────────────────────────
 *
 * The kit index carries a sentence, not a meta line of AXIS COUNTS — `7
 * variants · used on 3 pages`. Such a line would be empty on more than half the
 * grid, because most types declare neither a variant union nor a size union and
 * are used nowhere in a given app; and where it appeared it would answer "how
 * many shapes does this have", which is not the question an author opens a
 * catalogue with. The question is *when would I reach for this rather than the
 * one below it*, and only a sentence answers it. The counts live on the type
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
  alert:
    'A message the reader must see before going on, set in an alert: what changed, what it costs, what to do.',
  badge: 'A Badge: a short status word pinned to a thing, never a sentence.',
  button: 'One action, stated as a verb. A link when href is set, a button otherwise.',
  'button-group':
    'A Button Group: several exclusive actions of equal weight, joined so they read as one control.',
  link: 'Navigation inside a run of text, underlined so it reads as a link at a glance.',
  'theme-toggle': 'The one control that flips the colour scheme and remembers the choice.',

  // form-controls
  rating: 'A row of stars that reads a rating, and writes a whole one inside a form.',
  'signature-pad': 'A well to sign in, or a typed name, stored once with the statement agreed to.',
  checkbox: 'A yes or no the reader sets in a checkbox, with room for several in a list.',
  'code-editor':
    'Source text the reader edits, highlighted by language and indented to your width.',
  'date-picker': "A Date Picker: a calendar date, typed or picked, in the reader's locale.",
  'date-range-picker':
    'A period rather than a date: two months side by side, and presets that resolve against today.',
  field: 'A labelled control with its help and its error, laid out the same way in every field.',
  label: 'The label of one form control, wired to it so a click on the name focuses the control.',
  calendar:
    'A calendar: a month of days to pick one date, a range, or several, inline on the page.',
  input: 'A single line of text, typed by the reader into an input.',
  'input-otp':
    'A short verification code typed into an input OTP, one character per box, pasted or autofilled.',
  'input-group':
    'One input with a fixed prefix, suffix or action fused to its edge, in one input group.',
  'radio-group': 'One choice among a few in a radio group, all visible at once.',
  'rich-text-editor': 'Formatted prose, written in place, with only the marks you allow.',
  'record-picker': 'One row of another table, found by typing its name and linked.',
  select: 'One choice among many in a select, folded until opened.',
  combobox:
    'One choice found by typing into a combobox, from a list that narrows with each keystroke.',
  'native-select':
    "One choice in a native select, the browser's own dropdown, with no script to load.",
  slider: 'A number in a range, dragged along a slider rather than typed.',
  switch: 'A setting that applies as soon as its switch flips.',
  textarea: 'Several lines of text in a textarea, growing with what is written.',
  toggle: 'A pressed or released toggle that holds its state.',
  'toggle-group': 'A toggle group: a row of toggles where one, or several, stay pressed.',

  // data
  map: 'Records placed as pins at their location, with a list twin a keyboard can use.',
  tree: 'The records of one table nested under their parents, opened branch by branch.',
  'event-calendar': 'Records on a month or week grid, placed by their date field.',
  chart: 'A Chart over rows: bars, lines, areas or a donut, one series per colour.',
  'filter-bar':
    'One set of conditions, published to every data component bound to the same channel.',
  form: 'The fields you declare, written to the table it binds or posted to an endpoint you name.',
  gallery: 'Records as cards with an image, in a responsive grid.',
  carousel:
    'A Carousel: slides on one track, moved through one at a time with arrows, dots or a swipe.',
  graph:
    'Nodes in ordered columns with the edges between them: the things the system read `dataSource` names, laid out left to right by kind, so an operator can follow a path rather than look a pair up.',
  kanban: 'Records as cards in columns, one column per value of a select field.',
  kpi: 'One number that matters, with its label and its movement.',
  list: 'Records as rows with a title, a subtitle and a trailing value.',
  matrix:
    'Two sets of things crossed, each intersection a glyph rather than a word: rows and columns are nodes of the graph `dataSource` names, and a cell is the edge between them.',
  questionnaire:
    'A questionnaire: one question per screen, answered by choosing, with a count of how many remain.',
  table:
    'A Data Table: the records of a table as a grid — sorting, filtering, grouping, selection, paging — or the rows you write in the config.',

  // layout
  'aspect-ratio':
    'An aspect ratio frame: one image, video or map held at a fixed width-to-height shape, whatever the screen.',
  card: 'A Card: a bounded surface for one thing, on the page background.',
  bubble: 'A Bubble: the surface of one chat turn, set to its side of the thread.',
  container: 'A box that gives its children padding and a width.',
  flex: 'Children in a row or a column, spaced by one gap.',
  grid: 'Children in equal columns, collapsing to one on a narrow screen.',
  'message-scroller':
    'A message scroller: the scroll frame of a conversation, opening at the latest turn and keeping its place.',
  sidebar: 'The Sidebar: the left rail of grouped navigation, with an active entry.',
  resizable: 'Resizable panels: two side by side, with a draggable handle between them.',

  // content
  attachment:
    'An attachment chip: one file drawn by its icon or thumbnail, its name and size, and a way to open it.',
  'file-preview':
    'A stored file shown inline: a PDF in its viewer, an image with zoom, else a download.',
  audio: 'An audio file with play, progress and duration.',
  code: 'A Code Block: source text in a monospace frame, highlighted by language, with a copy button.',
  icon: "One glyph from the app's icon set, sized and coloured by the text around it.",
  iframe: 'Another page embedded at a fixed height.',
  image: 'A picture with its alt text, lazy unless it is above the fold.',
  kbd: 'The keys a reader is meant to press, drawn as Kbd keycaps.',
  'qr-code': 'A value drawn as a scannable code.',
  'search-input': 'Search within the page, or filter a bound list as you type.',
  text: 'Typography: a run of prose at one step of the type scale.',
  toc: 'The headings of the page as a list that follows the reader.',
  video: 'A video file with a poster, play and progress.',

  // display
  accordion: 'An Accordion: stacked sections that open one at a time.',
  collapsible:
    'A collapsible region behind one trigger, shown or hidden in place, with no siblings to close.',
  marker: 'A marker line inside a thread or a list: a status, a system note, a labelled break.',
  message:
    'A message: one turn of a conversation — who said it, when, on which side — around the bubble that holds it.',
  avatar:
    'An Avatar: a person or a thing as a small round mark — a picture, initials, or nothing at all.',
  'description-list': 'Pairs of a term and its detail, read down rather than across.',
  stepper:
    'One task split into ordered steps, each a body of its own, with a rail that shows progress.',
  empty: 'An Empty state: what a view says when it has nothing to show, and what to do about it.',
  item: 'An Item: one row of a list — a leading mark, a title, a subtitle, a trailing value.',
  marquee: 'A strip of logos or words that scrolls sideways.',
  'record-field': 'One field of one record, drawn read-only in its own format.',
  'scroll-area': 'A Scroll Area: a region that scrolls inside the page with a thin scrollbar.',
  swatch: 'One colour drawn as a filled square with its value and its name.',
  tabs: 'Tabs: a short list of views, one visible at a time.',
  timeline:
    'Events on a line: declared in the config, or every record of a table between two dates.',

  // navigation
  breadcrumb: 'A Breadcrumb: where the reader is, as a path they can climb back up.',
  command: 'A Command palette: search everything from anywhere, opened with a keyboard shortcut.',
  'context-menu':
    'A Context Menu of actions on the thing under the pointer, opened on right click.',
  'dropdown-menu': 'A Dropdown Menu of actions gathered behind one button, opened on click.',
  menubar: 'A Menubar: a row of menus, as in a desktop application.',
  'navigation-menu':
    'A Navigation Menu: the top navigation of a site, with menus that open on hover.',
  pagination: 'Pagination: move between the pages of a long list.',

  // overlays
  'alert-dialog': 'An Alert Dialog asking the reader to confirm an action that loses data.',
  dialog: 'A Dialog holding a focused task over the page, dismissed by the overlay or a button.',
  sheet: 'A Sheet: a panel that slides in from an edge and keeps the page visible behind it.',
  drawer: 'A drawer: a panel that rises from the bottom edge and is dragged down to dismiss.',
  'hover-card': 'A Hover Card: a preview that opens when the pointer rests on a name.',
  popover: 'A Popover: a small panel anchored to its trigger, opened on click.',
  toast: 'A Toast, drawn by Sonner: a short confirmation that leaves on its own.',
  tooltip: 'A Tooltip: one line of help on hover or focus.',

  // feedback
  progress: 'A Progress bar: how far a known task has run.',
  skeleton: 'A Skeleton: the shape of content that is still loading.',
  spinner: 'A Spinner: waiting, when nothing else can be shown.',

  // structural
  separator: 'A Separator: a hairline between two things that are not the same thing.',
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

/** How a shadcn/ui component maps onto Sovrium's catalogue ([internal ref] D12.3). */
export type ShadcnParityStatus = '1:1' | 'renamed' | 'new' | 'documented' | 'stub'

/** One row of the shadcn parity census. */
export interface ShadcnParityRow {
  /**
   * The Sovrium literal AFTER the parity programme: today's literal for a `1:1`
   * row, the literal it is renamed to for `renamed`, the literal it will be
   * minted as for `new`, `null` for a row with no config type: Direction (prose)
   * and Trace (internal anatomy the ai-chat island draws with).
   */
  readonly literal: string | null
  /** shadcn's own name for the component, as its docs title it. */
  readonly shadcnName: string
  /** The Base UI tab of shadcn's docs page. The URL lives here, ONCE. */
  readonly docsUrl: string
  readonly status: ShadcnParityStatus
}

const SHADCN_DOCS_BASE = 'https://ui.shadcn.com/docs/components/base'

const parity = (
  shadcnName: string,
  literal: string | null,
  status: ShadcnParityStatus,
  slug: string = shadcnName.toLowerCase().replace(/ /g, '-')
): ShadcnParityRow => ({ literal, shadcnName, docsUrl: `${SHADCN_DOCS_BASE}/${slug}`, status })

/**
 * The three-way census of shadcn/ui against Sovrium's catalogue: every shadcn
 * component, the Sovrium literal that answers to it, the docs page it is held
 * to, and how it maps. The typed home of the parity table (migration plan §4.7,
 * `[internal ref]`).
 *
 * ─── WHY IT LIVES HERE ─────────────────────────────────────────────────────
 *
 * Beside {@link COMPONENT_TYPE_PURPOSES}, for that map's reason: it is a fact
 * about the schema's vocabulary, read by more than one surface (the Shadcn
 * Reference Drift gate, the generated skill catalogue, the docs renderer), so
 * it is written once. Fragments carry only `Reference: shadcn/ui <Name>`; the
 * URL is read from here.
 *
 * ─── TWO LITERALS APPEAR TWICE, DELIBERATELY ───────────────────────────────
 *
 * shadcn documents Data Table and Table separately, and Sonner (its toast
 * registry item) beside Toast; Sovrium answers each pair with one type, so
 * `table` and `toast` each hold two rows. Every other literal is unique, and
 * `catalog.test.ts` holds that to exactly these two pairs.
 */
export const SHADCN_PARITY: readonly ShadcnParityRow[] = [
  parity('Accordion', 'accordion', '1:1'),
  parity('Alert', 'alert', '1:1'),
  parity('Alert Dialog', 'alert-dialog', '1:1'),
  parity('Aspect Ratio', 'aspect-ratio', 'new'),
  parity('Attachment', 'attachment', 'new'),
  parity('Avatar', 'avatar', '1:1'),
  parity('Badge', 'badge', '1:1'),
  parity('Breadcrumb', 'breadcrumb', '1:1'),
  parity('Bubble', 'bubble', 'new'),
  parity('Button', 'button', '1:1'),
  parity('Button Group', 'button-group', '1:1'),
  parity('Calendar', 'calendar', 'new'),
  parity('Card', 'card', '1:1'),
  parity('Carousel', 'carousel', 'new'),
  parity('Chart', 'chart', '1:1'),
  parity('Checkbox', 'checkbox', '1:1'),
  parity('Code Block', 'code', 'renamed'),
  parity('Collapsible', 'collapsible', 'new'),
  parity('Combobox', 'combobox', 'new'),
  parity('Command', 'command', 'renamed'),
  parity('Context Menu', 'context-menu', '1:1'),
  parity('Data Table', 'table', '1:1'),
  parity('Date Picker', 'date-picker', '1:1'),
  parity('Dialog', 'dialog', '1:1'),
  // eslint-disable-next-line unicorn/no-null -- the census contract (plan §4.7): Direction is prose, and `null` says "no literal" where `undefined` would read as "not filled in"
  parity('Direction', null, 'documented'),
  parity('Drawer', 'drawer', 'new'),
  parity('Dropdown Menu', 'dropdown-menu', '1:1'),
  parity('Empty', 'empty', 'renamed'),
  parity('Field', 'field', '1:1'),
  parity('Hover Card', 'hover-card', '1:1'),
  parity('Input', 'input', '1:1'),
  parity('Input Group', 'input-group', '1:1'),
  parity('Input OTP', 'input-otp', 'new'),
  parity('Item', 'item', 'renamed'),
  parity('Kbd', 'kbd', '1:1'),
  parity('Label', 'label', 'new'),
  parity('Marker', 'marker', 'new'),
  parity('Menubar', 'menubar', '1:1'),
  parity('Message', 'message', 'new'),
  parity('Message Scroller', 'message-scroller', 'new'),
  parity('Native Select', 'native-select', 'new'),
  parity('Navigation Menu', 'navigation-menu', '1:1'),
  parity('Pagination', 'pagination', '1:1'),
  parity('Popover', 'popover', '1:1'),
  parity('Progress', 'progress', '1:1'),
  parity('Questionnaire', 'questionnaire', 'new'),
  parity('Radio Group', 'radio-group', '1:1'),
  parity('Resizable', 'resizable', 'renamed'),
  parity('Scroll Area', 'scroll-area', '1:1'),
  parity('Select', 'select', '1:1'),
  parity('Separator', 'separator', 'renamed'),
  parity('Sheet', 'sheet', 'renamed'),
  parity('Sidebar', 'sidebar', '1:1'),
  parity('Skeleton', 'skeleton', '1:1'),
  parity('Slider', 'slider', '1:1'),
  parity('Spinner', 'spinner', '1:1'),
  parity('Switch', 'switch', '1:1'),
  parity('Table', 'table', '1:1'),
  parity('Tabs', 'tabs', '1:1'),
  parity('Textarea', 'textarea', '1:1'),
  parity('Toast', 'toast', '1:1'),
  parity('Toggle', 'toggle', '1:1'),
  parity('Toggle Group', 'toggle-group', '1:1'),
  parity('Tooltip', 'tooltip', '1:1'),
  // eslint-disable-next-line unicorn/no-null -- the census contract: Trace is internal anatomy (the ai-chat island draws its reasoning and tool lines with it), never a config type, so it has no literal
  parity('Trace', null, 'documented'),
  parity('Typography', 'text', '1:1'),
  parity('Sonner', 'toast', '1:1'),
  parity('Form', 'form', 'stub'),
]
