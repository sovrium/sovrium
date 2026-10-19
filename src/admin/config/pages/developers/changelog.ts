/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// DEVELOPERS · Changelog — the boot ledger of this instance, and the
// configuration it is currently running.
//
// ─── WHAT THIS SURFACE IS FOR, AND WHAT IT REPLACES ────────────────────────
//
// It stands where `/schema` stood. Schema answered ONE question — what is this
// app configured to be, right now — and answered it well. What it could not
// answer is the question an operator actually arrives with: *when did that
// change, and to what?* A console that shows only the present tense makes every
// "it worked last week" into an archaeology exercise against git, on a machine
// that already holds the answer.
//
// So Schema's body is not deleted. It is re-homed as the HEAD of the ledger —
// `?view=current` — and the ledger itself becomes the page. The two are one
// subject read at two depths: what booted, and what has booted.
//
// ─── READ-ONLY, AND STRUCTURALLY SO ────────────────────────────────────────
//
// [internal ref] amendment **A6** (ratified 2026-09-16), surface 8. A6 extends A1's
// invariant — reading the running configuration is observability, mutating it
// is authoring — with the one question A1 could not state, because A1 had no
// ledger to reason about:
//
//   has what this surface describes already happened?
//
// Every row here describes a boot that already ran. That is what separates this
// from D1's refused "version ledger, history, diff", whose referent is [internal ref]'s
// *draft* store: a ledger of boots holds no candidate configuration and stages
// nothing. Both sides of every diff are boots that happened — never an uploaded
// file, never a working copy, never a configuration typed into the console.
//
// There is no revert, no rollback and no re-deploy here, and their absence is
// A6's ruling rather than an unfinished feature: restoring a previous
// configuration CHANGES what the instance runs, and the way to do that is
// `git revert` and redeploy. This ledger records that channel; it does not
// replace it.
//
// ─── SIX THINGS THE CANVAS DRAWS THAT CONFIG CANNOT SAY ────────────────────
//
// Recorded rather than silently dropped, because each is a platform bound with a
// shipped substitute rather than a decision taken on this surface.
//
//  1. `?release=<hash>` AS A VIEW SWITCH. Planned that way, and not expressible:
//     `page.query` REQUIRES a closed `enum` (`PageQueryPropSchema`), an
//     out-of-list URL value clamps to the default, and `visibility.query` values
//     are checked at DECODE against that same enum. A ledger address belongs to
//     the HOST instance and a platform-owned preset compiled into the binary
//     cannot enumerate one. A path segment carries no allow-list, so one boot is
//     `/changelog/:hash` — the shape `/decisions/:id`, `/links/:slug` and
//     `/tables/:table` already take. `?view=current` IS enumerable (two values)
//     and stays a query, which is what keeps the founder's address for it exact.
//
//  2. THE CHROME-BAR TOTALS. The canvas prints `N releases since <date> · N
//     engine migrations · N schema changes` as bar facts. The endpoint publishes
//     all of them flat for exactly that, and no config path renders a
//     system-bound scalar as bar text — the `chromeEnd` gap the decisions
//     register already records. They are NOT relocated to a `kpi` strip: a `kpi`
//     is a lazy island, the canvas draws no tiles on this surface, and the oldest
//     row's own date IS `since`, which the timeline already prints.
//
//  3. THE CONFIG DIFF, INLINE. The canvas draws it as the climax of a release.
//     `diff` is an ARRAY OF STRINGS, and a component rows binding returns `[]`
//     for anything that is not an array of objects (`system-rows-fetcher.ts`),
//     so a diff line has no field to address. The deeper bound is that the array
//     has no ceiling: measured on this console's own ledger, one row carried
//     **70,255** lines. A page that renders it is a page that sometimes does not
//     load. The shipped substitute is the shape of the diff — `+added −removed`,
//     the generated summary, and the derived DDL and engine migrations as real
//     lists — plus `Export diff`, which is the canvas's own affordance and hands
//     the operator the whole thing without rendering it. Those two ARE the
//     substantive answer in any case: what an operator needs from a boot is what
//     it did to their database, and the textual diff is how they check it.
//
//  4. A NEWEST-FIRST SORT CONTROL. The read is already newest-first by contract
//     and there is nothing to ask for; a control that redraws and reorders
//     nothing is worse than no control.
//
//  5. A READABLE TIMESTAMP — now said by the engine. A `text` takes no
//     `format`, so the row printed the ISO instant whole. A system record's ISO
//     dates now carry their text in the page language and the operator zone
//     (`systemRecordWithText`), so `$record.bootedAt` prints a date and a time
//     and `$record.bootedAt.raw` keeps the stamp.
//
//  6. THE VERTICAL FAMILY COLUMN. `?view=current` keeps Schema's family
//     navigation, as the wrapping chip RAIL Schema shipped for widths below
//     `lg` — at every width. `withShell`'s nav column is one static array for the
//     whole page, so a column that belongs to one of two views would render an
//     empty 224px gutter beside the timeline. Same links, same `activeWhen`,
//     laid out horizontally.
//
// ─── WHAT THE `current` VIEW KEEPS FROM SCHEMA, AND WHY ────────────────────
//
// Two things a preset page cannot compute: the declaration TREE over seven
// families, and the whole redacted config as a JSON string (config has no
// `JSON.stringify`). `/api/admin/config/declarations` publishes the first as
// rows, one family at a time; `/api/admin/config/reflection` publishes the
// second as `appJson` — admitted although endpoints publish facts rather than
// words, because a pretty-printed
// serialization of an object the platform already publishes carries no word, no
// label and no ordering meant to be read, and a caller could recompute it
// byte-for-byte while this console cannot.
//
// The family HEADINGS are this page's words and stay here, gated on the flat
// counts the reflection record publishes. That is what keeps the retired
// builder's promise that a family the config does not declare is OMITTED rather
// than rendered as a heading over an empty box — an operator reading this page
// wants their instance, not a catalogue of everything Sovrium could have been
// configured to do.
//
// Redaction happens SERVER-side, before serialisation, on BOTH halves of this
// page. A1 rules that a config-reflection endpoint leaking a secret "is not a
// defective implementation of an authorised surface, it is an unauthorised
// surface", so masking in this config would not be redaction: the payload is the
// boundary the browser, any intermediary proxy and the error tracker all see.
// A6 moves that boundary one step earlier for the ledger, because the ledger
// PERSISTS: a row redacted on the way out is a plaintext credential at rest.
//
// ─── WHY THE PAGE RECORD IS THE REFLECTION AND NOT THE LEDGER ──────────────
//
// A page binds exactly ONE record, and the reflection envelope is flat with no
// array in it — so `appJson` and the seven counts are reachable only as the page
// record. The ledger, being an array under a key, is reachable as a ROWS binding
// from inside the timeline, and a page may carry a record and a rows binding at
// once. The other way round does not work at all.
//
// It costs the list view one in-process read of the reflection envelope it does
// not render (~20ms, measured). It does NOT cost any view that envelope's
// bytes: no node binds `appJson` — the overview summarises the counts and hands
// the document over through `Export JSON`, so it reaches the wire nowhere.
//
// ─── A LIVE DATA DEFECT THIS PAGE DISPLAYS FAITHFULLY ──────────────────────
//
// Measured on this console's own preview, 2026-09-17: two consecutive boots of a
// BYTE-IDENTICAL config alternate between two config hashes and write a row each
// time, with a ~35,000-line diff in each direction. The diff's content names the
// cause — one snapshot carries `$t:` tokens and the next carries their resolved
// English strings, so the capture races the translation-resolution pass. That is
// a platform defect in the capture, reported to `[internal ref]`; it is
// NOT compensated for here. A console that hid noisy rows would be a console
// that hides rows.

import { CARD_LIST_CLASS, CARD_SURFACE } from '../../components/card'
import { consolePage, toolbarRow } from '../../components/data-page'
import {
  CONFIG_DECLARATIONS_ENDPOINT,
  CONFIG_REFLECTION_ENDPOINT,
  RELEASE_DETAIL_ENDPOINT,
  RELEASE_DETAIL_ROWS_ENDPOINT,
} from '../../system-sources'
import { ledgerBody, ledgerSearch } from './changelog-ledger'
import { rawConfigCard } from './changelog-raw-config'
import type { Page as PageConfig } from '@/domain/models/app'

/** One node of a page's component tree, as the config type expresses it. */
type PageComponent = NonNullable<PageConfig['components']>[number]

/** The timeline of boots — what a bare `/changelog` opens on. */
const VIEW_LIST = 'list'

/** The configuration as this instance booted it — Schema's body, re-homed. */
const VIEW_CURRENT = 'current'

/** The pane a bare `?view=current` opens on: the counts and the whole config. */
const OVERVIEW = 'overview'

/**
 * The seven declaration families, in the order `AppSchema` declares them, each
 * with the flat count the reflection record publishes for it.
 *
 * ONE table, read three times — by the family rail, by the `?family=` allow-list
 * and by the pane's own gate — so a family cannot be navigable and
 * unaddressable, or addressable and unnamed.
 */
const FAMILIES = [
  { id: 'tables', label: '$t:admin.schema.counts.tables', countField: 'tableCount' },
  { id: 'pages', label: '$t:admin.schema.counts.pages', countField: 'pageCount' },
  { id: 'forms', label: '$t:admin.schema.counts.forms', countField: 'formCount' },
  {
    id: 'automations',
    label: '$t:admin.schema.counts.automations',
    countField: 'automationCount',
  },
  { id: 'agents', label: '$t:admin.schema.counts.agents', countField: 'agentCount' },
  { id: 'buckets', label: '$t:admin.schema.counts.buckets', countField: 'bucketCount' },
  {
    id: 'connections',
    label: '$t:admin.schema.counts.connections',
    countField: 'connectionCount',
  },
] as const

// ─── SHARED LEAVES ─────────────────────────────────────────────────────────

/** A plain text node. */
const text = (element: string, className: string, content: string): PageComponent =>
  ({ type: 'text', element, props: { className }, content }) as PageComponent

/** A quiet uppercase micro-label used as a section heading. */
const sectionLabel = (content: string): PageComponent =>
  text('h2', 'text-foreground-subtle text-sm font-medium tracking-wide uppercase', content)

/** A bordered card holding labelled content. */
const card = (children: readonly PageComponent[]): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className: `${CARD_SURFACE} flex flex-col gap-3 p-5`,
    },
    children,
  }) as PageComponent

/**
 * Render a value only where the record HAS one.
 *
 * `isNotEmpty: true` reads the one empty rule every surface shares: a missing
 * key, `null`, `''`, `[]` and `{}` are all "no value here". This ledger needs
 * several of them — `version` is `null` on a config that declares none,
 * `previousUnavailable` is omitted rather than false, and the detail's
 * `schemaChanges` / `engineMigrations` are lists that may be empty — and one
 * operator covers every spelling.
 */
const whereSet = (field: string) => ({ record: { field, isNotEmpty: true } }) as const

/** Render a value only where the record has NONE — the exact complement of the above. */
const whereUnset = (field: string) => ({ record: { field, isEmpty: true } }) as const

// ─── THE TIMELINE ──────────────────────────────────────────────────────────

/**
 * The one link between the two views, in each direction.
 *
 * A link and not a tab strip: `tabbedBody` hosts its panels inside a `tabs`
 * island, which serialises BOTH panels into `data-island-props` — and one of
 * these two panels is a 6.8 MB JSON blob.
 */
const currentConfigLink = (): PageComponent =>
  ({
    type: 'link',
    content: '$t:admin.changelog.toCurrent',
    props: {
      href: `/changelog?view=${VIEW_CURRENT}`,
      'data-testid': 'changelog-to-current',
      className: 'text-muted-foreground hover:text-foreground text-sm underline sm:ml-auto',
    },
  }) as PageComponent

/** The timeline view — the default, and what the sidebar row lands on. */
const ledgerView = (): PageComponent =>
  ({
    type: 'container',
    element: 'section',
    visibility: { query: { name: 'view', eq: VIEW_LIST } },
    props: {
      'aria-label': '$t:admin.changelog.ledger.region',
      className: 'flex flex-col gap-4',
    },
    children: [
      // How many starts the ledger holds, from the page's own record: the
      // reflection read counts them, since a page binds one record.
      {
        type: 'text',
        element: 'p',
        props: {
          className: 'text-muted-foreground text-sm tabular-nums',
          'data-testid': 'changelog-starts',
        },
        content: '$record.startsLabel',
      } as PageComponent,
      toolbarRow([ledgerSearch(), currentConfigLink()]),
      ...ledgerBody(),
    ],
  }) as PageComponent

// ─── `?view=current` — THE CONFIGURATION AS BOOTED ─────────────────────────

/** The class of an unselected family chip, and of the one being read. */
const CHIP =
  'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
const CHIP_CURRENT =
  'flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 text-sm font-medium text-foreground'

/**
 * One family chip: a real LINK to `?view=current&family=<id>`, marked current by
 * value.
 *
 * Links rather than buttons because each addresses a different document: back
 * and forward move between families for free, a shared link carries the family
 * it was read at, and a reload survives it.
 *
 * `activeWhen` compares `$query.family`, which the substitution passes have
 * already resolved to a literal by the time it is evaluated; `activeProps` is
 * MERGED over `props` key by key, so the class is swapped rather than
 * concatenated. The alternative — a visibility gate — needs two chips to render
 * one, each duplicating an href and a label so the two can drift.
 *
 * @param countField - when present, the chip carries that count and is HIDDEN
 *   when it is zero. The overview chip passes none: it is always reachable.
 */
const familyChip = (config: {
  readonly id: string
  readonly label: string
  readonly countField?: string
}): PageComponent =>
  ({
    type: 'link',
    props: {
      href: `/changelog?view=${VIEW_CURRENT}&family=${config.id}`,
      className: CHIP,
      'data-testid': `config-schema-rail-${config.id}`,
    },
    activeWhen: { value: '$query.family', equals: config.id },
    activeProps: { 'aria-current': 'page', className: CHIP_CURRENT },
    ...(config.countField === undefined
      ? {}
      : { visibility: { record: { field: config.countField, gt: 0 } } }),
    children: [
      { type: 'text', element: 'span', content: config.label },
      ...(config.countField === undefined
        ? []
        : [
            {
              type: 'text',
              element: 'span',
              props: { className: 'text-foreground-subtle font-mono text-sm' },
              content: `$record.${config.countField}`,
            },
          ]),
    ],
  }) as PageComponent

/** The family navigation, as a wrapping chip rail, at every width. */
const familyRail = (): PageComponent =>
  ({
    type: 'container',
    element: 'nav',
    props: {
      'aria-label': '$t:admin.schema.nav.region',
      'data-testid': 'config-schema-nav-rail',
      className: 'border-border flex flex-wrap gap-1 border-b pb-3',
    },
    children: [
      familyChip({ id: OVERVIEW, label: '$t:admin.schema.nav.overview' }),
      ...FAMILIES.map((family) =>
        familyChip({ id: family.id, label: family.label, countField: family.countField })
      ),
      // The one line that appears when every chip beside it is hidden — an app
      // that declares nothing at all. It gates on the TOTAL, so it and the chips
      // can never both be absent.
      {
        ...(text(
          'p',
          'text-foreground-subtle px-2 py-1 text-sm',
          '$t:admin.schema.declared.empty'
        ) as object),
        visibility: { record: { field: 'declarationCount', eq: 0 } },
      } as PageComponent,
    ],
  }) as PageComponent

/**
 * The provenance card. It names where configuration is AUTHORED, so an operator
 * who came here to change something leaves knowing where to go — the read-only
 * posture is explained rather than merely enforced.
 */
const provenanceCard = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className: `${CARD_SURFACE} flex flex-col gap-1 p-4`,
      'data-testid': 'config-schema-provenance',
    },
    children: [
      text('p', 'text-foreground text-md font-medium', '$t:admin.schema.readOnly.heading'),
      text(
        'p',
        'text-foreground-subtle max-w-2xl text-md leading-relaxed',
        '$t:admin.locked.audit.schema.readOnlyNotice'
      ),
    ],
  }) as PageComponent

/** One declaration row: its identifier, and the parts it is composed of. */
const declarationRow = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-col gap-0.5 px-3 py-2' },
    children: [
      text('span', 'text-foreground font-mono text-sm', '$record.label'),
      // The detail renders UNGATED: an absent `$record.*` field substitutes to
      // the empty string rather than surviving as a literal, so a declaration
      // with no second level yields an empty span and no visible text.
      text('span', 'text-foreground-subtle font-mono text-sm', '$record.detail'),
    ],
  }) as PageComponent

/**
 * The declarations of the SELECTED family.
 *
 * ONE list, not seven. `$query.family` resolves into the read's own query
 * server-side — the substitution pass walks every string of the component tree,
 * `dataSource.system.query` included — so the pane is the same component
 * whichever family is open, and a family cannot acquire a rendering the others
 * do not have.
 *
 * Gated on the `in` list rather than on "not overview", because the enum clamps
 * an unknown `?family=` to the default and the gate must then agree with it: a
 * negative test would render this pane for a value the read cannot answer.
 */
const familyPane = (): PageComponent =>
  ({
    type: 'container',
    element: 'section',
    visibility: { query: { name: 'family', in: FAMILIES.map((family) => family.id) } },
    props: {
      'aria-label': '$t:admin.schema.declared.region',
      'data-testid': 'config-schema-tree',
      className: 'flex flex-col gap-3',
    },
    children: [
      sectionLabel('$t:admin.schema.declared.heading'),
      {
        type: 'list',
        props: {
          className: `${CARD_LIST_CLASS}`,
        },
        dataSource: {
          system: {
            endpoint: CONFIG_DECLARATIONS_ENDPOINT,
            rowsKey: 'declarations',
            idKey: 'label',
            query: { family: '$query.family' },
          },
        },
        children: [declarationRow()],
      } as PageComponent,
    ],
  }) as PageComponent

/** The overview pane: what is declared, in one figure, then the whole config. */
const overviewPane = (): PageComponent =>
  ({
    type: 'container',
    element: 'section',
    visibility: { query: { name: 'family', eq: OVERVIEW } },
    props: {
      'aria-label': '$t:admin.schema.nav.overview',
      'data-testid': 'config-schema-overview',
      className: 'flex flex-col gap-6',
    },
    children: [
      provenanceCard(),
      text(
        'p',
        'text-muted-foreground max-w-2xl text-md leading-relaxed',
        '$t:admin.schema.overview.body'
      ),
      rawConfigCard(FAMILIES),
    ],
  }) as PageComponent

/** Back to the timeline from the current-configuration view. */
const backToLedger = (): PageComponent =>
  ({
    type: 'link',
    content: '$t:admin.changelog.back',
    props: {
      href: '/changelog',
      'data-testid': 'changelog-back',
      className: 'text-muted-foreground hover:text-foreground text-sm underline',
    },
  }) as PageComponent

/**
 * The view's own title.
 *
 * The `h1` and the trail's last crumb both say "Changelog" on both views — a
 * query parameter cannot add a crumb — so without this a reader arriving at
 * `?view=current` meets a configuration tree under a heading that says
 * *changelog*. One `h2` is what tells them which of the two they are in.
 */
const currentHeading = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-wrap items-baseline gap-x-3 gap-y-1' },
    children: [
      text('h2', 'text-foreground text-lg font-medium', '$t:admin.changelog.current.heading'),
      text('span', 'text-foreground-subtle font-mono text-sm', '$record.declarationCount'),
      text('span', 'text-foreground-subtle text-sm', '$t:admin.changelog.current.declarations'),
    ],
  }) as PageComponent

/** `?view=current` — Schema's whole body, under the ledger's roof. */
const currentView = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    visibility: { query: { name: 'view', eq: VIEW_CURRENT } },
    props: { className: 'flex flex-col gap-6' },
    children: [
      toolbarRow([backToLedger()]),
      currentHeading(),
      familyRail(),
      overviewPane(),
      familyPane(),
    ],
  }) as PageComponent

// ─── THE LEDGER PAGE ───────────────────────────────────────────────────────

const ledgerPage: PageConfig = consolePage({
  id: 'dashboard-changelog',
  path: '/changelog',
  title: '$t:admin.meta.changelog',
  heading: ['$t:admin.changelog.heading', '$t:admin.changelog.blurb'],
  visibleHeading: true,
  page: {
    // Without this block `$query.view` and `$query.family` are left VERBATIM —
    // no gate matches, no chip marks itself current, and the declarations read
    // asks for a family literally called `$query.family`. The `enum` is the
    // allow-list; a value outside it CLAMPS to the default, which is what makes
    // `?view=<anything>` answer 200 on the timeline.
    query: {
      view: { default: VIEW_LIST, enum: [VIEW_LIST, VIEW_CURRENT] },
      family: { default: OVERVIEW, enum: [OVERVIEW, ...FAMILIES.map((family) => family.id)] },
    },
    dataSource: { system: { endpoint: CONFIG_REFLECTION_ENDPOINT } },
  },
  shell: { breadcrumb: { changelog: '$t:admin.crumb.changelog' }, document: true },
  body: [
    {
      type: 'container',
      element: 'div',
      props: { className: 'flex flex-col gap-6' },
      children: [ledgerView(), currentView()],
    } as PageComponent,
  ],
})

// ─── ONE BOOT ──────────────────────────────────────────────────────────────

/** One label-and-value row of the boot rail. */
const railRow = (label: string, value: PageComponent, gate?: object): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'flex items-baseline justify-between gap-4' },
    ...(gate === undefined ? {} : { visibility: gate }),
    children: [
      {
        type: 'text',
        element: 'span',
        props: { className: 'text-foreground-subtle shrink-0 text-sm' },
        content: label,
      },
      value,
    ],
  }) as PageComponent

/**
 * A rail value.
 *
 * `min-w-0 break-words text-right` on every one of them: the rail is 288px at
 * `lg` and a config hash beside a long timestamp has to be allowed to wrap
 * rather than push its own label out of the box.
 */
const railText = (content: string, extra = 'text-foreground'): PageComponent =>
  ({
    type: 'text',
    element: 'span',
    props: { className: `${extra} min-w-0 text-right text-sm break-words` },
    content,
  }) as PageComponent

/**
 * The boot rail: what ran, when, on which engine, and against which predecessor.
 *
 * `Config` prints this row's hash and the previous one's — the two sides of the
 * diff — because that pair is the only thing on the page that lets an operator
 * check the ledger against `git log` by hand.
 *
 * `Previous engine` shows whenever a predecessor exists, INCLUDING where it
 * equals `Engine` — usually. There is no field-to-field comparison in
 * `visibility.record` (its operators compare a field against a LITERAL), so
 * "show only when the engine moved" is not expressible, and the row is kept
 * rather than dropped: an operator opening a release wants to confirm the binary
 * did not change at least as often as to learn that it did, and this is the only
 * place either answer is written down.
 */
const bootRail = (): PageComponent =>
  ({
    type: 'container',
    element: 'aside',
    props: {
      'aria-label': '$t:admin.changelog.boot.region',
      'data-testid': 'changelog-boot-rail',
      className: `${CARD_SURFACE} flex shrink-0 flex-col gap-3 p-4 lg:w-72`,
    },
    children: [
      {
        type: 'text',
        element: 'h3',
        props: { className: 'text-foreground text-sm font-medium' },
        content: '$t:admin.changelog.boot.heading',
      },
      railRow(
        '$t:admin.changelog.field.version',
        railText('$record.version', 'text-foreground font-mono'),
        whereSet('version')
      ),
      railRow(
        '$t:admin.changelog.field.bootedAt',
        railText('$record.bootedAt', 'text-foreground font-mono')
      ),
      railRow(
        '$t:admin.changelog.field.bootedBy',
        railText('$record.bootedBy', 'text-foreground font-mono')
      ),
      railRow(
        '$t:admin.changelog.field.engine',
        railText('$record.engineVersion', 'text-foreground font-mono')
      ),
      railRow(
        '$t:admin.changelog.field.previousEngine',
        railText('$record.previousEngineVersion', 'text-foreground-subtle font-mono'),
        whereSet('previousEngineVersion')
      ),
      railRow(
        '$t:admin.changelog.field.config',
        railText('$record.configHash', 'text-foreground font-mono')
      ),
      railRow(
        '$t:admin.changelog.field.previousConfig',
        railText('$record.previousConfigHash', 'text-foreground-subtle font-mono'),
        whereSet('previousConfigHash')
      ),
    ],
  }) as PageComponent

/**
 * The diff, as its SHAPE and a download.
 *
 * `diff` is an array of STRINGS, and a component rows binding returns `[]` for
 * anything that is not an array of objects — a diff line has no field to
 * address. Even where it did, the array has no ceiling: 70,255 lines measured on
 * this console's own ledger. So the page states the size honestly and hands the
 * whole thing over as a file, which is also what an operator does with a diff.
 *
 * The baseline row has no previous boot, so its diff is EMPTY by contract rather
 * than by failure, and it says so in its own words instead of printing `+0 −0`.
 * `previousUnavailable` is the third case — a predecessor retention has pruned —
 * and it is distinct from the baseline, whose `previousConfigHash` is null.
 */
const diffSection = (): PageComponent =>
  card([
    {
      type: 'container',
      element: 'div',
      props: { className: 'flex flex-wrap items-center justify-between gap-2' },
      children: [
        sectionLabel('$t:admin.changelog.diff.heading'),
        {
          type: 'button',
          // A LITERAL, for the reason `Export JSON` above carries.
          label: '$t:admin.changelog.exportDiff',
          variant: 'secondary',
          // Offered only where there is a diff: the baseline boot has nothing
          // before it, and a download of nothing is a control with no outcome.
          visibility: whereSet('previousConfigHash'),
          props: { type: 'button', 'data-testid': 'changelog-export-diff' },
          action: {
            type: 'fetch',
            mode: 'download',
            url: RELEASE_DETAIL_ROWS_ENDPOINT,
            filename: 'release-$param.hash.json',
          },
        } as PageComponent,
      ],
    } as PageComponent,
    {
      ...(text(
        'p',
        'text-foreground font-mono text-md',
        '+$record.added −$record.removed'
      ) as object),
      props: {
        className: 'text-foreground font-mono text-md',
        'data-testid': 'changelog-diff-counts',
      },
      visibility: whereSet('previousConfigHash'),
    } as PageComponent,
    {
      ...(text(
        'p',
        'text-muted-foreground max-w-2xl text-md leading-relaxed',
        '$t:admin.changelog.diff.baseline'
      ) as object),
      props: {
        className: 'text-muted-foreground max-w-2xl text-md leading-relaxed',
        'data-testid': 'changelog-diff-baseline',
      },
      visibility: whereUnset('previousConfigHash'),
    } as PageComponent,
    {
      ...(text(
        'p',
        'text-muted-foreground max-w-2xl text-md leading-relaxed',
        '$t:admin.changelog.diff.pruned'
      ) as object),
      visibility: { record: { field: 'previousUnavailable', eq: true } },
    } as PageComponent,
    // Gated with the counts above it: on the baseline row there is no diff to
    // say anything about, and the sentence beside it already says why.
    {
      ...(text(
        'p',
        'text-foreground-subtle max-w-2xl text-sm leading-relaxed',
        '$t:admin.changelog.diff.redaction'
      ) as object),
      visibility: whereSet('previousConfigHash'),
    } as PageComponent,
  ])

/**
 * The derived DDL the engine applied to the operator's own tables.
 *
 * Derived from the two snapshots rather than observed from the transaction —
 * A6's own wording is "the app-table DDL the engine *derived* from `tables`" —
 * and the two agree wherever an operator could tell: an unchanged `tables`
 * derives nothing and also skips the initializer.
 */
const schemaChangesSection = (): PageComponent =>
  card([
    sectionLabel('$t:admin.changelog.ddl.heading'),
    {
      type: 'list',
      props: {
        'aria-label': '$t:admin.changelog.ddl.heading',
        'data-testid': 'changelog-schema-changes',
        className: 'divide-border flex flex-col divide-y',
      },
      dataSource: {
        system: {
          endpoint: RELEASE_DETAIL_ROWS_ENDPOINT,
          rowsKey: 'schemaChanges',
          idKey: 'statement',
        },
      },
      // The array is EMPTY-gated below rather than here: `emptyMessage` belongs
      // to `table`, and a `list` whose rows resolve to none deletes its template.
      visibility: whereSet('schemaChanges'),
      children: [
        {
          type: 'container',
          element: 'div',
          props: { className: 'flex flex-col gap-0.5 py-2' },
          children: [
            text('span', 'text-foreground font-mono text-sm break-words', '$record.statement'),
            text('span', 'text-foreground-subtle font-mono text-sm', '$record.table'),
          ],
        } as PageComponent,
      ],
    } as PageComponent,
    // The other half of the gate: `whereUnset` is the exact complement of
    // `whereSet`, so exactly one of the list and this sentence renders.
    {
      ...(text(
        'p',
        'text-muted-foreground max-w-2xl text-md leading-relaxed',
        '$t:admin.changelog.ddl.empty'
      ) as object),
      props: {
        className: 'text-muted-foreground max-w-2xl text-md leading-relaxed',
        'data-testid': 'changelog-schema-changes-empty',
      },
      visibility: whereUnset('schemaChanges'),
    } as PageComponent,
  ])

/**
 * The engine migrations drizzle applied SINCE THE PREVIOUS ROW, which is
 * deliberately wider than "at this boot".
 *
 * A boot that upgrades the engine without touching the configuration changes
 * neither the version nor the hash, so under A6 it writes no row while applying
 * real migrations; attributing them to the next row that IS written is what keeps
 * the ledger complete. On the baseline row it is every migration
 * `__drizzle_migrations` holds — the honest statement that this is the engine
 * state the ledger starts from.
 */
const engineMigrationsSection = (): PageComponent =>
  card([
    sectionLabel('$t:admin.changelog.migrations.heading'),
    {
      // Folded to a short scrolling box: a baseline row lists every migration
      // the engine ever applied. The box takes focus so a keyboard can scroll it.
      type: 'list',
      props: {
        'aria-label': '$t:admin.changelog.migrations.heading',
        'data-testid': 'changelog-engine-migrations',
        tabIndex: 0,
        className:
          'divide-border flex max-h-48 flex-col divide-y overflow-y-auto rounded-md border border-border px-3 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none',
      },
      dataSource: {
        system: {
          endpoint: RELEASE_DETAIL_ROWS_ENDPOINT,
          rowsKey: 'engineMigrations',
          idKey: 'folder',
        },
      },
      visibility: whereSet('engineMigrations'),
      children: [
        {
          type: 'container',
          element: 'div',
          props: { className: 'flex items-baseline justify-between gap-3 py-2' },
          children: [
            text('span', 'text-foreground min-w-0 font-mono text-sm break-words', '$record.folder'),
            text('span', 'text-foreground-subtle shrink-0 font-mono text-sm', '$record.statements'),
          ],
        } as PageComponent,
      ],
    } as PageComponent,
    {
      ...(text(
        'p',
        'text-muted-foreground max-w-2xl text-md leading-relaxed',
        '$t:admin.changelog.migrations.empty'
      ) as object),
      props: {
        className: 'text-muted-foreground max-w-2xl text-md leading-relaxed',
        'data-testid': 'changelog-engine-migrations-empty',
      },
      visibility: whereUnset('engineMigrations'),
    } as PageComponent,
  ])

/**
 * `/changelog/:hash` — one boot, read in full.
 *
 * The `h1` names the SURFACE and the trail's last crumb names the object, which
 * is the object-sub-page convention `/tables/:table` and `/decisions/:id` already
 * follow: a screen-reader user gets "what kind of page is this" from the heading
 * and "which one" from the trail. The visible title is an `h2`, because it is the
 * boot's and not the page's.
 *
 * The page RECORD is the per-hash read — `param: 'hash'` injects the route
 * segment into the endpoint's `:hash` slot — so unlike the decisions document
 * this page fetches ONE row rather than filtering the whole register. An address
 * naming no row is the endpoint's 404, which is the page's 404: there is no
 * partial render to explain, and no row template to be deleted at zero rows.
 *
 * `meta.title` cannot name the boot: the route-param pass walks `components` and
 * `layout`, deliberately not `meta`.
 */
const releasePage: PageConfig = consolePage({
  id: 'dashboard-changelog-release',
  path: '/changelog/:hash',
  title: '$t:admin.meta.release',
  heading: ['$t:admin.changelog.one.heading', '$t:admin.changelog.one.blurb'],
  page: {
    dataSource: { system: { endpoint: RELEASE_DETAIL_ENDPOINT, param: 'hash', idKey: 'id' } },
  },
  shell: { breadcrumb: { changelog: '$t:admin.crumb.changelog' }, document: true },
  body: [
    {
      type: 'container',
      element: 'div',
      props: { className: 'flex flex-col gap-6 pt-2' },
      children: [
        toolbarRow([backToLedger()]),
        {
          type: 'container',
          element: 'div',
          props: { className: 'flex flex-wrap items-baseline gap-x-3 gap-y-1' },
          children: [
            text(
              'h2',
              'text-foreground font-mono text-lg font-medium',
              '$record.version|$record.configHash'
            ),
            text('span', 'text-muted-foreground text-md', '$record.summary'),
          ],
        } as PageComponent,
        {
          type: 'container',
          element: 'div',
          props: { className: 'flex flex-col gap-6 lg:flex-row lg:items-start' },
          children: [
            {
              type: 'container',
              element: 'div',
              props: { className: 'flex min-w-0 flex-1 flex-col gap-4' },
              children: [diffSection(), schemaChangesSection(), engineMigrationsSection()],
            } as PageComponent,
            bootRail(),
          ],
        } as PageComponent,
      ],
    } as PageComponent,
  ],
})

/** The ledger and the one boot that reads out of it. */
export const changelogPages: readonly PageConfig[] = [ledgerPage, releasePage]
