/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// Environment — which declared `app.env[]` variables this instance resolved,
// and from which rung. Never a value, and never a `process.env` dump.
//
// ─── WHY THIS ONE WAS THE LAST BUILDER, AND WHY IT IS NOT ANY MORE ─────────
//
// It was the deliberate seam of the previous wave. Its row list is one `<li>`
// per declared variable with a `data-testid` keyed on the variable NAME, and
// system rows could only reach a page through a FIXED island shape — a
// a table's columns, a gallery card, `list` + `listDisplay.itemTemplate`.
// None of those can mint a per-row attribute, so converting it would have
// replaced a scannable list with an eight-column grid and rewritten the spec to
// match. That is a UX decision, not a migration, and it was refused.
//
// `expandDataSourceChildren` now has a `{ system }` path
// (`system-rows-template-resolver.ts`): an arbitrary child template is cloned
// once per row, server-side, on the CALLER's credentials, with `$record.*`
// substituted into props as well as content. The blocker is gone, so the seam
// closes with the layout intact rather than by conceding it.
//
// ─── WHY THE ENDPOINT GREW A FIELD ─────────────────────────────────────────
//
// `visibility.record` evaluates ONE field against one operator. It has no
// conjunction and — measured, not assumed — no presence test: `exists` decodes
// and is then DROPPED (`visibility.test.ts`, "DROPS an operator outside the
// shared vocabulary"), leaving a predicate that matches everything. So
// "a default is declared AND its literal is withheld" — the row hint that earns
// this page for the credential-shaped majority — was not expressible over
// `hasDefault` x `defaultValue`.
//
// `defaultState` collapses the two into the one three-way fact a declarative
// reader can gate on. It is a derived FACT, not a label: no English crosses the
// wire, and the copy below stays here. `hasDefault` and `defaultValue` keep
// their exact meanings for every existing consumer.
//
// ─── STATUS IS TYPOGRAPHY, NOT COLOUR ────────────────────────────
//
// The set/unset indicator is weight and de-emphasis, never a green/amber pill.
// A console that paints "not set" amber implies the operator did something
// wrong; most unset variables are optional and unset on purpose.
//
// ─── NO VALUE, NO CONTROL ([internal ref] A1) ─────────────────────────────────────
//
// No edit affordance, no write endpoint, no reveal. The page binds one READ and
// renders it. Values are configured in the deployment environment, and the
// provenance card says so, so an operator who came here to fix one knows where
// to go.

import { pageHeading } from '../components/dataPage'
import { withShell } from '../components/shell'
import { ENV_ENDPOINT } from '../systemSources'
import type { PageConfig } from 'sovrium'

/** One node of a page's component tree, as the config type expresses it. */
type PageComponent = NonNullable<PageConfig['components']>[number]

/** A plain text node — the recurring leaf of this page's row template. */
const text = (element: string, className: string, content: string): PageComponent =>
  ({ type: 'text', element, props: { className }, content }) as PageComponent

/**
 * A text node that renders only on rows whose `field` satisfies `operators`.
 *
 * The gate is `visibility.record`, evaluated as each row is expanded from this
 * template. A failing node is OMITTED from the HTML rather than hidden — which
 * matters here beyond tidiness: this page's whole promise is that a withheld
 * literal never reaches the DOM, and `display: none` would not be redaction.
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

/** A quiet uppercase micro-label used as a section heading. */
const sectionLabel = (content: string): PageComponent =>
  text('h2', 'text-foreground-subtle text-sm font-medium tracking-wide uppercase', content)

/**
 * One variable row.
 *
 * `data-testid="config-env-row-{KEY}"` is minted per row from `$record.key`, so
 * a spec can assert about ONE variable's status rather than about the page's
 * whole text — the difference between "the page mentions default somewhere" and
 * "this variable is coasting on its default".
 *
 * ─── WHY THIS IS A `div` AND NOT THE `li` ──────────────────────────────────
 *
 * The `<li>` is SYNTHESIZED. `expandDataSourceChildren` wraps each record's
 * clone in an `li` of its own before substituting, and that wrapper takes no
 * props from the template — `li` is not even a declarable component type
 * (`SynthesizedOnlyComponentType`), and the container element enum refuses it.
 * So the per-row attributes live on the outermost node the template DOES own,
 * one level in, and the separator moves to the parent's `divide-y` because a
 * `first:` variant on an only child would fire on every row.
 *
 * The description renders UNGATED. An absent `$record.*` field substitutes to
 * the empty string rather than surviving as a literal
 * (`substituteRecordVars`), so an undeclared description yields an empty span
 * and no visible text — where an ungated `Default $record.defaultValue` would
 * yield a bare, misleading "Default".
 */
const variableRow = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className:
        'flex flex-col gap-1 px-4 py-3 md:flex-row md:items-baseline md:justify-between md:gap-6',
      'data-testid': 'config-env-row-$record.key',
    },
    children: [
      {
        type: 'container',
        element: 'div',
        props: { className: 'flex min-w-0 flex-col gap-0.5' },
        children: [
          text('span', 'text-foreground font-mono text-sm', '$record.key'),
          text('span', 'text-foreground-subtle text-sm', '$record.description'),
          // Required / optional, as two mutually exclusive spans over the one
          // boolean. The trailing "has a default" hint is a THIRD span gated on
          // the withheld state alone: where the literal IS disclosed, the line
          // below already says so and more precisely, and a label repeating the
          // value beside it is a word not doing work ([internal ref] D4).
          gatedText('span', 'text-foreground-subtle text-sm', '$t:admin.env.required', {
            field: 'required',
            eq: true,
          }),
          gatedText('span', 'text-foreground-subtle text-sm', '$t:admin.env.optional', {
            field: 'required',
            eq: false,
          }),
          gatedText('span', 'text-foreground-subtle text-sm', '· has a default', {
            field: 'defaultState',
            eq: 'withheld',
          }),
          // The declared default, verbatim — only for a variable whose author
          // marked it `secret: false`. A withheld default gets no line at all
          // rather than a masked one: `Default ***` would point at a value the
          // operator cannot have and invite them to look for a reveal control
          // that A1 forbids ever building.
          gatedText(
            'span',
            'text-foreground-subtle font-mono text-sm break-all',
            'Default $record.defaultValue',
            { field: 'defaultState', eq: 'disclosed' }
          ),
        ],
      } as PageComponent,
      {
        type: 'container',
        element: 'div',
        props: { className: 'flex shrink-0 items-baseline gap-3' },
        children: [
          // Which rung resolved it. The `unset` rung is deliberately unlabelled:
          // "where did this value come from" is not a meaningful question when
          // there is no value, and the status word already says "Not set".
          // Labelling it too rendered "Not set · Not set" on every unset row.
          gatedText('span', 'text-foreground-subtle text-sm', '$t:admin.env.fromEnvironment', {
            field: 'source',
            eq: 'environment',
          }),
          gatedText('span', 'text-foreground-subtle text-sm', '$t:admin.env.fromDefault', {
            field: 'source',
            eq: 'default',
          }),
          // Two states in the same neutral ink, separated by WEIGHT: a set
          // variable reads as settled, an unset one recedes.
          gatedText('span', 'text-foreground text-sm font-medium', '$t:admin.env.set', {
            field: 'isSet',
            eq: true,
          }),
          gatedText('span', 'text-foreground-subtle text-sm', '$t:admin.env.notSet', {
            field: 'isSet',
            eq: false,
          }),
          // The mask, never the value: "a value is configured" is itself the
          // operator's answer, and the constant is fixed-width so it cannot
          // become a length oracle.
          //
          // Gated on `isSet` rather than on `masked` because the projection
          // defines `masked` as exactly `isSet ? '***' : null` — one predicate,
          // and the one that does not depend on a null-vs-absent distinction the
          // condition vocabulary cannot draw.
          gatedText('span', 'text-foreground-subtle font-mono text-sm', '$record.masked', {
            field: 'isSet',
            eq: true,
          }),
        ],
      } as PageComponent,
    ],
  }) as PageComponent

/**
 * The variable list, in DECLARATION order — the operator's grouping is
 * information, and the endpoint preserves it.
 *
 * The `<ul>` carries the binding and the row template is its single child, so
 * the expansion emits one `<li>` per declared variable.
 *
 * NEEDS: an empty-state slot on a system row template. An app declaring no
 * `env` block yields zero rows, and after `[internal ref]`
 * that renders an empty bordered box rather than the leaked template — correct,
 * but mute. The retired builder said "No variables declared / Add an env block
 * to your app config", which is the more useful answer on what is in fact the
 * COMMON configuration. No component-level slot expresses "render this when the
 * binding returned nothing" (`listDisplay.emptyMessage` belongs to the `list`
 * island shape, which cannot mint a per-row attribute and so cannot serve this
 * page), and `visibility.record` gates on a RECORD, so it is inert precisely
 * when there is none. The slot is a platform capability, not an authoring
 * choice.
 */
const listSection = (): PageComponent =>
  ({
    type: 'container',
    element: 'section',
    props: {
      'aria-label': '$t:admin.env.declared.region',
      'data-testid': 'config-env-list',
      className: 'flex flex-col gap-3',
    },
    children: [
      sectionLabel('$t:admin.env.declared.heading'),
      {
        // `list`, not a `container` with `element: 'ul'`: the container element
        // enum admits only sectioning elements, and the retired builder reached
        // `ul` and `li` only by casting past the schema (`as unknown as
        // Component`) — a door config does not have, and should not.
        //
        // `list` is also the type whose renderer already handles both states
        // this page needs: data-bound children, and a data-bound list that came
        // back EMPTY (which it keeps visible rather than collapsing to nothing).
        // It stays SSR rather than becoming an island because that only happens
        // with `listDisplay.itemTemplate`, which is the fixed shape this page
        // exists to avoid.
        type: 'list',
        props: {
          className:
            'border-border divide-border bg-background-raised divide-y overflow-hidden rounded-lg border',
        },
        dataSource: { system: { endpoint: ENV_ENDPOINT, rowsKey: 'variables', idKey: 'key' } },
        children: [variableRow()],
      } as PageComponent,
    ],
  }) as PageComponent

// The visible title block is retired here for the same reason it is on `/api`
// and `/mcp`: the chrome bar's trail already ends in this page's name, so a
// second copy printed the word twice. `pageHeading` is the shared `sr-only`
// heading the twelve data surfaces already use — one rule for the console.
const header = (): PageComponent => pageHeading('$t:admin.env.heading', '$t:admin.env.blurb')

/**
 * The provenance card — where variables are actually configured, which is NOT
 * this console. It names the destination so the read-only posture is EXPLAINED
 * rather than merely enforced.
 */
const provenanceCard = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className: 'border-border bg-background-raised flex flex-col gap-1 rounded-lg border p-4',
      'data-testid': 'config-env-provenance',
    },
    children: [
      text('p', 'text-foreground text-md font-medium', '$t:admin.env.callout.heading'),
      text(
        'p',
        'text-foreground-subtle max-w-2xl text-md leading-relaxed',
        '$t:admin.locked.audit.env.secrecyNotice'
      ),
    ],
  }) as PageComponent

export default withShell(
  {
    id: 'dashboard-config-env',
    name: 'dashboard-config-env',
    path: '/env',
    meta: { title: '$t:admin.meta.env', lang: 'en-US' },
    components: [
      {
        type: 'container',
        element: 'div',
        props: { className: 'flex max-w-3xl flex-col gap-8' },
        children: [header(), provenanceCard(), listSection()],
      },
    ],
  } as PageConfig,
  { breadcrumb: { env: '$t:admin.crumb.env' } }
) satisfies PageConfig
