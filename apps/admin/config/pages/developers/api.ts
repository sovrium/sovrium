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
// wire:
//
// - the page-level `{ system }` record resolves `/api/admin/instance`
//     SERVER-side on the caller's own credentials, so `$record.origin` and
//     `$record.exampleTable` are in the first response rather than filled in by
//     an island after the document shipped;
//   - `code.contentFrom` folds that same endpoint's `tables` ROWS into ONE code
//     block — one `GET` line per declared table, in declaration order, joined
//     and highlighted as a single copyable artifact.
//
// The endpoint publishes the origin and the table names. The comment lines, the
// column padding and the curly quotes are this page's, and they stay here where
// they can be translated — which is the whole ruling.
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

import { CARD_CLASS } from '../../components/card'
import { emptyState, pageHeading, tabQuery, tabbedBody, tabPanel } from '../../components/dataPage'
import { withShell } from '../../components/shell'
import { INSTANCE_ENDPOINT } from '../../systemSources'
import type { PageConfig } from 'sovrium'

/**
 * The two halves of this route, and the `?tab=` value that addresses each.
 *
 * `reference` is what the app's REST surface IS; `keys` is the credential an
 * operator holds to call it. They were one page and one link to a separate
 * account surface; the strip is what makes them two answers to one question.
 */
const TABS = [
  { id: 'reference', label: 'Reference' },
  { id: 'keys', label: 'Keys' },
] as const

/** One node of a page's component tree, as the config type expresses it. */
type PageComponent = NonNullable<PageConfig['components']>[number]

/** A plain text node — the recurring leaf of this page. */
const text = (element: string, className: string, content: string): PageComponent =>
  ({ type: 'text', element, props: { className }, content }) as PageComponent

/** A quiet uppercase micro-label used as a section heading. */
const sectionLabel = (content: string): PageComponent =>
  text('h2', 'text-foreground-subtle text-sm font-medium tracking-wide uppercase', content)

/** A bordered card holding labelled content (separation by border, not depth). */
const card = (children: readonly PageComponent[]): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className: 'border-border bg-background-raised flex flex-col gap-3 rounded-lg border p-5',
    },
    children,
  }) as PageComponent

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
  testid?: string
): PageComponent =>
  ({
    type: 'code',
    props: { language, ...(testid === undefined ? {} : { 'data-testid': testid }) },
    content,
    visibility: { record },
  }) as PageComponent

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
 * ─── THE POINTER NOW NAMES A TAB, AND THAT FIXED A LATENT BUG ──────────────
 *
 * It was `href: '/_admin/api-keys'` — a MOUNT-PREFIXED literal, in a config
 * whose standing rule is that every intra-app path stays mount-relative. The
 * boot walk moves an `href` beginning with `/` onto whichever base is serving
 * the console, so that value was one prefix away from resolving as
 * `/_admin/_admin/api-keys`. It never showed here because the link is gated on
 * an `apiKeysEnabled` this host does not set, which is the worst way for a
 * broken address to survive: correct-looking, unreachable, untested.
 *
 * `?tab=keys` retires the whole class. It is a QUERY, so no walk touches it; it
 * lands on this same page, so it cannot 404; and it is the surface the operator
 * wanted rather than a second page holding the same island.
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
        href: '?tab=keys',
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
        props: { language: 'http' },
        contentFrom: {
          endpoint: INSTANCE_ENDPOINT,
          rowsKey: 'tables',
          query: { limit: 4 },
          template: 'GET  /api/tables/$record.name/records      # List “$record.name”',
          empty: 'GET  /api/tables/{table}/records      # List a table’s records',
        },
      } as PageComponent,
      gatedCode(
        'POST /api/tables/$record.exampleTable/records      # Create a record',
        'http',
        HAS_TABLES
      ),
      gatedCode('POST /api/tables/{table}/records      # Create a record', 'http', NO_TABLES),
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
        '# List “$record.exampleTable” (this browser’s admin session authenticates the call)\n' +
          "curl '$record.origin/api/tables/$record.exampleTable/records' \\\n" +
          "  --header 'Accept: application/json' \\\n" +
          '  --cookie "$SOVRIUM_SESSION"',
        'bash',
        HAS_TABLES
      ),
      gatedCode(
        '# List a table’s records (this browser’s admin session authenticates the call)\n' +
          "curl '$record.origin/api/tables/{table}/records' \\\n" +
          "  --header 'Accept: application/json' \\\n" +
          '  --cookie "$SOVRIUM_SESSION"',
        'bash',
        NO_TABLES
      ),
    ]),
    tab('javascript', 'JavaScript', [
      gatedCode(
        '// List “$record.exampleTable” from this browser (the session cookie is included)\n' +
          "const res = await fetch('/api/tables/$record.exampleTable/records', {\n" +
          "  headers: { Accept: 'application/json' },\n" +
          "  credentials: 'include',\n" +
          '})\n' +
          'const { records } = await res.json()',
        'javascript',
        HAS_TABLES
      ),
      gatedCode(
        '// List a table’s records from this browser (the session cookie is included)\n' +
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
    {
      type: 'tabs',
      defaultTab: 'http',
      props: { 'aria-label': '$t:admin.api.examples.heading', className: 'flex flex-col gap-3' },
      panels: tabs.map((t) => t.panel),
      children: tabs.map((t) => t.body),
    } as PageComponent,
    text('p', 'text-foreground-subtle text-sm', '$t:admin.api.examples.note'),
  ])
}

/**
 * The "Create user" card — the create-via-API path that replaced the dashboard
 * create form dropped when the Users directory became a table.
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
        '# POST /api/auth/admin/create-user — create an account (replaces the removed form)\n' +
        "curl -X POST '$record.origin/api/auth/admin/create-user' \\\n" +
        "  --header 'Content-Type: application/json' \\\n" +
        '  --cookie "$SOVRIUM_SESSION" \\\n' +
        "  --data '{\n" +
        '    "email": "personne@exemple.com",\n' +
        '    "password": "MotDePasseFort123!",\n' +
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
          'bg-primary text-primary-fg inline-flex w-fit items-center gap-2 rounded-md px-3 py-1.5 text-md font-medium hover:opacity-90',
      },
    } as PageComponent,
  ])

/**
 * The Keys panel — the self-service API-key manager, or an honest refusal.
 *
 * ─── WHY IT IS GATED AND NOT `requires` ────────────────────────────────────
 *
 * `/api-keys` carries `requires: ['auth.apiKeys']`, which DROPS the page at
 * boot on an instance that declared no keys: the right answer for a whole
 * surface whose every endpoint 404s. It is the wrong answer for a TAB, because
 * `requires` is page-level and would take the Reference half down with it.
 *
 * `visibility.declares` is the same predicate one level down — literally the
 * same closed set and the same table — so the two halves alternate and exactly
 * one reaches the document. The operator still gets a Keys tab, and it says
 * what is true: the capability is not enabled on this instance, and enabling it
 * is a config change rather than something to click.
 *
 * ─── WHY BOTH HALVES SIT INSIDE ONE CONTAINER ──────────────────────────────
 *
 * `panels[i]` ↔ `children[i]` is refused at decode when the counts differ, and
 * a `visibility` gate REMOVES its node. Gating the panel body itself would drop
 * `children[1]` on a keyless instance and put the Reference body under the Keys
 * tab. The container is always present; only what is inside it alternates.
 */
const keysPanel = (): PageComponent =>
  tabPanel([
    {
      type: 'container',
      element: 'section',
      visibility: { declares: 'auth.apiKeys' },
      props: {
        className: CARD_CLASS,
        'aria-label': '$t:admin.apiKeys.region',
        'data-island': 'api-key-manager',
        'data-island-props': '{}',
      },
      children: [text('p', 'text-foreground-subtle text-md', '$t:admin.apiKeys.loading')],
    } as PageComponent,
    {
      ...(emptyState(
        '$t:admin.api.keys.disabled.heading',
        '$t:admin.api.keys.disabled.body',
        '$t:admin.api.keys.disabled.hint'
      ) as object),
      visibility: { unlessDeclares: 'auth.apiKeys' },
    } as PageComponent,
  ])

export default withShell(
  {
    id: 'dashboard-api-docs',
    name: 'dashboard-api-docs',
    path: '/api',
    meta: { title: '$t:admin.meta.api', lang: 'en-US' },
    // `?tab=` is the address of each half. Without this block `$query.tab` is
    // left verbatim and the strip silently opens on Reference for every link.
    query: tabQuery(TABS),
    // The page's own record. `SystemDetailSourceSchema.param` is optional, so a
    // page with no route segment can bind a facts endpoint as its record — which
    // is what makes `$record.origin` reach every block below.
    dataSource: { system: { endpoint: INSTANCE_ENDPOINT } },
    components: [
      pageHeading('$t:admin.api.heading', '$t:admin.api.blurb'),
      tabbedBody('$t:admin.api.tabs.region', TABS, [
        tabPanel([
          {
            type: 'container',
            element: 'div',
            props: { className: 'flex max-w-3xl flex-col gap-6' },
            children: [accessCard(), examplesCard(), createUserCard(), scalarCard()],
          } as PageComponent,
        ]),
        keysPanel(),
      ]),
    ],
  } as PageConfig,
  { breadcrumb: { api: '$t:admin.crumb.api' } }
) satisfies PageConfig
