/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// API — the auto-generated reference for THIS app's REST API.
//
// ─── WHY IT WAS A BUILDER, AND WHY IT IS NOT ANY MORE ──────────────────────
//
// Every address this page prints is a function of the running app: the base URL
// is the instance's resolved origin, the example lines name the operator's own
// tables, and the API-keys pointer exists only when they opted in. A preset page
// could compute none of that, so the surface was 406 lines of TypeScript.
//
// Two mechanisms closed the gap, and neither is a rendered string crossing the
// wire — an endpoint publishes facts, and the words stay in config:
//
//   - the page-level `{ system }` record resolves `/api/admin/instance`
//     SERVER-side on the caller's own credentials, so `$record.origin` and
//     `$record.exampleTable` are in the first response rather than filled in by
//     an island after the document shipped;
//   - `code.contentFrom` folds that same endpoint's `tables` ROWS into ONE code
//     block — one `GET` line per declared table, in declaration order, joined
//     and highlighted as a single copyable artifact.
//
// The endpoint publishes the origin and the table names. The comment lines, the
// column padding and the quotes are this page's, and they live in the copy
// catalogue so they follow the reader's language: a translation may carry
// `$record.*` references, which are filled after it is translated — the row
// template of the fold included.
//
// ─── THE ONE THING THE FOLD CANNOT DO ──────────────────────────────────────
//
// NEEDS: a trailing-literal slot on `code.contentFrom`. The retired builder put
// the four `GET` lines and one `POST` line in a SINGLE `<pre>`. A fold emits one
// line per row and has no way to append a fixed line derived from the page
// record: `template` is substituted per ROW, and `substituteRecordInComponent`
// deliberately does not walk `contentFrom`, so the two `$record` namespaces
// cannot meet. Declaring `content` beside `contentFrom` is refused at decode by
// design ("two answers to what the block holds").
//
// So the HTTP tab holds TWO code blocks — the folded list calls, and the create
// call — inside one container carrying `data-testid="api-docs-examples"`. Every
// assertion still holds and both blocks stay copyable and highlighted, but the
// operator now copies two artifacts where they copied one. That is a UX delta,
// not a migration, and it belongs to `[internal ref]` to accept or
// replace; the platform fix is a `contentFrom.append` slot, which is
// `[internal ref]`'s surface.

import { factsCardFrom } from '../../components/card-blocks'
import { consolePage } from '../../components/data-page'
import { lineTabs } from '../../components/tabs-line'
import { INSTANCE_ENDPOINT } from '../../system-sources'
import type { Page as PageConfig } from '@/domain/models/app'

/** One node of a page's component tree, as the config type expresses it. */
type PageComponent = NonNullable<PageConfig['components']>[number]

/** A plain text node — the recurring leaf of this page. */
const text = (element: string, className: string, content: string): PageComponent =>
  ({ type: 'text', element, props: { className }, content }) as PageComponent

/** A quiet uppercase micro-label used as a section heading. */
const sectionLabel = (content: string): PageComponent =>
  text('h2', 'text-foreground-subtle text-sm font-medium tracking-wide uppercase', content)

/** A section card: the library's `dl-rows` card, installed in `card-blocks.ts`. */
const card = (children: readonly PageComponent[]): PageComponent => factsCardFrom(children)

/** A labelled key→value row (e.g. "Base URL" → the API root). */
const keyValueRow = (label: string, value: string): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-col gap-1' },
    children: [
      text('span', 'text-foreground-subtle text-sm uppercase', label),
      text('span', 'text-foreground text-md', value),
    ],
  }) as PageComponent

/**
 * A `code` block rendered only when the page record satisfies `record`.
 *
 * Every example that names the operator's FIRST table needs a pair of these:
 * `exampleTable` is `null` on an app declaring no tables, and
 * `substituteRecordVars` renders a null as the literal string `"null"` — so an
 * ungated block would print `/api/tables/null/records` on exactly the app whose
 * author most needs a readable placeholder. The retired builder solved the same
 * problem with a `'{table}'` fallback in TypeScript; the gate is that fallback
 * expressed declaratively.
 */
const gatedCode = (
  content: string,
  language: string,
  record: Readonly<Record<string, unknown>>,
  testid?: string,
  className?: string
): PageComponent =>
  ({
    type: 'code',
    props: {
      language,
      ...(testid === undefined ? {} : { 'data-testid': testid }),
      ...(className === undefined ? {} : { className }),
    },
    content,
    visibility: { record },
  }) as PageComponent

/**
 * An http request line in one neutral ink.
 *
 * The http grammar paints a request line's method as a KEYWORD, and the
 * highlighting theme's keyword colour is a red, so every `GET` on this page
 * read as a destructive call. A method is not a warning. Every token of these
 * lines takes the block's own ink instead: the line is a verb, a path and a
 * comment, and none of the three needs a colour to be read. The token colours
 * are unlayered rules, so the class carries `!` to reach past them.
 */
const NEUTRAL_HTTP_INK = '[&_[data-slot=code-block-line-content]>span]:text-inherit!'

/** True when the app declares at least one table; false when it declares none. */
const HAS_TABLES = { field: 'tableCount', gt: 0 } as const
const NO_TABLES = { field: 'tableCount', eq: 0 } as const

// ─── THE VISIBLE TITLE BLOCK IS GONE ───────────────────────────────────────
//
// The console draws ONE header row — the 48px chrome bar, whose trail ends in
// this page's own name — so a visible `h1` here printed the same word twice,
// 10px apart. The twelve data surfaces retired theirs a wave ago through
// `pageHeading`, and the four Developer pages kept a hand-rolled one, which
// left the console with two rules for the same thing. They use the shared
// `sr-only` heading now, so there is one: the heading stays in the
// accessibility tree, the trail is what a reader sees.

/**
 * The base-URL + auth-scheme card.
 *
 * The API-keys pointer renders only when the app opted in (`apiKeysEnabled`).
 * Without the opt-in the endpoints answer 404, and a link to a 404 is worse
 * than no link at all. Minting a key is a WRITE, and this is a reflection
 * surface with no writes in it — so the page points at the surface that owns
 * the write rather than growing a form, which would need an [internal ref] amendment.
 *
 * ─── KEYS HAVE ONE HOME ────────────────────────────────────────────────────
 *
 * The pointer leads to Developers › API keys, the one place a key is created
 * and revoked. This page once held the same manager under a Keys tab, so a key
 * lived in two places; the tab is gone and the pointer is the way there.
 */
const accessCard = (): PageComponent =>
  card([
    sectionLabel('$t:admin.api.access.heading'),
    keyValueRow('$t:admin.api.baseUrl.heading', '$record.origin/api'),
    keyValueRow('$t:admin.api.auth.heading', '$t:admin.api.auth.blurb'),
    {
      ...(keyValueRow('$t:admin.api.keys.heading', '$t:admin.api.keys.blurb') as object),
      visibility: { record: { field: 'apiKeysEnabled', eq: true } },
    } as PageComponent,
    {
      type: 'link',
      content: '$t:admin.api.keys.link',
      props: {
        // Mount-relative: the boot walk moves it onto the console's base.
        href: '/api-keys',
        className: 'w-fit text-md underline-offset-4 hover:underline',
      },
      visibility: { record: { field: 'apiKeysEnabled', eq: true } },
    } as PageComponent,
  ])

/**
 * The HTTP tab's body: the folded list calls, then the create call.
 *
 * The container carries the testid rather than either block — see the header
 * note on the missing trailing-literal slot. `limit: 4` matches the retired
 * builder's `slice(0, 4)`: a fifty-table app would otherwise inline fifty lines
 * into the HTML of a page whose purpose is to show the SHAPE of a call.
 */
const httpExamples = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-col gap-2', 'data-testid': 'api-docs-examples' },
    children: [
      {
        type: 'code',
        props: { language: 'http', className: NEUTRAL_HTTP_INK },
        contentFrom: {
          endpoint: INSTANCE_ENDPOINT,
          rowsKey: 'tables',
          query: { limit: 4 },
          template: '$t:admin.api.examples.httpList',
          empty: '$t:admin.api.examples.httpListAny',
        },
      } as PageComponent,
      gatedCode(
        '$t:admin.api.examples.httpCreate',
        'http',
        HAS_TABLES,
        undefined,
        NEUTRAL_HTTP_INK
      ),
      gatedCode(
        '$t:admin.api.examples.httpCreateAny',
        'http',
        NO_TABLES,
        undefined,
        NEUTRAL_HTTP_INK
      ),
    ],
  }) as PageComponent

/**
 * One tab of the examples strip: the trigger, and the body it selects.
 *
 * A tab is no longer one component — `panels[i]` on the `tabs` node names the
 * tab that shows `children[i]`. This returns both halves together so a caller
 * cannot supply one without the other, and the body is wrapped in a single
 * `container` even when it is one block: a panel is exactly ONE `children`
 * entry, and this container is the element the retired `tab-panel` used to
 * contribute (it rendered a bare `div`). The cURL and JavaScript tabs each hold
 * two visibility-gated blocks, so without the wrapper their counts would no
 * longer match `panels`.
 */
const tab = (id: string, label: string, children: readonly PageComponent[]) => ({
  panel: { id, label },
  body: { type: 'container', children } as PageComponent,
})

/**
 * The example-requests card. The same call is offered as HTTP / cURL /
 * JavaScript through a `display/tabs` strip, each panel a first-class code
 * block with its own copy affordance.
 */
const examplesCard = (): PageComponent => {
  // Built once and split into the two index-aligned arrays below, so the
  // `panels[i]` ↔ `children[i]` correlation holds by construction rather than
  // by a reader keeping two literal lists in the same order.
  const tabs = [
    tab('http', 'HTTP', [httpExamples()]),
    tab('curl', 'cURL', [
      gatedCode(
        '$t:admin.api.examples.curlListComment\n' +
          "curl '$record.origin/api/tables/$record.exampleTable/records' \\\n" +
          "  --header 'Accept: application/json' \\\n" +
          '  --cookie "$SOVRIUM_SESSION"',
        'bash',
        HAS_TABLES
      ),
      gatedCode(
        '$t:admin.api.examples.curlListAnyComment\n' +
          "curl '$record.origin/api/tables/{table}/records' \\\n" +
          "  --header 'Accept: application/json' \\\n" +
          '  --cookie "$SOVRIUM_SESSION"',
        'bash',
        NO_TABLES
      ),
    ]),
    tab('javascript', 'JavaScript', [
      gatedCode(
        '$t:admin.api.examples.jsListComment\n' +
          "const res = await fetch('/api/tables/$record.exampleTable/records', {\n" +
          "  headers: { Accept: 'application/json' },\n" +
          "  credentials: 'include',\n" +
          '})\n' +
          'const { records } = await res.json()',
        'javascript',
        HAS_TABLES
      ),
      gatedCode(
        '$t:admin.api.examples.jsListAnyComment\n' +
          "const res = await fetch('/api/tables/{table}/records', {\n" +
          "  headers: { Accept: 'application/json' },\n" +
          "  credentials: 'include',\n" +
          '})\n' +
          'const { records } = await res.json()',
        'javascript',
        NO_TABLES
      ),
    ]),
  ]

  return card([
    sectionLabel('$t:admin.api.examples.heading'),
    lineTabs({
      defaultTab: 'http',
      props: { 'aria-label': '$t:admin.api.examples.heading', className: 'flex flex-col gap-3' },
      panels: tabs.map((t) => t.panel),
      children: tabs.map((t) => t.body),
    }),
    text('p', 'text-foreground-subtle text-sm', '$t:admin.api.examples.note'),
  ])
}

/**
 * The "Create user" card — accounts are created through the admin API (or the
 * MCP server); the console has no create form.
 *
 * The body is single-quoted after `--data` and the `--cookie` flag sits BEFORE
 * it deliberately: the docs spec lifts the printed body out of the rendered
 * block by slicing between `--data '` and the LAST `'`, so a single-quoted flag
 * after the body would truncate it.
 */
const createUserCard = (): PageComponent =>
  card([
    sectionLabel('$t:admin.api.createUser.heading'),
    text('p', 'text-foreground-subtle text-md', '$t:admin.api.createUser.blurb'),
    {
      type: 'code',
      props: { language: 'bash', 'data-testid': 'api-docs-create-user' },
      content:
        '$t:admin.api.createUser.comment\n' +
        "curl -X POST '$record.origin/api/auth/admin/create-user' \\\n" +
        "  --header 'Content-Type: application/json' \\\n" +
        '  --cookie "$SOVRIUM_SESSION" \\\n' +
        "  --data '{\n" +
        '    "email": "name@example.com",\n' +
        '    "password": "a-strong-password",\n' +
        '    "role": "member"\n' +
        "  }'",
    } as PageComponent,
  ])

/** The prominent call-to-action: open the interactive Scalar reference. */
const scalarCard = (): PageComponent =>
  card([
    sectionLabel('$t:admin.api.reference.heading'),
    text('p', 'text-foreground-subtle text-md', '$t:admin.api.reference.blurb'),
    {
      type: 'link',
      content: '$t:admin.api.reference.link',
      props: {
        href: '/api/scalar',
        target: '_blank',
        rel: 'noopener noreferrer',
        'data-testid': 'api-docs-scalar-link',
        className:
          'bg-primary text-primary-foreground inline-flex w-fit items-center gap-2 rounded-md px-3 py-1.5 text-md font-medium hover:opacity-90',
      },
    } as PageComponent,
  ])

export default consolePage({
  id: 'dashboard-api-docs',
  path: '/api',
  title: '$t:admin.meta.api',
  heading: ['$t:admin.api.heading', '$t:admin.api.blurb'],
  visibleHeading: true,
  page: {
    // The page's own record. `SystemDetailSourceSchema.param` is optional, so a
    // page with no route segment can bind a facts endpoint as its record — which
    // is what makes `$record.origin` reach every block below.
    dataSource: { system: { endpoint: INSTANCE_ENDPOINT } },
  },
  shell: { breadcrumb: { api: '$t:admin.crumb.api' }, document: true },
  body: [
    {
      type: 'container',
      element: 'div',
      props: { className: 'flex flex-col gap-6' },
      children: [accessCard(), examplesCard(), createUserCard(), scalarCard()],
    } as PageComponent,
  ],
}) satisfies PageConfig
