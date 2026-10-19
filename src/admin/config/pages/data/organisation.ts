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
//     `system-sources.ts`), so the notice below says a source failed and cannot
//     yet say which. Stated in the copy rather than silently omitted.
//
// ─── THE PRESENCE GATES ────────────────────────────────────────────────────
//
// `findings`, `degraded` and `exceptions` are REQUIRED arrays on the graph
// body, so each state on this page is a presence test on one of them:
// `isNotEmpty: true` draws the list, `isEmpty: true` draws the empty state, and
// the two are mutually exclusive by construction. Presence is the engine's one
// empty rule — missing, `null`, `''`, `[]` and `{}` are empty, nothing else is —
// the same rule a table filter compiles, so these gates say what they mean
// rather than riding on how a list happens to stringify.
//
// They used to be `eq: ''` / `neq: ''`, which worked only because
// `String([])` is the empty string. That spelling also calls a MISSING field
// present, which a required array never is here, so the swap changed no
// rendered state.
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

import { CARD_LIST_CLASS } from '../../components/card'
import {
  consolePage,
  emptyState,
  fullWidth,
  tabbedBody,
  tabPanel,
  tabQuery,
} from '../../components/data-page'
import { ORGANISATION_GRAPH_ENDPOINT } from '../../system-sources'
import { mapSection, matrixSection, processesSection, text } from './organisation-lenses'
import { REACH_TAB, reachSection } from './organisation-reach'
import type { Page as PageConfig } from '@/domain/models/app'

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
          // `src/admin/config/pages/design-system/brand.ts` reaches for the
          // dead spelling too; that is a live defect there, not a precedent.
          gatedText('span', 'text-error-fg text-sm font-medium', '$t:admin.organisation.critical', {
            field: 'severity',
            eq: 'critical',
          }),
          gatedText(
            'span',
            'text-foreground text-sm font-medium',
            '$t:admin.organisation.warning',
            {
              field: 'severity',
              eq: 'warning',
            }
          ),
          gatedText('span', 'text-foreground-subtle text-sm', '$t:admin.organisation.notice', {
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
          gatedText('span', 'text-foreground-subtle text-sm', '$t:admin.organisation.anonymous', {
            field: 'blastRadius',
            eq: 'unbounded',
          }),
          gatedText(
            'span',
            'text-foreground-subtle text-sm',
            '$t:admin.organisation.onePrincipal',
            {
              field: 'blastRadius',
              eq: 1,
            }
          ),
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
    visibility: { record: { field: 'findings', isNotEmpty: true } },
    children: [
      {
        // `list`, not a `container` with `element: 'ul'`: the container element
        // enum admits only sectioning elements, and this is the type whose
        // renderer already handles a data-bound child template.
        type: 'list',
        props: {
          className: `${CARD_LIST_CLASS}`,
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
    visibility: { record: { field: 'findings', isEmpty: true } },
    children: [
      emptyState(
        '$t:admin.organisation.noFindings',
        '$t:admin.organisation.noFindingsBody',
        '$t:admin.organisation.scope'
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
    visibility: { record: { field: 'degraded', isNotEmpty: true } },
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
      // The amber rule marks the layer as conclusions drawn OVER the lens
      // below it, not part of the drawing.
      className: 'flex max-w-3xl flex-col gap-3 border-l-2 border-amber-500/60 pl-4',
    },
    children: [
      text('p', 'text-foreground-subtle text-sm', '$t:admin.organisation.findings.blurb'),
      findingsList(),
      noFindings(),
    ],
  }) as PageComponent

export default consolePage({
  id: 'dashboard-organisation',
  path: '/organisation',
  title: '$t:admin.meta.organisation',
  heading: ['$t:admin.organisation.heading', '$t:admin.organisation.blurb'],
  page: {
    requires: ['auth', 'data'],
    // `?tab=` is the address of each lens. Without this block `$query.tab` is
    // left verbatim, `defaultTab` selects a tab literally called `$query.tab`,
    // and the strip opens on the Matrix for every link with no error anywhere.
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
  },
  shell: {
    breadcrumb: { organisation: '$t:admin.crumb.organisation' },
    // How many findings the read returns, above whichever lens is open.
    topbarFact: {
      type: 'container',
      element: 'div',
      props: {
        className: 'shrink-0 text-sm text-muted-foreground',
        'data-testid': 'organisation-findings-count',
      },
      children: [
        { type: 'text', element: 'span', content: '$record.findingsCount' },
        { type: 'text', element: 'span', content: ' ' },
        { type: 'text', element: 'span', content: '$t:admin.organisation.findingsFact' },
      ],
    } as PageComponent,
  },
  body: [
    // `fullWidth` rather than a bare strip: its `min-w-0` is what lets the
    // grid fill the content column instead of overflowing it. The findings
    // panel does not need it and is not harmed by it — the section inside
    // keeps its own reading measure.
    fullWidth(
      tabbedBody('$t:admin.organisation.tabs.region', TABS, [
        // The findings list sits on the Map, the lens that draws every
        // finding in place, and nowhere else. Above every lens it pushed the
        // Matrix below the fold on each visit, repeating three paragraphs a
        // reader had already read. The other lenses still mark what a
        // finding passes through, and the top bar's fact counts the findings
        // on every lens, read from the graph's `findingsCount`.
        //
        // The degraded notice heads EVERY lens: each one is drawn from the
        // same graph, so a source that could not be read makes every drawing
        // partial, not only the Map's.
        tabPanel([degradedNotice(), matrixSection()]),
        tabPanel([degradedNotice(), findingsSection(), mapSection()]),
        tabPanel([degradedNotice(), reachSection()]),
        tabPanel([degradedNotice(), processesSection()]),
      ])
    ),
  ],
})
