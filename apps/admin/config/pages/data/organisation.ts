/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// Organisation — who can reach what, and through which grant.
//
// The one question no other console surface answers. Every other data page is
// about the app's CONTENTS; this one is about its SHAPE.
//
// ─── WHAT SHIPS HERE, AND WHAT DELIBERATELY DOES NOT ───────────────────────
//
// The canvas draws five lenses — Map, Matrix, Reach, Processes, Agents — over
// one access graph, plus a findings list headed "What the map found". TWO of
// them ship: the findings, and the Matrix.
//
// The findings came first, and the order was right rather than a concession:
// the drawings are how an operator finds a structural exposure by looking, and
// the findings list is the same exposure already found and ranked, so an
// operator who reads three sentences has the answer the drawings exist to lead
// them to. The Matrix is what they open next — to see WHY a finding is true,
// and to see the thing no check looks for, which is a resource nobody has been
// granted at all. A list reports what IS exposed; only a grid shows an absence.
//
// The remaining three lenses (Map, Reach, Processes/Agents) need the `graph`
// component type, which the engine does not have. That is a core product
// update and is gated as its own slice.
//
// What is NOT here, named so nobody reads the omission as an oversight:
//
//   - The pulse strip and the nine count tiles. They live on the console's `/`
//     and are bound to `/api/admin/attention` + `/api/admin/overview`. Two
//     pages must not both answer "how big is this instance?".
//   - `nodes` and `edges` as a flat table. That would ship the Reach lens under
//     another name. The Matrix reads both, but crosses them rather than listing
//     them.
//   - `degraded`'s member NAMES. `string[]` is unbindable as rows (see
//     `systemSources.ts`), so the notice below says a source failed and cannot
//     yet say which. Stated in the copy rather than silently omitted.
//
// ─── THE TWO GATES, AND THE SCALAR THAT SHOULD REPLACE THEM ────────────────
//
// `visibility.record` has neither a length nor a presence operator — measured,
// not assumed: `exists` decodes and is then DROPPED, and the `brand` endpoint
// publishes a `declared` BOOLEAN precisely because of it. The condition
// evaluator compares `String(value)` against `String(expected)`
// (`condition-operators.ts`), and `String([])` is the empty string while
// `String([{…}])` is `'[object Object]'`. So `{ field: 'findings', eq: '' }`
// is "the list came back empty" and `neq: ''` is "it did not".
//
// That works and it is deterministic, but it rides on JS array stringification
// rather than on a contract, which is a thin thing to hang an empty state on.
// The honest fix is the one `brand` already shipped: the graph read publishes a
// `findingCount` / `degradedCount` scalar, and these two gates become ordinary
// numeric comparisons. Until it does, the mechanism is written down here rather
// than left for the next reader to rediscover from a silent blank page.
//
// ─── SEVERITY IS TYPOGRAPHY, WITH ONE COLOUR ───────────────────────────────
//
// Three ranks, rendered as a weight-and-ink gradient rather than as three
// pills. `critical` — a write path reachable without signing in — takes the
// error role, because that is a CONSEQUENCE and consequence is the one thing
// colour is reserved for in this console (`BRAND.md` §3). `warning` and
// `notice` recede into the ordinary foreground ramp. A console that paints
// three severities three colours has spent the channel that makes the first one
// legible at a glance.
//
// The message is the DATA and the severity is its LABEL, so the label is never
// the heavier of the two (`BRAND.md` §4).

import {
  emptyState,
  fullWidth,
  pageHeading,
  tabPanel,
  tabQuery,
  tabbedBody,
} from '../../components/dataPage'
import { withShell } from '../../components/shell'
import { ORGANISATION_GRAPH_ENDPOINT } from '../../systemSources'
import { REACH_TAB, reachSection } from './organisation-reach'
import type { PageConfig } from 'sovrium'

/** One node of a page's component tree, as the config type expresses it. */
type PageComponent = NonNullable<PageConfig['components']>[number]

/**
 * The two lenses that ship.
 *
 * The canvas draws five — Map, Matrix, Reach, Processes, Agents — over one
 * access graph. Five exist here: the findings, which are the CONCLUSIONS; the
 * Matrix, which is the drawing an operator would have found a conclusion by
 * looking at; the Map, which draws the chain the Matrix collapses; Reach, which
 * carries the same graph as text and is the only lens showing all five
 * relationship kinds; and Processes, which draws the automations — the part of
 * the app that runs with nobody in front of it. A strip naming five honest
 * lenses is better than one naming six where one is dead.
 *
 * Findings LEADS and is the default, on the argument this page shipped with: an
 * operator who reads three ranked sentences already has the answer the drawing
 * exists to lead them to. The Matrix is where they go to see WHY — and to find
 * the exposures the three checks do not look for. The Map is where they go to
 * see THROUGH WHAT: it is the only lens carrying the principal column, so it is
 * the only one that can answer "which person reaches this table", where the
 * Matrix can only answer "which role does".
 *
 * Processes is the fourth, and it is NOT the next step of that widening — it
 * changes the subject. The first three are three readings of one access graph
 * and every one of them is about a PRINCIPAL: who acts, what authorises them,
 * what they reach. Processes draws the side-graph, where nobody acts at all —
 * an automation runs on its own, on a trigger, whether or not a person is
 * there. That is why it sits last rather than between the Matrix and the Map,
 * and why its blurb has to say what it is instead of what it adds: an operator
 * arriving from the Map is not looking at a wider version of what they just
 * read.
 *
 * ─── THE MAP IS APPENDED, NOT INSERTED ─────────────────────────────────────
 *
 * The canvas draws the Map first among its five lenses, and this strip puts it
 * last anyway. Two reasons, and the second is the load-bearing one.
 *
 * The reading order conclusions -> grid -> chain is a widening: each lens adds
 * a column the one before it did not have, and an operator who stops early has
 * stopped at an answer rather than at a fragment.
 *
 * And `?tab=` is an ADDRESS. `?tab=matrix` is in specs, in the sidebar's own
 * deep links and in whatever an operator bookmarked; inserting a panel ahead of
 * it changes no id, but it does change which lens a reader lands beside, and
 * appending costs nothing to avoid finding out whether that mattered.
 *
 * Labels are `$t:` tokens, and the ids are what makes that safe. A token
 * resolves here (`buildTabsItems` runs the authored label through
 * `localizeChildLabel`), but a panel id is slugified FROM that label when
 * omitted — so a `$t:` caption with no explicit id would put the translation
 * key in the URL, and worse, a LITERAL caption with no explicit id would move
 * the id with the active locale (`findings` in English, `constats` in French)
 * and silently break every `?tab=` address an operator bookmarked. Every id
 * here is declared, so the strip is addressable in both languages.
 */
const TABS = [
  { id: 'findings', label: '$t:admin.organisation.tabs.findings' },
  { id: 'matrix', label: '$t:admin.organisation.tabs.matrix' },
  { id: 'map', label: '$t:admin.organisation.tabs.map' },
  // Reach — the same graph as TEXT, and the only lens that shows all five
  // relationship kinds. The Matrix draws `grant` alone and the Map draws
  // `member` and `grant`, so `trigger`, `escalation` and `step` reached no
  // surface at all before it. APPENDED for the reason the Map was: `?tab=` is
  // an address, and the widening order conclusions -> grid -> chain -> text
  // holds with it last. It owns its own module, so this page carries one entry
  // and one panel for the whole lens.
  REACH_TAB,
  // Processes last, and the ONE entry that is not part of that widening at all
  // — see the note above on why it changes the subject rather than extending
  // it. After Reach rather than before it because Reach was already an address
  // by the time this landed, and no reading order the two lenses share is
  // worth moving one for.
  { id: 'processes', label: '$t:admin.organisation.tabs.processes' },
] as const

/** A plain text node. */
const text = (element: string, className: string, content: string): PageComponent =>
  ({ type: 'text', element, props: { className }, content }) as PageComponent

/**
 * A text node that renders only on records whose `field` satisfies `operators`.
 *
 * Inside the findings list the record is one FINDING; outside it, the page's
 * own record — the whole graph body. One grammar, two scopes, which is what
 * lets the severity labels and the two page-level gates be the same helper.
 */
const gatedText = (
  element: string,
  className: string,
  content: string,
  record: Readonly<Record<string, unknown>>
): PageComponent =>
  ({
    type: 'text',
    element,
    props: { className },
    content,
    visibility: { record },
  }) as PageComponent

/**
 * NO SECTION HEADING — the tab IS the heading.
 *
 * `/env` and its siblings head each region with a quiet uppercase micro-label,
 * and this page did too while it had exactly one region and nothing above it to
 * name. The tab strip changed that: the trigger now says `Findings`, and a
 * `FINDINGS` label 40px beneath it is the restated heading [internal ref] §D4 names
 * outright — a word the reader has already read, spent again.
 *
 * Both regions keep their `aria-label`, so each is still a named landmark a
 * screen reader can jump to, and the accessible name is the FULLER phrase
 * (`Structural findings`, `Grant matrix`) rather than the trigger's one word.
 * Nothing is lost except the duplicate, which is the whole of the intent.
 *
 * The helper is gone with its last caller rather than left for a future one:
 * an unused private helper is a suggestion to reintroduce the thing it built.
 */

/**
 * One finding.
 *
 * The `<li>` is SYNTHESIZED by the row expander and takes no props from this
 * template, so the row's own attributes live on the outermost node the template
 * owns and the separator is the parent's `divide-y`.
 *
 * `data-finding-severity` and `data-finding-kind` are minted per row from the
 * record, so a spec can address "the critical findings" rather than the page's
 * whole text. They are attributes rather than a unique `data-testid` on
 * purpose: a finding id is derived per request and is not an address anyone
 * holds, while its RANK and its KIND are exactly what an assertion is about.
 */
const findingRow = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className: 'flex items-baseline gap-3 px-4 py-3',
      'data-testid': 'organisation-finding',
      'data-finding-severity': '$record.severity',
      'data-finding-kind': '$record.kind',
    },
    children: [
      // The RANK LEADS, and this is the one place the page departs from the
      // console's other row shape.
      //
      // `/env` and its siblings put the subject left and its status right,
      // across the full column, because they are DIRECTORIES: a name you look
      // up, and a state you then read. This is a RANKED list — the endpoint
      // orders it by blast radius and the severity is the key it ordered by —
      // and a ranking whose key is not the first thing on the row is a ranking
      // the reader has to reconstruct.
      //
      // Measured before the change, at 1440: the sentence ended at x=658 and
      // its rank sat at x=1368, a 710px eye-track for a one-word label on a
      // row whose content is 370px wide. Fixed-width and leading, the two align
      // down the list and the row scans in one pass (`BRAND.md` §5).
      {
        type: 'container',
        element: 'div',
        props: { className: 'w-20 shrink-0' },
        children: [
          // `text-error-fg`, NOT `text-error`. Measured against the served
          // stylesheet: `text-error` emits no rule at all and renders as the
          // inherited foreground, because the CSS candidate corpus scans `src`
          // and `templates` and NOT `apps/` — so a class this tree is the only
          // user of is dead on arrival. `text-error-fg` resolves to the error
          // ink (`--sv-error-fg`, #a12b1a, ~8:1 on the raised background).
          //
          // `apps/admin/config/pages/design-system/brand.ts` reaches for the
          // dead spelling too; that is a live defect there, not a precedent.
          gatedText('span', 'text-error-fg text-sm font-medium', 'Critical', {
            field: 'severity',
            eq: 'critical',
          }),
          gatedText('span', 'text-foreground text-sm font-medium', 'Warning', {
            field: 'severity',
            eq: 'warning',
          }),
          gatedText('span', 'text-foreground-subtle text-sm', 'Notice', {
            field: 'severity',
            eq: 'notice',
          }),
        ],
      } as PageComponent,
      {
        type: 'container',
        element: 'div',
        props: { className: 'flex min-w-0 flex-col gap-0.5' },
        children: [
          // The sentence, rendered server-side. The page prints it and does not
          // compose it — `subjects[]` is deliberately not repeated beneath,
          // because the sentence already names them.
          text('span', 'text-foreground text-sm', '$record.message'),
          // The SCALE, which the sentence does not carry. Three mutually
          // exclusive spans rather than one, because a number needs its unit
          // and "1 principals" is not a unit (`BRAND.md` §9).
          //
          // `"unbounded"` is not a bigger number, it is the absence of one —
          // nothing counts the people who have not signed up yet — so it reads
          // as a sentence rather than as a quantity.
          gatedText('span', 'text-foreground-subtle text-sm', 'Reachable without signing in', {
            field: 'blastRadius',
            eq: 'unbounded',
          }),
          gatedText('span', 'text-foreground-subtle text-sm', '1 principal', {
            field: 'blastRadius',
            eq: 1,
          }),
          gatedText('span', 'text-foreground-subtle text-sm', '$record.blastRadius principals', {
            field: 'blastRadius',
            notIn: ['unbounded', 1],
          }),
        ],
      } as PageComponent,
    ],
  }) as PageComponent

/**
 * The findings, ordered by blast radius descending — every unbounded exposure
 * above every finite one, as the endpoint sorts them. The page preserves that
 * order and does not re-sort: the ranking is reproducible by the operator only
 * while exactly one thing decides it.
 *
 * Wrapped in a gated container rather than gating the `list` itself, so the
 * visibility predicate is evaluated against the PAGE record while the list's
 * own binding stays free to fetch its rows. A system-rows list that comes back
 * empty renders an empty bordered box, which is why this gate and the empty
 * state below are mutually exclusive rather than merely ordered.
 */
const findingsList = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    visibility: { record: { field: 'findings', neq: '' } },
    children: [
      {
        // `list`, not a `container` with `element: 'ul'`: the container element
        // enum admits only sectioning elements, and this is the type whose
        // renderer already handles a data-bound child template.
        type: 'list',
        props: {
          className:
            'border-border divide-border bg-background-raised divide-y overflow-hidden rounded-lg border',
        },
        dataSource: {
          system: { endpoint: ORGANISATION_GRAPH_ENDPOINT, rowsKey: 'findings', idKey: 'id' },
        },
        children: [findingRow()],
      } as PageComponent,
    ],
  }) as PageComponent

/**
 * The empty state — and it says WHICH three checks came back clean, because
 * "no findings" alone is indistinguishable from "nothing was checked".
 *
 * The hint is not reassurance. An operator reading "no findings" as "this app
 * is secure" would be drawing a conclusion the checks do not support, and the
 * console does not guess on their behalf (`BRAND.md` §6).
 */
const noFindings = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    visibility: { record: { field: 'findings', eq: '' } },
    children: [
      emptyState(
        'No findings.',
        'No write path reachable without signing in, no resource readable by everyone, and no single person bridging two otherwise separate parts of the app.',
        'Three structural checks, not a security audit.'
      ),
    ],
  }) as PageComponent

/**
 * The degraded notice.
 *
 * It takes the error channel, and that is the one place on this page where the
 * choice is not obvious. A source that could not be read does not make the app
 * less safe — it makes this PAGE wrong, silently, in the direction of calm: a
 * missing team-membership read turns "one person is the only bridge between two
 * teams" into no finding at all. The exposure disappears rather than being
 * reported as unknown, which is exactly the failure the `degraded` field exists
 * to prevent, and it earns the loudest thing this console has.
 */
const degradedNotice = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className: 'border-error-border bg-error-bg flex flex-col gap-1 rounded-lg border p-4',
      'data-testid': 'organisation-degraded',
    },
    visibility: { record: { field: 'degraded', neq: '' } },
    children: [
      text('p', 'text-error-fg text-sm font-medium', '$t:admin.organisation.degraded.heading'),
      text('p', 'text-error-fg text-sm', '$t:admin.organisation.degraded.body'),
    ],
  }) as PageComponent

/** The findings region: its name, what it is, and one of the two states. */
const findingsSection = (): PageComponent =>
  ({
    type: 'container',
    element: 'section',
    props: {
      'aria-label': '$t:admin.organisation.findings.region',
      'data-testid': 'organisation-findings',
      // A reading measure, not a console width. These rows are SENTENCES, and
      // a 1150px line of prose is past the comfortable measure in either
      // direction — the sentence is hard to track back from, and a 370px
      // sentence in a 1150px box reads as a box someone forgot to fill. The
      // blurb above takes the same cap, so the region is one column rather than
      // a narrow paragraph over a wide table.
      className: 'flex max-w-3xl flex-col gap-3',
    },
    children: [
      text('p', 'text-foreground-subtle text-sm', '$t:admin.organisation.findings.blurb'),
      degradedNotice(),
      findingsList(),
      noFindings(),
    ],
  }) as PageComponent

/**
 * The Matrix — every resource against every grant source.
 *
 * Rows are the resources, banded by family; columns are the grant sources, most
 * privileged first. A cell is a grant, and an empty cell is the absence of one,
 * which is the half a findings list cannot show: the three structural checks
 * report what IS exposed, and only the grid shows what is not.
 *
 * ─── `sortDirection` IS LOAD-BEARING, NOT DECORATION ───────────────────────
 *
 * The axis sorts ASCENDING unless told otherwise, and ascending here would put
 * `viewer` (level 10) in the first column and `owner` (90) in the last — the
 * least privileged column first, which inverts the reading the whole grid is
 * built on. Nodes carrying no `level` — every team, and the open rung — keep
 * their source order AFTER those that do, which is what puts `*` last without
 * this config having to name it.
 *
 * ─── ONE GLYPH DECLARED, THREE DRAWN ───────────────────────────────────────
 *
 * `quadrant` names the PRIMARY rendering only. A table grant folds to `RCUD`
 * and draws the quadrant; a bucket grant folds to `RW`, which a quadrant cannot
 * express, so it degrades to the letters; a grant carrying no ops at all
 * renders filled. One grid, three glyphs, and no per-family configuration —
 * the ladder is the renderer's, so this page declares an intent rather than a
 * lookup table.
 *
 * The agent band is expected to come back EMPTY on a real instance, and that is
 * not a defect to chase: an agent is reached by a `trigger` edge, never a
 * `grant`, so no agent row has a cell to fill. It is drawn rather than hidden
 * because "nobody has been granted this" is the finding.
 */
const matrixLens = (): PageComponent =>
  ({
    type: 'matrix',
    dataSource: { system: { endpoint: ORGANISATION_GRAPH_ENDPOINT } },
    rows: { kinds: ['table', 'page', 'form', 'bucket', 'agent-resource'], groupBy: 'family' },
    columns: { kinds: ['role', 'team', 'open'], sortBy: 'level', sortDirection: 'desc' },
    cell: {
      from: 'edges',
      kind: 'grant',
      glyph: 'quadrant',
      opsField: 'ops',
      // The single most consequential fact this page publishes: a grant reached
      // through `*` is what turns a finite principal count into an unbounded
      // one. The label is a phrase a reader meets in a table cell, not a flag
      // name, because the accessible twin is where it is actually read.
      //
      // `flag` is a STRUCT and both halves are required. Flattening `field` and
      // `label` onto `cell` decodes without complaint — the app schema is not
      // `strictKeys`, so unknown keys are dropped in silence — and the grid then
      // renders with nothing flagged at all. Which is the one error on this page
      // that looks exactly like good news.
      //
      // A `$t:` TOKEN. It was a literal until the pass was reordered: the
      // component is now translated BEFORE `matrix-graph-resolver.ts` projects
      // `rows`/`columns`/`cell` into the render-time `matrixView`, so what
      // reaches the drawing — and the accessible name beside it — is words
      // rather than a key. The `matrixView` skip is unchanged and still as wide
      // as it was; nothing the endpoint returned is touched.
      flag: { field: 'viaOpenRung', label: '$t:admin.organisation.matrix.flag' },
    },
    // Named, so the drawing is a figure with an accessible name rather than a
    // wall of marks with no text in it. The twin table renders either way.
    //
    // A `$t:` TOKEN, and that is a correction rather than a preference. This
    // pair was literal under a comment asserting that a component's own schema
    // field is not on the substitution pass. It is now:
    // `resolveComponentTranslationTokens` walks every schema-level field except
    // `props`, `children`, `content`, `panels`, `responsive`, `i18n`,
    // `graphView` and `matrixView`, so `label` and `emptyMessage` both resolve
    // before the matrix renderer reads them off the component. Verified live on
    // this page in both languages.
    //
    // The sentence ends by saying where the facts are on purpose. A `role="img"`
    // announces itself and then stops, so a reader told only that a figure
    // exists has been told about something they cannot read.
    label: '$t:admin.organisation.matrix.label',
    emptyMessage: '$t:admin.organisation.matrix.empty',
  }) as PageComponent

/**
 * The exceptions beneath the grid — every declared narrowing of a grant.
 *
 * ─── WHAT A CELL CANNOT SAY ────────────────────────────────────────────────
 *
 * The grid above draws one glyph per grant, and a glyph has no room for a
 * qualifier. `engineer` may update `invoices` and may not read `amount`;
 * `member` may read `projects` but only the rows they own. Both are RCUD cells
 * in the grid and neither is the whole truth, which is exactly the gap this
 * list closes: it is the footnote the grid is allowed to have because the grid
 * itself cannot carry one.
 *
 * ─── ONE TABLE, NOT TWO ────────────────────────────────────────────────────
 *
 * The canvas draws the field narrowings and the row narrowings as two blocks,
 * and this is one with a `Scope` column, for a reason that is mechanical rather
 * than aesthetic: nothing in a system source filters rows by a field value. A
 * grid's own filters are REQUEST params, and this endpoint accepts `?node=` and
 * nothing else — so two tables would be two identical bindings rendering the
 * same rows twice, differing only in a heading that lied about half of them.
 *
 * The column is not a consolation prize either. `field` and `row` come from two
 * unrelated places in AppSchema written years apart — `permissions.fields[]`
 * and the sibling `rowLevelPermissions` — and this is the first surface in the
 * product that reads them as one idea. Putting them in one table with the axis
 * named is what says they ARE one idea.
 *
 * ─── SIX COLUMNS, AND `Detail` IS THE ONE THAT MATTERS ─────────────────────
 *
 * Five of them are the facts a reader sorts and scans by; `detail` is the
 * sentence rendered server-side, because a config layer can print a string and
 * cannot format one. It is last rather than first for the reason the findings
 * rows put their rank first: the four short cells are how you FIND the row, and
 * the sentence is what you read once you have.
 *
 * `roles` is deliberately NOT a column. It is present on exactly the `roles`
 * rung and absent on the other two and on every row scope, so a column would be
 * blank on most rows — and the sentence in `detail` already names the roles
 * ("Only engineer may read amount."), which is the readable form of the same
 * fact.
 */
const exceptionsTable = (): PageComponent =>
  ({
    type: 'table',
    props: {
      id: 'organisation-matrix-exceptions',
      'aria-label': 'Declared narrowings of a grant',
    },
    dataSource: {
      system: { endpoint: ORGANISATION_GRAPH_ENDPOINT, rowsKey: 'exceptions', idKey: 'id' },
    },
    columns: [
      { field: 'resource', label: '$t:admin.organisation.exceptions.resource' },
      {
        field: 'scope',
        label: '$t:admin.organisation.exceptions.scope',
        // Render-only, so the wire keeps its two-member enum while the cell
        // says which axis is narrowed in the words the sentence beneath uses.
        valueLabels: {
          field: '$t:admin.organisation.exceptions.scope.field',
          row: '$t:admin.organisation.exceptions.scope.row',
        },
      },
      { field: 'op', label: '$t:admin.organisation.exceptions.op' },
      { field: 'field', label: '$t:admin.organisation.exceptions.field' },
      {
        field: 'rung',
        label: '$t:admin.organisation.exceptions.rung',
        // The shape of the grant the narrowing applies to, in the vocabulary the
        // Matrix's own columns use. `everyone` is the open rung, which is the
        // column labelled `Everyone` one component up — the two must agree or
        // the reader has to translate between a grid and its own footnote.
        //
        // Blank on every row scope, correctly: a row predicate narrows WHICH
        // RECORDS, not who. The legend does not exist here to say so because the
        // sentence in `Detail` does.
        valueLabels: {
          everyone: '$t:admin.organisation.exceptions.rung.everyone',
          'any-session': '$t:admin.organisation.exceptions.rung.anySession',
          roles: '$t:admin.organisation.exceptions.rung.roles',
        },
      },
      { field: 'detail', label: '$t:admin.organisation.exceptions.detail' },
    ],
    emptyMessage: '$t:admin.organisation.exceptions.empty',
  }) as PageComponent

/**
 * What stands under the grid when nothing narrows anything.
 *
 * Gated on the same `String([]) === ''` mechanism as the findings list and the
 * reach table — the third and now fourth rider on it, documented at length at
 * the top of this file.
 *
 * It says what the absence MEANS rather than reporting it. "No exceptions" next
 * to a grid full of marks reads as reassurance, and it is the opposite: every
 * grant in the grid above is exactly as wide as it looks, with no column and no
 * row held back. On an app whose grid is a wall of open-rung marks, that is the
 * more alarming of the two readings and the copy has to carry it.
 */
const noExceptions = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    visibility: { record: { field: 'exceptions', eq: '' } },
    children: [
      emptyState(
        'No narrowings.',
        'No table holds a column back from a role, and no table filters which records a grant covers.',
        'Every cell in the grid above is the whole truth about that grant.'
      ),
    ],
  }) as PageComponent

/**
 * The exceptions panel: the table, or the empty state, never both.
 *
 * GIVEN THE COLUMN, not capped, and that is a correction to the first cut. A
 * `max-w-5xl` cap looked right in isolation and wrong on the page: the matrix's
 * own accessible twin sits directly above and takes the full content column, so
 * the two tables shared a left edge and ended 128px apart, which reads as one of
 * them having been laid out by somebody else. The cap was there to keep the
 * `Detail` sentence off a 900px line — but six columns divide the width between
 * them, and the sentence column measured **407px** uncapped at a 1152px content
 * column, so the cap was solving a problem the column count had already solved.
 */
const exceptionsPanel = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className: 'flex min-w-0 flex-col gap-3',
      'data-testid': 'organisation-matrix-exceptions-panel',
    },
    children: [
      text('h3', 'text-foreground text-sm font-medium', '$t:admin.organisation.exceptions.heading'),
      {
        type: 'container',
        element: 'div',
        visibility: { record: { field: 'exceptions', neq: '' } },
        children: [exceptionsTable()],
      } as PageComponent,
      noExceptions(),
    ],
  }) as PageComponent

/**
 * The matrix region.
 *
 * The blurb keeps the findings column's reading measure; the grid does not. A
 * sentence past ~75 characters is hard to track back from, and a table narrower
 * than its content is a table with a scrollbar — so the prose is capped and the
 * drawing is given the column.
 *
 * The exceptions panel sits BENEATH the grid, where the canvas puts it, because
 * it is a footnote: a reader who never scrolls past the grid has not missed a
 * lens, they have missed a qualifier on the one they just read.
 */
const matrixSection = (): PageComponent =>
  ({
    type: 'container',
    element: 'section',
    props: {
      'aria-label': '$t:admin.organisation.matrix.region',
      'data-testid': 'organisation-matrix',
      className: 'flex min-w-0 flex-col gap-6',
    },
    children: [
      {
        type: 'container',
        element: 'div',
        props: { className: 'flex min-w-0 flex-col gap-3' },
        children: [
          text(
            'p',
            'text-foreground-subtle max-w-3xl text-sm',
            '$t:admin.organisation.matrix.blurb'
          ),
          matrixLens(),
        ],
      } as PageComponent,
      exceptionsPanel(),
    ],
  }) as PageComponent

/**
 * The Map — the access chain, drawn left to right.
 *
 * Three columns, and the order is the direction of authority: who acts, what
 * authorises them, what they reach. An edge from column one to column two is a
 * membership; an edge from column two to column three is a grant.
 *
 * ─── WHAT THIS LENS HAS THAT THE MATRIX DOES NOT ───────────────────────────
 *
 * The principal column, and the `member` edge that reaches it. The Matrix
 * crosses resources with grant SOURCES, so its answer stops at "the `admin`
 * role can update this table" — the people standing in that role are on neither
 * axis, because a grid has nowhere to put the edge that joins them. The Map's
 * first column IS those people, so it answers the question an operator actually
 * arrives with, which is about a person and not about a role.
 *
 * ─── THE THREE COLUMNS MIRROR THE MATRIX'S TWO AXES, DELIBERATELY ──────────
 *
 * `kinds`, `sortBy` and `groupBy` here are the same values the grid next door
 * declares for its rows and columns. That is not duplication to collapse: two
 * lenses over one read that band and order the same things the same way can be
 * read against each other, and two that drift cannot. If the Matrix's banding
 * changes, this changes with it.
 *
 * ─── `sortDirection` IS LOAD-BEARING HERE TOO ──────────────────────────────
 *
 * Ascending puts `viewer` (level 10) at the top of the middle column and the
 * most privileged role at the bottom, which inverts the reading — the same trap
 * the grid documents at its own `columns`, and for the same reason.
 *
 * Without it the column would take the endpoint's emission order, which happens
 * to be descending today. Declaring it means the drawing is right BY DECLARATION
 * rather than by the resolver's current behaviour, which is the difference
 * between a lens that stays correct and one that is correct until someone
 * reorders a loop.
 *
 * ─── STILL NO `publishes`, AND THE REASON HAS CHANGED ──────────────────────
 *
 * It used to be that nothing COULD act on this map's channel. The shared-filter
 * bus is a REQUEST-PARAM bus — `SharedFilterBindingSchema` merges a publisher's
 * bag into every request its subscriber issues — and the graph endpoint took no
 * query parameter, so a subscriber re-requested the identical body. That is no
 * longer true: the endpoint accepts `?node=<id>`, narrows `nodes`, `edges` and
 * `exceptions` to that node's reach, and echoes `appliedNode` so a client can
 * tell a server that honoured the filter from one that ignored it.
 *
 * So the bus works end to end now, and this config still does not use it. The
 * reason is no longer capability, it is COST and DUPLICATION:
 *
 *   - A subscriber is a panel, and a panel on this tab is serialized into the
 *     tabs island's props on all four others. The map panel is already the
 *     second-largest on the page.
 *   - The only subscriber worth having would show the selected node's edges as
 *     text — which is the Reach tab, one click away, in full. Two surfaces
 *     answering one question is how they come to disagree.
 *
 * Selection therefore stays where it is useful and honest: inside the drawing,
 * dimming what the selected node does not touch. Declaring a publisher with no
 * subscriber would be config theatre, and the endpoint widening does not oblige
 * this page to spend it. The platform's own spec for the bus
 * exercises it against its own fixture, which is where
 * a mechanism belongs rather than in whichever app happened to motivate it.
 *
 * ─── EVERY AUTHORED STRING ON THIS LENS IS A KEY ───────────────────────────
 *
 * `label`, `emptyMessage` and the three column captions all resolve. The
 * captions were literals until the order was fixed, and the reason stated here
 * for keeping them that way was wrong twice over — it is corrected rather than
 * deleted, because both errors point a reader at the wrong fix.
 *
 * It said a schema-typed field resolves only for a type with a `TYPE_BUILDERS`
 * entry, and that `kpi` has none. `kpi` HAS one, and its label resolves AND
 * repaints — measured on the Reach tab's two tiles, which carry the
 * `data-translations` twin the language switch reads. So `TYPE_BUILDERS` is not
 * the gate it was described as, and an author who believed this comment would
 * have left a `kpi` label in English for no reason.
 *
 * It then said the graph and matrix RESOLVERS copy their captions into
 * `graphView` / `matrixView` ahead of the pass, so a caption alone is skipped.
 * That WAS true and is no longer: the component is translated before it is
 * projected. The skip itself is unchanged — everything the endpoint returned is
 * still left alone — so a node's own label is data and stays as it came back.
 *
 * The console ships French, so a literal costs more than an inconsistency of
 * spelling: it is a string that cannot follow the switch. Nothing authored on
 * this page is one now.
 *
 * The accessible name ends by saying where the facts are, because a `role="img"`
 * announces itself and then stops — a reader told only that a figure exists has
 * been told about something they cannot read.
 */
const mapLens = (): PageComponent =>
  ({
    type: 'graph',
    layout: 'layered',
    dataSource: { system: { endpoint: ORGANISATION_GRAPH_ENDPOINT } },
    columns: [
      // Banded by `kind`, which is what separates a person from an agent.
      //
      // NOT `groupBy: 'role'`, which the proposal's sketch asked for: a node
      // carries `id`, `kind`, `label`, `family`, `level`, `state` and `detail`
      // and no `role` at all, so that value would band nothing and the column
      // would silently draw one unlabelled heap. A person's role reaches the
      // drawing as the `member` EDGE into the middle column, which is where it
      // belongs — it is a relationship, not a property of the person.
      //
      // On this instance the band is one heap of one person, which is noise.
      // It is declared anyway: a config is instance-independent, and an app
      // with staff and agents both acting wants the two told apart at a glance.
      // The three column captions are `$t:` TOKENS, for the reason the matrix's
      // `cell.flag.label` gives one lens down: the component is translated
      // before `graph-resolver.ts` projects `columns` into the render-time
      // `graphView`, so a caption reaches the drawing — and the group name the
      // accessible twin announces — as words. A column heading is required by
      // the schema, which is what makes it authored vocabulary rather than
      // endpoint data; the `graphView` skip still covers everything that came
      // back from the read.
      {
        kinds: ['person', 'agent'],
        label: '$t:admin.organisation.map.column.principals',
        groupBy: 'kind',
      },
      {
        kinds: ['role', 'team', 'open'],
        label: '$t:admin.organisation.map.column.grantSources',
        sortBy: 'level',
        sortDirection: 'desc',
      },
      // Banded by family, exactly as the grid bands its rows. Nodes carrying no
      // `family` fall after the bands — and none should, because the endpoint
      // emits `family` on precisely the resource kinds.
      {
        kinds: ['table', 'page', 'form', 'bucket', 'agent-resource'],
        label: '$t:admin.organisation.map.column.resources',
        groupBy: 'family',
      },
    ],
    // `both`, not the schema's `downstream` default. An operator opens this lens
    // with one of two questions — "what can this role reach" (downstream) and
    // "who can reach this table" (upstream) — and which one they have depends on
    // the node they click, not on the config. `both` answers either from one
    // click; `downstream` would make every resource in the third column select
    // to nothing, since a resource is a sink.
    selection: { mode: 'single', reach: 'both' },
    legend: true,
    label: '$t:admin.organisation.map.label',
    emptyMessage: '$t:admin.organisation.map.empty',
  }) as PageComponent

/**
 * The map region.
 *
 * Same shape as the matrix region: the blurb keeps the findings column's reading
 * measure, and the drawing is given the whole column. A node-link fan is wider
 * than a sentence and narrower than nothing.
 */
const mapSection = (): PageComponent =>
  ({
    type: 'container',
    element: 'section',
    props: {
      'aria-label': '$t:admin.organisation.map.region',
      'data-testid': 'organisation-map',
      className: 'flex min-w-0 flex-col gap-3',
    },
    children: [
      text('p', 'text-foreground-subtle max-w-3xl text-sm', '$t:admin.organisation.map.blurb'),
      mapLens(),
    ],
  }) as PageComponent

/**
 * The Processes lens — one lane per automation, its steps chained along it.
 *
 * ─── THE SAME COMPONENT AS THE MAP, AND THAT IS THE POINT ──────────────────
 *
 * `layout: 'lanes'` rather than a fourth component type. Map, Agents and
 * Processes differ only in how the nodes are PLACED — the node and edge
 * vocabulary, the glyphs, state-by-weight, selection, the read and the
 * accessible twin are identical across all three. A separate type would have
 * duplicated every one of them for no new expressive power.
 *
 * ─── WHY THE STATIONS DECLARE NO SORT ──────────────────────────────────────
 *
 * Because the graph already answered it. A step edge runs
 * `automation -> step0 -> step1`, so the chain IS the order, and a sort key
 * here would let this config contradict the graph it is drawn from. The lanes
 * themselves do take one — see below.
 *
 * ─── AND WHY THE LANES DO ──────────────────────────────────────────────────
 *
 * `sortBy: 'label'` orders the lanes by automation name. The endpoint emits
 * them in declaration order, which is an authoring artifact: it is visible in
 * `app.ts` and nowhere at all to the operator reading this page. Nineteen lanes
 * in the order someone happened to write them is a list you can only search by
 * reading all of it. Alphabetical is the order a reader can predict, which is
 * the only property that matters when the question is "is `invoice-run` in
 * here, and what does it do".
 *
 * ─── NO LEGEND, WHERE THE MAP HAS ONE ──────────────────────────────────────
 *
 * The Map keys twelve node kinds onto twelve shapes a reader cannot decode from
 * the drawing, so it needs one. A lane has two kinds and they are told apart by
 * POSITION rather than by shape — the automation in the identity gutter, its
 * steps along the track — and each zone carries its own heading. A key mapping
 * two shapes a reader has already been told the names of is the restated label
 * [internal ref] §D4 names outright.
 *
 * ─── `reach: 'both'`, FOR A DIFFERENT REASON THAN THE MAP'S ────────────────
 *
 * The Map takes `both` because a resource is a sink and `downstream` would make
 * every node in its third column select to nothing. Here every node has a
 * downstream except the last station, so that argument does not apply — and
 * `both` is still right: an operator clicking a STEP is asking "what runs this,
 * and what else does it do", which is the whole lane in both directions, not
 * the tail of it.
 *
 * `label`, `emptyMessage` and both lane captions are `$t:` tokens, for the
 * reason the map documents one lens up: `resolveComponentTranslationTokens`
 * walks a component's own schema fields, and it now runs BEFORE the graph
 * resolver projects the lanes into `graphView`, so a caption reaches the
 * drawing as words.
 */
const processesLens = (): PageComponent =>
  ({
    type: 'graph',
    layout: 'lanes',
    dataSource: { system: { endpoint: ORGANISATION_GRAPH_ENDPOINT } },
    lanes: {
      kinds: ['automation'],
      // Both lane captions are `$t:` TOKENS, same path as the map's columns:
      // the component is translated before it is projected into `graphView`.
      label: '$t:admin.organisation.processes.lane',
      stations: { kinds: ['step'], label: '$t:admin.organisation.processes.stations' },
      sortBy: 'label',
    },
    selection: { mode: 'single', reach: 'both' },
    label: '$t:admin.organisation.processes.label',
    emptyMessage: '$t:admin.organisation.processes.empty',
  }) as PageComponent

/**
 * The processes region.
 *
 * Same shape as the map region, for the same reason: the blurb keeps the
 * findings column's reading measure and the drawing takes the whole column. A
 * lane is wider than a sentence — it is an identity gutter plus a station per
 * action — and the drawing scrolls inside its own box rather than widening the
 * page.
 */
const processesSection = (): PageComponent =>
  ({
    type: 'container',
    element: 'section',
    props: {
      'aria-label': '$t:admin.organisation.processes.region',
      'data-testid': 'organisation-processes',
      className: 'flex min-w-0 flex-col gap-3',
    },
    children: [
      text(
        'p',
        'text-foreground-subtle max-w-3xl text-sm',
        '$t:admin.organisation.processes.blurb'
      ),
      processesLens(),
    ],
  }) as PageComponent

export default withShell(
  {
    id: 'dashboard-organisation',
    name: 'dashboard-organisation',
    path: '/organisation',
    meta: { title: '$t:admin.meta.organisation', lang: 'en-US' },
    // `?tab=` is the address of each lens. Without this block `$query.tab` is
    // left verbatim, `defaultTab` selects a tab literally called `$query.tab`,
    // and the strip opens on Findings for every link with no error anywhere.
    query: tabQuery(TABS),
    // The page's own record: the whole graph body. It is what the two
    // empty-or-not gates test, and reading it here costs no extra fetch — the
    // system-value hook keys its query on the endpoint string, so this and the
    // findings list's rows binding are one request.
    //
    // No `requires`. `auth.groups` is a real capability, but an app with no
    // teams still has roles, tables and forms worth checking — and this
    // instance is the proof: it declares no groups and reports three findings.
    dataSource: { system: { endpoint: ORGANISATION_GRAPH_ENDPOINT } },
    components: [
      pageHeading('$t:admin.organisation.heading', '$t:admin.organisation.blurb'),
      // `fullWidth` rather than a bare strip: its `min-w-0` is what lets the
      // grid fill the content column instead of overflowing it. The findings
      // panel does not need it and is not harmed by it — the section inside
      // keeps its own reading measure.
      fullWidth(
        tabbedBody('$t:admin.organisation.tabs.region', TABS, [
          tabPanel([findingsSection()]),
          tabPanel([matrixSection()]),
          tabPanel([mapSection()]),
          tabPanel([reachSection()]),
          tabPanel([processesSection()]),
        ])
      ),
    ],
  },
  { breadcrumb: { organisation: '$t:admin.crumb.organisation' } }
)
